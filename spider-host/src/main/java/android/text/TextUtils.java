// The handful of android.text.TextUtils calls payloads make, implemented rather
// than left as the SDK's "Stub!" bodies.
package android.text;

public final class TextUtils {
    private TextUtils() {
    }

    public static boolean isEmpty(CharSequence text) {
        return text == null || text.length() == 0;
    }

    public static boolean equals(CharSequence a, CharSequence b) {
        if (a == b) return true;
        if (a == null || b == null) return false;
        int length = a.length();
        if (length != b.length()) return false;
        for (int i = 0; i < length; i += 1) if (a.charAt(i) != b.charAt(i)) return false;
        return true;
    }

    public static String join(CharSequence delimiter, Iterable<?> tokens) {
        StringBuilder out = new StringBuilder();
        boolean first = true;
        for (Object token : tokens) {
            if (!first) out.append(delimiter);
            out.append(token);
            first = false;
        }
        return out.toString();
    }

    public static String join(CharSequence delimiter, Object[] tokens) {
        return join(delimiter, java.util.Arrays.asList(tokens));
    }

    public static String[] split(String text, String expression) {
        return text.split(expression);
    }

    public static boolean isDigitsOnly(CharSequence text) {
        if (text == null) return false;
        for (int i = 0; i < text.length(); i += 1) if (!Character.isDigit(text.charAt(i))) return false;
        return true;
    }
}
