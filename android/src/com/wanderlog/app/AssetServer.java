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
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Serves the bundled web app from the APK over http://127.0.0.1.
 *
 * A tiny local server is used instead of file:// because Chromium treats
 * http://127.0.0.1 as a secure, first-party origin: IndexedDB, the service
 * worker, geolocation and getUserMedia all behave exactly as they do on the
 * deployed PWA, while the assets never leave the device.
 */
public class AssetServer {

    private static final String TAG = "WanderlogServer";
    private static final String ASSET_ROOT = "www";
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

    private final AssetManager assets;
    private final ExecutorService pool = Executors.newFixedThreadPool(4);
    private ServerSocket serverSocket;
    private int port = -1;

    public AssetServer(Context context) {
        this.assets = context.getAssets();
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
        Log.i(TAG, "serving http://127.0.0.1:" + port + "/");
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
            int query = path.indexOf('?');
            if (query >= 0) path = path.substring(0, query);

            if (path.equals("/")) path = "/index.html";
            if (path.contains("..")) {
                write(socket, 403, "text/plain; charset=utf-8", "Forbidden".getBytes("UTF-8"));
                socket.close();
                return;
            }

            byte[] body = readAsset(ASSET_ROOT + path);
            if (body == null) {
                body = readAsset(ASSET_ROOT + "/index.html");
                path = "/index.html";
            }
            if (body == null) {
                write(socket, 404, "text/plain; charset=utf-8", "Not found".getBytes("UTF-8"));
            } else {
                write(socket, 200, mimeType(path), body);
            }
            socket.close();
        } catch (IOException error) {
            Log.w(TAG, "request failed", error);
        }
    }

    private byte[] readAsset(String path) {
        InputStream input = null;
        try {
            input = assets.open(path);
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            return output.toByteArray();
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
