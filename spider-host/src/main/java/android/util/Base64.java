package android.util;

/** Base64 with the flags Android's callers pass. */
public final class Base64 {
    public static final int DEFAULT = 0;
    public static final int NO_PADDING = 1;
    public static final int NO_WRAP = 2;
    public static final int CRLF = 4;
    public static final int URL_SAFE = 8;
    public static final int NO_CLOSE = 16;

    private static final char[] STANDARD =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".toCharArray();
    private static final char[] URL =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".toCharArray();

    private Base64() {
    }

    public static byte[] encode(byte[] input, int flags) {
        return encodeToString(input, flags).getBytes(java.nio.charset.StandardCharsets.US_ASCII);
    }

    public static String encodeToString(byte[] input, int flags) {
        char[] alphabet = (flags & URL_SAFE) != 0 ? URL : STANDARD;
        StringBuilder out = new StringBuilder();
        for (int index = 0; index < input.length; index += 3) {
            int a = input[index] & 0xff;
            int b = index + 1 < input.length ? input[index + 1] & 0xff : 0;
            int c = index + 2 < input.length ? input[index + 2] & 0xff : 0;
            out.append(alphabet[a >>> 2]);
            out.append(alphabet[((a & 0x03) << 4) | (b >>> 4)]);
            if (index + 1 < input.length) out.append(alphabet[((b & 0x0f) << 2) | (c >>> 6)]);
            else if ((flags & NO_PADDING) == 0) out.append('=');
            if (index + 2 < input.length) out.append(alphabet[c & 0x3f]);
            else if ((flags & NO_PADDING) == 0) out.append('=');
        }
        return out.toString();
    }

    public static byte[] decode(String input, int flags) {
        return decode(input.getBytes(java.nio.charset.StandardCharsets.US_ASCII), flags);
    }

    public static byte[] decode(byte[] input, int flags) {
        StringBuilder cleaned = new StringBuilder(input.length);
        for (byte value : input) {
            char c = (char) (value & 0xff);
            if (c == '=' || c == '\n' || c == '\r' || c == ' ' || c == '\t') continue;
            cleaned.append(c);
        }
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        int buffer = 0;
        int bits = 0;
        for (int index = 0; index < cleaned.length(); index += 1) {
            int digit = digit(cleaned.charAt(index));
            if (digit < 0) continue;
            buffer = (buffer << 6) | digit;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                out.write((buffer >>> bits) & 0xff);
            }
        }
        return out.toByteArray();
    }

    private static int digit(char c) {
        if (c >= 'A' && c <= 'Z') return c - 'A';
        if (c >= 'a' && c <= 'z') return c - 'a' + 26;
        if (c >= '0' && c <= '9') return c - '0' + 52;
        if (c == '+' || c == '-') return 62;
        if (c == '/' || c == '_') return 63;
        return -1;
    }
}
