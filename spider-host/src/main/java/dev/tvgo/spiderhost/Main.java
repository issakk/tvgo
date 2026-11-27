// The host process the desktop app spawns: one JSON request per line on stdin, one
// JSON response per line on stdout. Requests carry the jar, the site's api and its ext,
// so the app never has to know Spider class names beyond `csp_Xxx`.
package dev.tvgo.spiderhost;

import android.content.Context;
import com.github.catvod.crawler.Spider;
import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public final class Main {
    private static final int THREADS = 4;

    private static final Map<String, Spider> SPIDERS = new ConcurrentHashMap<>();
    private static final PrintStream OUT = new PrintStream(System.out, true, StandardCharsets.UTF_8);
    /** Swallows what a payload prints while it fails at something Android-only. */
    private static final PrintStream QUIET = new PrintStream(java.io.OutputStream.nullOutputStream());
    private static Payloads payloads;

    public static void main(String[] args) throws Exception {
        Path data = Path.of(System.getProperty("tvgo.spider.data", "spider-data"));
        List<String> missing = Runtime.missing();
        if (!missing.isEmpty()) {
            System.err.println("[host] 这个 JRE 缺少模块：" + String.join(", ", missing)
                    + "；请用 --add-modules " + String.join(",", missing) + " 重新 jlink");
            System.exit(2);
        }
        payloads = new Payloads(data.resolve("spiders"));
        if (args.length > 0 && "--serve".equals(args[0])) {
            int port = args.length > 1 ? Integer.parseInt(args[1]) : 29123;
            try {
                Server.serve(port);
            } catch (java.net.BindException busy) {
                // A second copy (a login item plus a manual start) is harmless: the app
                // only talks to the port.
                System.err.println("[host] 端口 " + port + " 已经被另一个 spider-host 占用，本进程退出。");
                System.exit(0);
            }
            return;
        }
        ExecutorService workers = Executors.newFixedThreadPool(THREADS);
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        OUT.println("{\"ready\":true}");
        String line;
        while ((line = in.readLine()) != null) {
            String request = line.trim();
            if (request.isEmpty()) continue;
            if (request.contains("\"op\":\"shutdown\"")) break;
            workers.submit(() -> OUT.println(handle(request)));
        }
        // Let the requests already read finish: the app closes stdin when it stops.
        workers.shutdown();
        if (!workers.awaitTermination(5, java.util.concurrent.TimeUnit.MINUTES)) workers.shutdownNow();
        OUT.flush();
        System.exit(0);
    }

    /** Answers one request line; the HTTP server and stdin both go through here. */
    static String handle(String line) {
        long id = -1;
        try {
            JSONObject request = new JSONObject(line);
            id = request.optLong("id", -1);
            String op = request.optString("op", "");
            Object result = dispatch(op, request);
            JSONObject response = new JSONObject();
            response.put("id", id);
            response.put("ok", true);
            if (result != null) response.put("result", result);
            return response.toString();
        } catch (Throwable error) {
            Throwable root = root(error);
            if (Boolean.getBoolean("tvgo.spider.trace")) root.printStackTrace(System.err);
            String message = root.getClass().getSimpleName()
                    + (root.getMessage() == null ? "" : ": " + root.getMessage());
            JSONObject response = new JSONObject();
            try {
                response.put("id", id);
                response.put("ok", false);
                response.put("error", message.replace('\n', ' '));
            } catch (org.json.JSONException impossible) {
                // A string-only object cannot fail to hold three strings.
            }
            return response.toString();
        }
    }

    private static Object dispatch(String op, JSONObject request) throws Exception {
        if ("ping".equals(op)) return "pong";
        if ("info".equals(op)) {
            JSONObject info = new JSONObject();
            info.put("java", System.getProperty("java.version"));
            info.put("spiders", SPIDERS.size());
            return info.toString();
        }
        Spider spider = spider(request);
        switch (op) {
            case "home": {
                boolean filter = request.optBoolean("filter", true);
                return text(spider.homeContent(filter));
            }
            case "video":
                return text(spider.homeVideoContent());
            case "category": {
                String tid = request.optString("tid", "");
                String pg = request.optString("pg", "1");
                boolean filter = request.optBoolean("filter", false);
                HashMap<String, String> extend = new HashMap<>();
                JSONObject extras = request.optJSONObject("extend");
                if (extras != null) {
                    java.util.Iterator<String> keys = extras.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        extend.put(key, extras.optString(key));
                    }
                }
                return text(spider.categoryContent(tid, pg, filter, extend));
            }
            case "detail": {
                List<String> ids = strings(request.optJSONArray("ids"));
                if (ids.isEmpty()) ids = List.of(request.optString("id", ""));
                return text(spider.detailContent(ids));
            }
            case "search": {
                String key = request.optString("key", "");
                boolean quick = request.optBoolean("quick", false);
                String pg = request.optString("pg", "");
                return text(pg.isEmpty() ? spider.searchContent(key, quick) : spider.searchContent(key, quick, pg));
            }
            case "player": {
                String flag = request.optString("flag", "");
                String video = request.optString("vid", request.optString("id", ""));
                List<String> vip = strings(request.optJSONArray("vip"));
                return text(spider.playerContent(flag, video, vip));
            }
            case "live":
                return text(spider.liveContent(request.optString("url", "")));
            case "proxy": {
                Map<String, String> params = new HashMap<>();
                JSONObject given = request.optJSONObject("params");
                if (given != null) {
                    java.util.Iterator<String> keys = given.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        params.put(key, given.optString(key));
                    }
                }
                Object[] result = spider.proxy(params);
                return result == null ? "null" : new JSONObject().put("proxy", result.length).toString();
            }
            default:
                throw new IllegalArgumentException("未知操作：" + op);
        }
    }

    /** The spider for this request, initialised once per (jar, api, ext). */
    private static Spider spider(JSONObject request) throws Exception {
        String jar = request.getString("jar");
        String api = request.getString("api");
        String ext = request.optString("ext", "");
        String key = jar + "|" + api + "|" + ext;
        Spider cached = SPIDERS.get(key);
        if (cached != null) return cached;
        ClassLoader loader = payloads.loaderFor(jar);
        // A payload that carries CatVodSpider's own Init wants it initialised with a
        // context; the class is the payload's, so it is called reflectively after load.
        initPayload(loader);
        String className = "com.github.catvod.spider." + api.replaceFirst("(?i)^csp_", "");
        Class<?> type = loader.loadClass(className);
        Spider spider = (Spider) type.getDeclaredConstructor().newInstance();
        spider.siteKey = request.optString("siteKey", "");
        synchronized (SPIDERS) {
            Spider raced = SPIDERS.get(key);
            if (raced != null) return raced;
            spider.init(android.app.Application.get(), ext);
            SPIDERS.put(key, spider);
            return spider;
        }
    }

    private static void initPayload(ClassLoader loader) {
        try {
            Class<?> init = loader.loadClass("com.github.catvod.spider.Init");
            java.lang.reflect.Method method = init.getMethod("init", android.content.Context.class);
            // CatVodSpider's Init is Android bookkeeping: it chmods its own config file and
            // starts keep-alive services. On a desktop that fails and the payload prints a
            // stack trace; the context it needs is already set, so the trace is noise.
            java.io.PrintStream stderr = System.err;
            System.setErr(QUIET);
            try {
                method.invoke(null, android.app.Application.get());
            } catch (java.lang.reflect.InvocationTargetException expected) {
                PrintStream out = stderr;
                Throwable cause = root(expected);
                out.println("[host] payload Init 跳过 Android 专有的收尾（chmod/常驻服务）："
                        + cause.getClass().getSimpleName()
                        + (cause.getMessage() == null ? "" : ": " + cause.getMessage()));
            } finally {
                System.setErr(stderr);
            }
        } catch (ClassNotFoundException absent) {
            // A payload without CatVodSpider's Init needs no context of its own.
        } catch (ReflectiveOperationException failed) {
            System.err.println("[host] payload Init did not take a context: " + failed);
        }
    }

    private static String text(String value) {
        return value == null ? "{}" : value;
    }

    private static List<String> strings(org.json.JSONArray array) {
        List<String> values = new ArrayList<>();
        if (array == null) return values;
        for (int index = 0; index < array.length(); index += 1) values.add(array.optString(index, ""));
        return values;
    }

    private static Throwable root(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null && current.getCause() != current) current = current.getCause();
        return current;
    }

    private Main() {
    }
}
