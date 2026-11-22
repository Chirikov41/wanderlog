package com.wanderlog.app;

import android.content.Context;
import android.content.res.AssetManager;
import android.util.Log;

import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Serves the bundled web app from the APK over http://127.0.0.1.
 *
 * A tiny local server is used instead of file:// because Chromium treats
 * http://127.0.0.1 as a secure, first-party origin: IndexedDB, the service
 * worker, geolocation and getUserMedia all behave exactly as they do on the
 * deployed PWA, while the assets never leave the device.
 *
 * Assets are read once into memory. The primary reader opens the APK itself as
 * a zip file, which is immune to AssetManager path quirks; AssetManager is only
 * a fallback.
 */
public class AssetServer {

    private static final String TAG = "WanderlogServer";
    private static final String ASSET_ROOT = "www";
    private static final String APK_PREFIX = "assets/www/";
    private static final Map<String, String> MIME = new HashMap<>();

    static {
        MIME.put("html", "text/html; charset=utf-8");
        MIME.put("js", "text/javascript; charset=utf-8");
        MIME.put("mjs", "text/javascript; charset=utf-8");
        MIME.put("css", "text/css; charset=utf-8");
        MIME.put("json", "application/json; charset=utf-8");
        MIME.put("webmanifest", "application/manifest+json; charset=utf-8");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("webp", "image/webp");
        MIME.put("ico", "image/x-icon");
        MIME.put("woff2", "font/woff2");
        MIME.put("txt", "text/plain; charset=utf-8");
    }

    private final Context context;
    private final AssetManager assets;
    private final Map<String, byte[]> files = new java.util.concurrent.ConcurrentHashMap<>();
    private final ExecutorService pool = Executors.newFixedThreadPool(4);
    private ServerSocket serverSocket;
    private int port = -1;
    private String loadReport = "not loaded";

    public AssetServer(Context context) {
        this.context = context.getApplicationContext();
        this.assets = this.context.getAssets();
        load();
    }

    private void load() {
        int fromRaw = loadFromRawResource();
        int fromApk = 0;
        try {
            ZipFile zip = new ZipFile(context.getApplicationInfo().sourceDir);
            try {
                Enumeration<? extends ZipEntry> entries = zip.entries();
                while (entries.hasMoreElements()) {
                    ZipEntry entry = entries.nextElement();
                    String name = entry.getName();
                    if (entry.isDirectory() || !name.startsWith(APK_PREFIX)) continue;
                    InputStream input = zip.getInputStream(entry);
                    try {
                        files.put(name.substring("assets/".length()), readAll(input));
                        fromApk++;
                    } finally {
                        input.close();
                    }
                }
            } finally {
                zip.close();
            }
        } catch (Exception error) {
            Log.w(TAG, "reading assets from the APK failed", error);
        }

        int fromAssets = 0;
        if (files.isEmpty()) {
            try {
                copyTree(ASSET_ROOT, fromAssets);
            } catch (Exception error) {
                Log.w(TAG, "reading assets from AssetManager failed", error);
            }
        }

        loadReport = "raw=" + fromRaw + " apk=" + fromApk + " assetManager=" + fromAssets
                + " total=" + files.size();
        Log.i(TAG, "assets: " + loadReport + " index=" + files.containsKey("www/index.html"));
    }

    /**
     * Primary loader: the web build is also packaged as res/raw/www.zip, which
     * is read through the resource table. Resources are always available to the
     * app (the launcher icon and label come from the same table), so this works
     * even on installers where the assets directory is not readable.
     */
    private int loadFromRawResource() {
        int count = 0;
        try {
            // Copy the raw resource to a real file first: ZipFile reads the
            // central directory, which is far more reliable on device than
            // streaming the nested zip through ZipInputStream.
            java.io.File cached = new java.io.File(context.getCacheDir(), "wanderlog-www.zip");
            InputStream raw = context.getResources().openRawResource(R.raw.www);
            try {
                java.io.FileOutputStream output = new java.io.FileOutputStream(cached);
                try {
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = raw.read(buffer)) != -1) output.write(buffer, 0, read);
                } finally {
                    output.close();
                }
            } finally {
                raw.close();
            }

            ZipFile zip = new ZipFile(cached);
            try {
                Enumeration<? extends ZipEntry> entries = zip.entries();
                while (entries.hasMoreElements()) {
                    ZipEntry entry = entries.nextElement();
                    if (entry.isDirectory()) continue;
                    InputStream input = zip.getInputStream(entry);
                    try {
                        files.put("www/" + entry.getName(), readAll(input));
                        count++;
                    } finally {
                        input.close();
                    }
                }
            } finally {
                zip.close();
            }
        } catch (Exception error) {
            Log.w(TAG, "reading the raw resource failed", error);
        }
        return count;
    }

    private int copyTree(String path, int count) throws IOException {
        String[] children = assets.list(path);
        if (children == null || children.length == 0) {
            byte[] body = readAsset(path);
            if (body != null) {
                files.put(path, body);
                return count + 1;
            }
            return count;
        }
        for (String child : children) {
            count = copyTree(path + "/" + child, count);
        }
        return count;
    }

    private byte[] readAsset(String path) {
        InputStream input = null;
        try {
            input = assets.open(path);
            return readAll(input);
        } catch (IOException missing) {
            return null;
        } finally {
            if (input != null) {
                try {
                    input.close();
                } catch (IOException ignored) {
                    // ignore
                }
            }
        }
    }

    private byte[] readAll(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
        return output.toByteArray();
    }

    public int start() {
        for (int candidate = 8765; candidate < 8785 && serverSocket == null; candidate++) {
            try {
                ServerSocket socket = new ServerSocket();
                socket.setReuseAddress(true);
                socket.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), candidate));
                serverSocket = socket;
                port = candidate;
            } catch (IOException ignored) {
                // Port busy: try the next one.
            }
        }
        if (serverSocket == null) {
            throw new IllegalStateException("No free local port for the asset server");
        }

        Thread thread = new Thread(new Runnable() {
            @Override
            public void run() {
                while (!serverSocket.isClosed()) {
                    try {
                        final Socket client = serverSocket.accept();
                        pool.execute(new Runnable() {
                            @Override
                            public void run() {
                                handle(client);
                            }
                        });
                    } catch (IOException error) {
                        if (!serverSocket.isClosed()) Log.w(TAG, "accept failed", error);
                    }
                }
            }
        }, "wanderlog-assets");
        thread.setDaemon(true);
        thread.start();
        Log.i(TAG, "serving http://127.0.0.1:" + port + "/ (" + loadReport + ")");
        return port;
    }

    public void stop() {
        pool.shutdownNow();
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (IOException ignored) {
            // Nothing to do on shutdown.
        }
    }

    public boolean hasIndex() {
        return files.containsKey("www/index.html");
    }

    public String diagnostic() {
        return loadReport;
    }

    public byte[] get(String assetPath) {
        String key = assetPath.replace('\\', '/');
        byte[] body = files.get(key);
        if (body == null && key.startsWith("/")) body = files.get(key.substring(1));
        if (body == null) {
            String tail = key.startsWith("/") ? key.substring(1) : key;
            for (Map.Entry<String, byte[]> entry : files.entrySet()) {
                String candidate = entry.getKey();
                if (candidate.equals(tail) || candidate.endsWith("/" + tail)) {
                    return entry.getValue();
                }
            }
        }
        return body;
    }

    public int size() {
        return files.size();
    }

    public String mimeTypeOf(String assetPath) {
        String type = mimeType(assetPath);
        // WebResourceResponse expects a bare type such as "text/html"; a
        // "text/html; charset=utf-8" value makes some WebView versions treat
        // the page as plain text and show its source instead of rendering it.
        int semicolon = type.indexOf(';');
        return semicolon >= 0 ? type.substring(0, semicolon) : type;
    }

    private void handle(Socket client) {
        try {
            Socket socket = client;
            socket.setSoTimeout(5000);
            InputStream rawInput = socket.getInputStream();
            ByteArrayOutputStream head = new ByteArrayOutputStream();
            int value;
            while ((value = rawInput.read()) != -1) {
                head.write(value);
                int size = head.size();
                if (size >= 4) {
                    byte[] tail = head.toByteArray();
                    boolean crlf = tail[size - 4] == '\r' && tail[size - 3] == '\n'
                            && tail[size - 2] == '\r' && tail[size - 1] == '\n';
                    boolean lf = tail[size - 2] == '\n' && tail[size - 1] == '\n';
                    if (crlf || lf) break;
                }
                if (size > 16384) break;
            }

            String request = head.toString("UTF-8");
            String path = "/";
            int firstSpace = request.indexOf(' ');
            if (firstSpace >= 0) {
                int secondSpace = request.indexOf(' ', firstSpace + 1);
                if (secondSpace > firstSpace) path = request.substring(firstSpace + 1, secondSpace);
            }
            // Some WebView/proxy configurations send an absolute request URI.
            if (path.startsWith("http://") || path.startsWith("https://")) {
                try {
                    path = new java.net.URI(path).getPath();
                } catch (Exception ignored) {
                    // keep the original value
                }
            }
            int query = path.indexOf('?');
            if (query >= 0) path = path.substring(0, query);
            if (path == null || path.isEmpty()) path = "/";

            if (path.equals("/")) path = "/index.html";
            if (path.contains("..")) {
                write(socket, 403, "text/plain; charset=utf-8", "Forbidden".getBytes("UTF-8"));
                socket.close();
                return;
            }

            byte[] body = files.get(ASSET_ROOT + path);
            if (body == null) body = files.get(ASSET_ROOT + "/assets" + path);
            if (body == null) {
                // Only navigation requests fall back to the SPA shell; a missing
                // script or image must stay a 404 instead of turning into HTML.
                boolean wantsHtml = request.toLowerCase().contains("accept: text/html");
                boolean hasExtension = path.lastIndexOf('.') > path.lastIndexOf('/');
                if (!hasExtension || wantsHtml) {
                    body = files.get(ASSET_ROOT + "/index.html");
                    path = "/index.html";
                }
            }
            if (body == null) {
                String message = "Not found: " + path + "\n" + loadReport
                        + "\nindex=" + files.containsKey("www/index.html");
                write(socket, 404, "text/plain; charset=utf-8", message.getBytes("UTF-8"));
            } else {
                write(socket, 200, mimeType(path), body);
            }
            socket.close();
        } catch (IOException error) {
            Log.w(TAG, "request failed", error);
        }
    }

    private void write(Socket socket, int status, String mime, byte[] body) throws IOException {
        OutputStream output = new BufferedOutputStream(socket.getOutputStream(), 8192);
        String reason = status == 200 ? "OK" : status == 403 ? "Forbidden" : "Not Found";
        StringBuilder header = new StringBuilder();
        header.append("HTTP/1.1 ").append(status).append(' ').append(reason).append("\r\n");
        header.append("Content-Type: ").append(mime).append("\r\n");
        header.append("Content-Length: ").append(body.length).append("\r\n");
        header.append("Cache-Control: no-cache\r\n");
        header.append("Connection: close\r\n\r\n");
        output.write(header.toString().getBytes("UTF-8"));
        output.write(body);
        output.flush();
    }

    private String mimeType(String path) {
        int dot = path.lastIndexOf('.');
        String extension = dot >= 0 ? path.substring(dot + 1).toLowerCase() : "";
        String type = MIME.get(extension);
        return type != null ? type : "application/octet-stream";
    }
}
