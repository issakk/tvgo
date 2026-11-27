// The main looper: one per process, and every Handler posts onto it. Here it runs
// whatever it is handed straight away, which is what a payload's fire-and-forget
// bookkeeping expects on a desktop.
package android.os;

public final class Looper {
    private static final Looper MAIN = new Looper();

    private Looper() {
    }

    public static Looper getMainLooper() {
        return MAIN;
    }

    public static Looper myLooper() {
        return MAIN;
    }

    public static void prepare() {
    }

    public static void prepareMainLooper() {
    }

    public static void loop() {
    }

    public Thread getThread() {
        return Thread.currentThread();
    }

    public void quit() {
    }

    public void quitSafely() {
    }
}
