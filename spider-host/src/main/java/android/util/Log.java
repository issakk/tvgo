package android.util;

/** Logcat, redirected to the host's stderr so a failing payload can be read. */
public final class Log {
    public static final int VERBOSE = 2;
    public static final int DEBUG = 3;
    public static final int INFO = 4;
    public static final int WARN = 5;
    public static final int ERROR = 6;
    public static final int ASSERT = 7;

    private static volatile boolean quiet = !Boolean.getBoolean("tvgo.spider.log");

    private Log() {
    }

    public static int v(String tag, String message) {
        return print("V", tag, message);
    }

    public static int d(String tag, String message) {
        return print("D", tag, message);
    }

    public static int i(String tag, String message) {
        return print("I", tag, message);
    }

    public static int w(String tag, String message) {
        return print("W", tag, message);
    }

    public static int e(String tag, String message) {
        return print("E", tag, message);
    }

    public static int e(String tag, String message, Throwable error) {
        print("E", tag, message + " " + getStackTraceString(error));
        return 0;
    }

    public static int w(String tag, String message, Throwable error) {
        print("W", tag, message + " " + getStackTraceString(error));
        return 0;
    }

    public static int w(String tag, Throwable error) {
        return e(tag, "", error);
    }

    public static int d(String tag, String message, Throwable error) {
        print("D", tag, message + " " + getStackTraceString(error));
        return 0;
    }

    public static String getStackTraceString(Throwable error) {
        if (error == null) return "";
        java.io.StringWriter writer = new java.io.StringWriter();
        error.printStackTrace(new java.io.PrintWriter(writer));
        return writer.toString();
    }

    public static boolean isLoggable(String tag, int level) {
        return !quiet;
    }

    private static int print(String level, String tag, String message) {
        if (!quiet) System.err.println("[" + level + "/" + tag + "] " + message);
        return 0;
    }
}
