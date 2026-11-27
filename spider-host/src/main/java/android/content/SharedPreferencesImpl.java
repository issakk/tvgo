// The interface's implementation: one JSON file per preference set under the host's data
// directory, so a payload's token or cookie survives a restart.
package android.content;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

final class SharedPreferencesImpl implements SharedPreferences {
    private final File file;
    private final Map<String, OnSharedPreferenceChangeListener> listeners = new HashMap<>();
    private JSONObject values;

    SharedPreferencesImpl(File file) {
        this.file = file;
        this.values = read();
    }

    @Override
    public Map<String, ?> getAll() {
        Map<String, Object> all = new HashMap<>();
        java.util.Iterator<String> keys = values.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            Object value = values.opt(key);
            all.put(key, value instanceof JSONArray ? toSet((JSONArray) value) : value);
        }
        return all;
    }

    @Override
    public String getString(String key, String defValue) {
        Object value = values.opt(key);
        return value == null || value == JSONObject.NULL ? defValue : String.valueOf(value);
    }

    @Override
    public Set<String> getStringSet(String key, Set<String> defValues) {
        Object value = values.opt(key);
        return value instanceof JSONArray ? toSet((JSONArray) value) : defValues;
    }

    @Override
    public int getInt(String key, int defValue) {
        return values.optInt(key, defValue);
    }

    @Override
    public long getLong(String key, long defValue) {
        return values.optLong(key, defValue);
    }

    @Override
    public float getFloat(String key, float defValue) {
        Object value = values.opt(key);
        return value instanceof Number ? ((Number) value).floatValue() : defValue;
    }

    @Override
    public boolean getBoolean(String key, boolean defValue) {
        return values.optBoolean(key, defValue);
    }

    @Override
    public boolean contains(String key) {
        return values.has(key);
    }

    @Override
    public Editor edit() {
        return new EditorImpl();
    }

    @Override
    public void registerOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener) {
        if (listener != null) listeners.put(String.valueOf(System.identityHashCode(listener)), listener);
    }

    @Override
    public void unregisterOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener listener) {
        if (listener != null) listeners.remove(String.valueOf(System.identityHashCode(listener)));
    }

    private void notifyChanged(Set<String> changed) {
        for (String key : changed) {
            for (OnSharedPreferenceChangeListener listener : new HashSet<>(listeners.values())) {
                try {
                    listener.onSharedPreferenceChanged(this, key);
                } catch (RuntimeException ignored) {
                    // A payload listener that throws must not break the write.
                }
            }
        }
    }

    private final class EditorImpl implements Editor {
        private final Map<String, Object> pending = new HashMap<>();

        @Override
        public Editor putString(String key, String value) {
            pending.put(key, value);
            return this;
        }

        @Override
        public Editor putStringSet(String key, Set<String> values) {
            pending.put(key, values == null ? null : new JSONArray(values));
            return this;
        }

        @Override
        public Editor putInt(String key, int value) {
            pending.put(key, value);
            return this;
        }

        @Override
        public Editor putLong(String key, long value) {
            pending.put(key, value);
            return this;
        }

        @Override
        public Editor putFloat(String key, float value) {
            pending.put(key, value);
            return this;
        }

        @Override
        public Editor putBoolean(String key, boolean value) {
            pending.put(key, value);
            return this;
        }

        @Override
        public Editor remove(String key) {
            pending.put(key, null);
            return this;
        }

        @Override
        public Editor clear() {
            pending.clear();
            values = new JSONObject();
            java.util.Iterator<String> keys = values.keys();
            while (keys.hasNext()) pending.put(keys.next(), null);
            return this;
        }

        @Override
        public boolean commit() {
            Set<String> changed = new HashSet<>(pending.keySet());
            try {
                for (Map.Entry<String, Object> entry : pending.entrySet()) {
                    String key = entry.getKey();
                    Object value = entry.getValue();
                    if (value == null) values.remove(key);
                    else values.put(key, value);
                }
                file.getParentFile().mkdirs();
                Files.write(file.toPath(), values.toString().getBytes(StandardCharsets.UTF_8));
            } catch (IOException | org.json.JSONException error) {
                return false;
            }
            notifyChanged(changed);
            return true;
        }

        @Override
        public void apply() {
            commit();
        }
    }

    private JSONObject read() {
        try {
            if (file.isFile()) return new JSONObject(Files.readString(file.toPath(), StandardCharsets.UTF_8));
        } catch (IOException | org.json.JSONException ignored) {
            // A corrupt or unreadable preference file starts empty.
        }
        return new JSONObject();
    }

    private static Set<String> toSet(JSONArray array) {
        Set<String> set = new java.util.LinkedHashSet<>();
        for (int index = 0; index < array.length(); index += 1) set.add(array.optString(index, ""));
        return set;
    }
}
