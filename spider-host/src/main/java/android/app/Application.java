package android.app;

import java.util.ArrayList;
import java.util.List;

/** The application singleton payloads reach for through com.github.catvod.spider.Init. */
public class Application extends android.content.Context {
    private static final Application INSTANCE = new Application();
    private final List<ActivityLifecycleCallbacks> lifecycle = new ArrayList<>();

    public Application() {
        super();
    }

    public static Application get() {
        return INSTANCE;
    }

    /** Android's activity lifecycle callbacks: registered, never called on a desktop. */
    public interface ActivityLifecycleCallbacks {
        void onActivityCreated(Activity activity, android.os.Bundle savedInstanceState);

        void onActivityStarted(Activity activity);

        void onActivityResumed(Activity activity);

        void onActivityPaused(Activity activity);

        void onActivityStopped(Activity activity);

        void onActivitySaveInstanceState(Activity activity, android.os.Bundle outState);

        void onActivityDestroyed(Activity activity);
    }

    public void registerActivityLifecycleCallbacks(ActivityLifecycleCallbacks callbacks) {
        if (callbacks != null) lifecycle.add(callbacks);
    }

    public void unregisterActivityLifecycleCallbacks(ActivityLifecycleCallbacks callbacks) {
        lifecycle.remove(callbacks);
    }
}
