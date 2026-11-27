// android.net.Uri, implemented over java.net.URI/URLDecoder so payloads that parse
// or build query strings work instead of hitting the SDK's "Stub!" bodies.
package android.net;

import java.io.File;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class Uri {
    private final String raw;

    private Uri(String raw) {
        this.raw = raw;
    }

    public static Uri parse(String uri) {
        return new Uri(uri == null ? "" : uri);
    }

    public static Uri fromFile(File file) {
        return new Uri(file.toURI().toString());
    }

    public static String encode(String text) {
        try {
            return URLEncoder.encode(text, "UTF-8").replace("+", "%20");
        } catch (UnsupportedEncodingException impossible) {
            return text;
        }
    }

    public static String encode(String text, String allow) {
        String encoded = encode(text);
        if (allow == null) return encoded;
        StringBuilder out = new StringBuilder(encoded.length());
        for (int index = 0; index < encoded.length(); index += 1) {
            char c = encoded.charAt(index);
            if (c == '%' && index + 2 < encoded.length()) {
                String hex = encoded.substring(index + 1, index + 3);
                char plain = (char) Integer.parseInt(hex, 16);
                if (allow.indexOf(plain) >= 0) {
                    out.append(plain);
                    index += 2;
                    continue;
                }
            }
            out.append(c);
        }
        return out.toString();
    }

    public static String decode(String text) {
        try {
            return URLDecoder.decode(text, "UTF-8");
        } catch (UnsupportedEncodingException | IllegalArgumentException impossible) {
            return text;
        }
    }

    public String getScheme() {
        int colon = raw.indexOf(':');
        return colon <= 0 ? null : raw.substring(0, colon);
    }

    public String getAuthority() {
        int start = authorityStart();
        if (start < 0) return null;
        int end = raw.indexOf('/', start);
        int query = raw.indexOf('?', start);
        int fragment = raw.indexOf('#', start);
        if (end < 0 || (query >= 0 && query < end)) end = query;
        if (end < 0 || (fragment >= 0 && fragment < end)) end = fragment;
        if (end < 0) end = raw.length();
        return raw.substring(start, end);
    }

    public String getHost() {
        String authority = getAuthority();
        if (authority == null) return null;
        int at = authority.lastIndexOf('@');
        if (at >= 0) authority = authority.substring(at + 1);
        int colon = authority.indexOf(':');
        return colon < 0 ? authority : authority.substring(0, colon);
    }

    public int getPort() {
        String authority = getAuthority();
        if (authority == null) return -1;
        int colon = authority.lastIndexOf(':');
        if (colon < 0) return -1;
        try {
            return Integer.parseInt(authority.substring(colon + 1));
        } catch (NumberFormatException notAPort) {
            return -1;
        }
    }

    public String getPath() {
        int start = raw.indexOf('/', authorityStart() < 0 ? 0 : authorityStart());
        if (start < 0) return "";
        int end = raw.length();
        int query = raw.indexOf('?', start);
        int fragment = raw.indexOf('#', start);
        if (query >= 0) end = Math.min(end, query);
        if (fragment >= 0) end = Math.min(end, fragment);
        return raw.substring(start, end);
    }

    public List<String> getPathSegments() {
        List<String> segments = new ArrayList<>();
        for (String segment : getPath().split("/")) if (!segment.isEmpty()) segments.add(segment);
        return segments;
    }

    public String getLastPathSegment() {
        List<String> segments = getPathSegments();
        return segments.isEmpty() ? null : segments.get(segments.size() - 1);
    }

    public String getQuery() {
        int at = raw.indexOf('?');
        if (at < 0) return null;
        int fragment = raw.indexOf('#', at);
        return fragment < 0 ? raw.substring(at + 1) : raw.substring(at + 1, fragment);
    }

    public String getQueryParameter(String key) {
        List<String> values = getQueryParameters(key);
        return values.isEmpty() ? null : values.get(0);
    }

    public List<String> getQueryParameters(String key) {
        List<String> values = new ArrayList<>();
        String query = getQuery();
        if (query == null) return values;
        for (String pair : query.split("&")) {
            int equals = pair.indexOf('=');
            String name = decode(equals < 0 ? pair : pair.substring(0, equals));
            if (!name.equals(key)) continue;
            values.add(equals < 0 ? "" : decode(pair.substring(equals + 1)));
        }
        return values;
    }

    public Builder buildUpon() {
        Builder builder = new Builder();
        builder.scheme = getScheme();
        builder.authority = getAuthority();
        builder.path = getPath();
        String query = getQuery();
        if (query != null) {
            for (String pair : query.split("&")) {
                if (pair.isEmpty()) continue;
                int equals = pair.indexOf('=');
                builder.queries.add(equals < 0
                        ? new String[]{decode(pair), ""}
                        : new String[]{decode(pair.substring(0, equals)), decode(pair.substring(equals + 1))});
            }
        }
        return builder;
    }

    @Override
    public String toString() {
        return raw;
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof Uri && ((Uri) other).raw.equals(raw);
    }

    @Override
    public int hashCode() {
        return raw.hashCode();
    }

    private int authorityStart() {
        int scheme = raw.indexOf("://");
        return scheme < 0 ? -1 : scheme + 3;
    }

    /** A small builder: scheme, authority, path and query parameters. */
    public static final class Builder {
        private String scheme;
        private String authority;
        private String path = "";
        private final List<String[]> queries = new ArrayList<>();

        public Builder scheme(String value) {
            scheme = value;
            return this;
        }

        public Builder authority(String value) {
            authority = value;
            return this;
        }

        public Builder path(String value) {
            path = value;
            return this;
        }

        public Builder appendPath(String value) {
            path = path.endsWith("/") ? path + value : path + "/" + value;
            return this;
        }

        public Builder appendQueryParameter(String key, String value) {
            queries.add(new String[]{key, value});
            return this;
        }

        public Uri build() {
            StringBuilder out = new StringBuilder();
            if (scheme != null) out.append(scheme).append("://");
            if (authority != null) out.append(authority);
            out.append(path);
            if (!queries.isEmpty()) {
                out.append('?');
                boolean first = true;
                Map<String, String> sorted = new LinkedHashMap<>();
                for (String[] query : queries) sorted.put(query[0], query[1]);
                for (Map.Entry<String, String> entry : sorted.entrySet()) {
                    if (!first) out.append('&');
                    out.append(encode(entry.getKey())).append('=').append(encode(entry.getValue()));
                    first = false;
                }
            }
            return new Uri(out.toString());
        }
    }

}
