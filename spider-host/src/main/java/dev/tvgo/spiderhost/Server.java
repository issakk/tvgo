// HTTP mode: the app cannot spawn a process (its runtime hands it no path to its own
// files), so the host is started by the user or a shortcut and answers on localhost.
package dev.tvgo.spiderhost;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

final class Server {
    private Server() {
    }

    static void serve(int port) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), port), 0);
        server.createContext("/health", exchange -> respond(exchange, 200, "{\"ok\":true}"));
        server.createContext("/log", exchange -> {
            String query = exchange.getRequestURI().getQuery();
            int lines = 200;
            if (query != null && query.startsWith("lines=")) {
                try {
                    lines = Integer.parseInt(query.substring("lines=".length()));
                } catch (NumberFormatException keepDefault) {
                    lines = 200;
                }
            }
            respond(exchange, 200, Log.tail(Math.max(1, Math.min(2000, lines))));
        });
        server.createContext("/rpc", exchange -> {
            String request = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            String response;
            try {
                response = Main.handle(request.trim());
            } catch (RuntimeException failed) {
                response = "{\"ok\":false,\"error\":\"" + failed.getMessage() + "\"}";
            }
            respond(exchange, 200, response);
        });
        server.setExecutor(java.util.concurrent.Executors.newFixedThreadPool(4));
        server.start();
        System.out.println("{\"ready\":true,\"port\":" + port + "}");
    }

    private static void respond(com.sun.net.httpserver.HttpExchange exchange, int status, String body)
            throws IOException {
        byte[] data = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, data.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(data);
        }
    }
}
