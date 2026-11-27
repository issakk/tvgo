package android.os;

/** Monotonic clocks: a desktop has no uptime, so these are wall-clock based stand-ins. */
public final class SystemClock {
    private SystemClock() {
    }

    public static long uptimeMillis() {
        return System.nanoTime() / 1_000_000L;
    }

    public static long elapsedRealtime() {
        return uptimeMillis();
    }

    public static long currentThreadTimeMillis() {
        return System.nanoTime() / 1_000_000L;
    }

    public static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
    }
}
