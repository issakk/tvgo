package com.github.catvod.crawler;

/** Payload logging, as CatVodSpider calls it. */
public final class SpiderDebug {
    private static volatile boolean enabled = Boolean.getBoolean("tvgo.spider.log");

    private SpiderDebug() {
    }

    public static void log(String message) {
        if (enabled) System.err.println("[spider] " + message);
    }

    public static void log(String tag, String message) {
        if (enabled) System.err.println("[spider/" + tag + "] " + message);
    }

    public static void log(Throwable error) {
        if (enabled && error != null) {
            System.err.println("[spider] " + error);
            error.printStackTrace(System.err);
        }
    }
}
