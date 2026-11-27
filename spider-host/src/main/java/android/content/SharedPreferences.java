// File-backed preferences: enough for payloads that remember a token or a cookie.
package android.content;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;

public class SharedPreferences {
    private final File file;
    private JSONObject values;

    SharedPreferences(File file) {
        this.file = file;
        this.values = read();
    }

    public String getString(String key, String fallback) {
        return values.optString(key, fallback);
    }

    public boolean getBoolean(String key, boolean fallback) {
        return values.optBoolean(key, fallback);
    }

    public int getInt(String key, int fallback) {
        return values.optInt(key, fallback);
    }

    public long getLong(String key, long fallback) {
        return values.optLong(key, fallback);
    }

    public Map<String, ?> getAll() {
        Map<String, Object> all = new HashMap<>();
        java.util.Iterator<String> keys = values.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            all.put(key, values.opt(key));
        }
        return all;
    }

    public boolean contains(String key) {
        return values.has(key);
    }

    public Editor edit() {
        return new Editor();
    }

    public final class Editor {
        private final Map<String, Object> pending = new HashMap<>();

        public Editor putString(String key, String value) {
            pending.put(key, value);
            return this;
        }

        public Editor putBoolean(String key, boolean value) {
            pending.put(key, value);
            return this;
        }

        public Editor putInt(String key, int value) {
            pending.put(key, value);
            return this;
        }

        public Editor putLong(String key, long value) {
            pending.put(key, value);
            return this;
        }

        public Editor remove(String key) {
            pending.put(key, null);
            return this;
        }

        public Editor clear() {
            values = new JSONObject();
            return this;
        }

        public void apply() {
            commit();
        }

        public boolean commit() {
            try {
                for (Map.Entry<String, Object> entry : pending.entrySet()) {
                    if (entry.getValue() == null) values.remove(entry.getKey());
                    else values.put(entry.getKey(), entry.getValue());
                }
                file.getParentFile().mkdirs();
                Files.write(file.toPath(), values.toString().getBytes(StandardCharsets.UTF_8));
                return true;
            } catch (IOException | org.json.JSONException | RuntimeException error) {
                return false;
            }
        }
    }

    private JSONObject read() {
        try {
            if (file.isFile()) return new JSONObject(Files.readString(file.toPath(), StandardCharsets.UTF_8));
        } catch (IOException | org.json.JSONException | RuntimeException ignored) {
            // A corrupt or unreadable preference file starts empty.
        }
        return new JSONObject();
    }
}
