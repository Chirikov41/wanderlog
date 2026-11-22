package com.wanderlog.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

/**
 * Native shell for Wanderlog.
 *
 * The web build is bundled inside the APK and served from a loopback HTTP
 * server, which gives the WebView a secure first-party origin. That is what
 * allows IndexedDB, geolocation and getUserMedia to work without a network or
 * any external hosting.
 */
public class MainActivity extends Activity {

    private static final String TAG = "Wanderlog";
    private static final int REQUEST_PERMISSIONS = 100;
    private static final int REQUEST_FILE = 101;

    private WebView webView;
    private AssetServer server;
    private ValueCallback<Uri[]> pendingFileCallback;
    private android.widget.TextView errorView;
    private int loadRetries = 0;
    private int localPort = -1;
    private boolean triedLocalServer = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.parseColor("#0E5C4A"));
        getWindow().setNavigationBarColor(Color.parseColor("#F7F1E4"));

        requestAppPermissions();

        server = new AssetServer(this);
        if (!server.hasIndex()) {
            // Surface the problem instead of showing a blank page.
            android.widget.TextView message = new android.widget.TextView(this);
            message.setPadding(48, 96, 48, 48);
            message.setTextSize(14f);
            message.setText("Wanderlog could not read its bundled files.\n\n" + server.diagnostic());
            setContentView(message);
            return;
        }

        try {
            localPort = server.start();
        } catch (RuntimeException ignored) {
            localPort = -1;
        }

        webView = new WebView(this);
        configureWebView();

        errorView = new android.widget.TextView(this);
        errorView.setTextSize(11f);
        errorView.setTextColor(Color.WHITE);
        errorView.setBackgroundColor(Color.parseColor("#CC7A2E24"));
        errorView.setPadding(24, 24, 24, 24);
        errorView.setVisibility(android.view.View.GONE);
        errorView.setMaxLines(8);
        errorView.setOnClickListener(new android.view.View.OnClickListener() {
            @Override
            public void onClick(android.view.View view) {
                view.setVisibility(android.view.View.GONE);
            }
        });

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#F5EFE2"));
        root.addView(
                webView,
                new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT));
        FrameLayout.LayoutParams errorParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        errorParams.gravity = android.view.Gravity.BOTTOM;
        root.addView(errorView, errorParams);

        setContentView(root);
        webView.loadUrl("https://appassets.androidplatform.net/");
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String host = url.getHost();
                if (host != null && host.equals("nominatim.openstreetmap.org")) {
                    // The reverse geocoder does not answer CORS preflight from a
                    // WebView origin, so fetch it natively and add the header.
                    return proxyGeocoder(url.toString());
                }
                String path = url.getPath();
                if (path == null || path.isEmpty()) path = "/";
                if (path.equals("/")) path = "/index.html";
                // The APK does not need a service worker; serving 404 keeps the
                // page outside a worker's control, where interception applies.
                if (path.equals("/sw.js")) {
                    return new WebResourceResponse(
                            "text/plain",
                            "utf-8",
                            404,
                            "Not Found",
                            new java.util.HashMap<String, String>(),
                            new java.io.ByteArrayInputStream(new byte[0]));
                }
                byte[] body = server.get("www" + path);
                if (body == null) {
                    // The inlined bundle resolves its lazy chunks relative to the
                    // document, so /TripMap-*.js arrives at the root instead of
                    // /assets/; look there as well.
                    body = server.get("www/assets" + path);
                }
                String servedPath = path;
                if (body == null) {
                    boolean hasExtension = path.lastIndexOf('.') > path.lastIndexOf('/');
                    if (!hasExtension) {
                        body = server.get("www/index.html");
                        servedPath = "/index.html";
                    }
                }
                if (body == null) {
                    String message = "Not found: " + path + "\nassets=" + server.size();
                    return new WebResourceResponse(
                            "text/plain",
                            "utf-8",
                            404,
                            "Not Found",
                            new java.util.HashMap<String, String>(),
                            new java.io.ByteArrayInputStream(
                                    message.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
                }
                return new WebResourceResponse(
                        server.mimeTypeOf(servedPath),
                        "utf-8",
                        new java.io.ByteArrayInputStream(body));
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri uri = Uri.parse(url);
                String host = uri.getHost();
                if (host == null
                        || host.equals("127.0.0.1")
                        || host.equals("localhost")
                        || host.equals("appassets.androidplatform.net")) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                    // No app can open this link.
                }
                return true;
            }

            @Override
            public void onPageFinished(final WebView view, final String url) {
                view.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        view.evaluateJavascript(
                                "(function(){var r=document.getElementById('root');"
                                        + "return r ? String(r.childElementCount) : '-1';})()",
                                new ValueCallback<String>() {
                                    @Override
                                    public void onReceiveValue(String value) {
                                        if ("0".equals(value)) {
                                            if (!triedLocalServer && localPort > 0) {
                                                triedLocalServer = true;
                                                showError("Intercepted page did not mount; retrying via the local server");
                                                view.loadUrl("http://127.0.0.1:" + localPort + "/");
                                            } else {
                                                showError("Page loaded but the app did not mount (#root empty)\n" + url);
                                            }
                                        }
                                    }
                                });
                    }
                }, 2500);
            }

            @Override
            public void onReceivedHttpError(
                    WebView view, WebResourceRequest request, WebResourceResponse response) {
                String url = request.getUrl().toString();
                if (url.contains("/assets/") || url.endsWith(".js")) {
                    if (url.endsWith("/sw.js") || url.contains("/workbox-")) return;
                    showError("HTTP " + response.getStatusCode() + "\n" + url);
                }
            }

            @Override
            public void onReceivedError(
                    final WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    showError("Network error " + error.getErrorCode() + "\n" + request.getUrl());
                    if (loadRetries < 3) {
                        loadRetries++;
                        final String failedUrl = request.getUrl().toString();
                        view.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                view.loadUrl(failedUrl);
                            }
                        }, 800);
                    }
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(
                    String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        request.grant(request.getResources());
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (pendingFileCallback != null) {
                    pendingFileCallback.onReceiveValue(null);
                }
                pendingFileCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(intent, REQUEST_FILE);
                    return true;
                } catch (Exception error) {
                    pendingFileCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                Log.d(TAG, "console: " + message.message() + " (line " + message.lineNumber() + ")");
                if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                    String text = message.message();
                    String lower = (text + " " + message.sourceId()).toLowerCase();
                    if (lower.contains("serviceworker") || lower.contains("service worker")
                            || lower.contains("sw.js") || lower.contains("workbox")) {
                        return true;
                    }
                    showError(text + "\n" + message.sourceId() + ":" + message.lineNumber());
                }
                return true;
            }
        });
    }

    private void showError(String text) {
        if (errorView == null) return;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                errorView.setText(text);
                errorView.setVisibility(android.view.View.VISIBLE);
            }
        });
    }

    /**
     * Reverse geocoding is a cross-origin fetch. The public Nominatim endpoint
     * does not always answer with Access-Control-Allow-Origin, which blocks the
     * request when the page origin is the WebView asset host. Fetching it here
     * and adding the header keeps the feature working.
     */
    private WebResourceResponse proxyGeocoder(String target) {
        java.util.Map<String, String> headers = new java.util.HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Cache-Control", "no-store");
        try {
            java.net.HttpURLConnection connection =
                    (java.net.HttpURLConnection) new java.net.URL(target).openConnection();
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            connection.setRequestProperty(
                    "User-Agent", "Wanderlog/2.0 (COMP10013 coursework, UWS)");
            connection.setRequestProperty("Accept", "application/json");
            int status = connection.getResponseCode();
            java.io.InputStream stream =
                    status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            byte[] body = stream == null ? new byte[0] : readAll(stream);
            if (stream != null) stream.close();
            return new WebResourceResponse(
                    "application/json",
                    "utf-8",
                    status,
                    "OK",
                    headers,
                    new java.io.ByteArrayInputStream(body));
        } catch (Exception error) {
            byte[] body = ("{\"error\":\"" + error.getClass().getSimpleName() + "\"}")
                    .getBytes(java.nio.charset.StandardCharsets.UTF_8);
            return new WebResourceResponse(
                    "application/json",
                    "utf-8",
                    502,
                    "Bad Gateway",
                    headers,
                    new java.io.ByteArrayInputStream(body));
        }
    }

    private byte[] readAll(java.io.InputStream input) throws java.io.IOException {
        java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
        return output.toByteArray();
    }

    private void requestAppPermissions() {
        List<String> missing = new ArrayList<>();
        String[] wanted = new String[] {
                Manifest.permission.CAMERA,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
        };
        for (String permission : wanted) {
            if (checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
                missing.add(permission);
            }
        }
        if (!missing.isEmpty()) {
            requestPermissions(missing.toArray(new String[0]), REQUEST_PERMISSIONS);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_FILE) {
            Uri[] result = null;
            if (resultCode == RESULT_OK) {
                result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            }
            if (pendingFileCallback != null) {
                pendingFileCallback.onReceiveValue(result);
                pendingFileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (server != null) server.stop();
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
