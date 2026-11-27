package android.app;

/** The application singleton payloads reach for through com.github.catvod.spider.Init. */
public class Application extends android.content.Context {
    private static final Application INSTANCE = new Application();

    public Application() {
        super();
    }

    public static Application get() {
        return INSTANCE;
    }
}
