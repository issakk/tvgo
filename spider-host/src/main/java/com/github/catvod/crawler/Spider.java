// The CatVod spider contract, as a payload expects to find it on the host.
// Signatures match what CatVodSpider subclasses override in the jar.
package com.github.catvod.crawler;

import android.content.Context;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Spider {
    /** The key the configuration gives this site; the host sets it before init. */
    public String siteKey = "";

    /** The DNS resolver payloads borrow for their own clients. */
    public static okhttp3.Dns safeDns() {
        return okhttp3.Dns.SYSTEM;
    }

    /** A shared client, for payloads that ask the host for one. */
    public static okhttp3.OkHttpClient client() {
        return SharedClient.CLIENT;
    }

    private static final class SharedClient {
        static final okhttp3.OkHttpClient CLIENT = new okhttp3.OkHttpClient.Builder()
                .connectTimeout(java.time.Duration.ofSeconds(15))
                .readTimeout(java.time.Duration.ofSeconds(20))
                .build();
    }

    public String getExt() {
        return "";
    }

    public String getApi() {
        return "";
    }

    public void init(Context context) throws Exception {
    }

    public void init(Context context, String extend) throws Exception {
        init(context);
    }

    public String homeContent(boolean filter) throws Exception {
        return "{}";
    }

    public String homeVideoContent() throws Exception {
        return "{}";
    }

    public String categoryContent(String tid, String pg, boolean filter, HashMap<String, String> extend)
            throws Exception {
        return "{}";
    }

    public String detailContent(List<String> ids) throws Exception {
        return "{}";
    }

    public String searchContent(String key, boolean quick) throws Exception {
        return "{}";
    }

    public String searchContent(String key, boolean quick, String pg) throws Exception {
        return searchContent(key, quick);
    }

    public String playerContent(String flag, String id, List<String> vipFlags) throws Exception {
        return "{}";
    }

    public String liveContent(String url) throws Exception {
        return "{}";
    }

    public boolean manualVideoCheck() throws Exception {
        return false;
    }

    public boolean isVideoFormat(String url) throws Exception {
        return false;
    }

    public Object[] proxy(Map<String, String> params) throws Exception {
        return null;
    }

    /** The URL a payload should put in front of its own proxy paths. */
    public String proxyUrl(Map<String, String> params) {
        return "";
    }
}
