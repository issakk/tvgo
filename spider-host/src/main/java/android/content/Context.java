// A desktop stand-in for android.content.Context: the few things payloads touch
// (a data directory, preferences) without a real Android runtime.
package android.content;

import java.io.File;

public class Context {
    private static final Context INSTANCE = new Context();
    private final File root;

    protected Context() {
        this.root = new File(System.getProperty("tvgo.spider.data", "spider-data"));
    }

    public static Context get() {
        return INSTANCE;
    }

    public Context getApplicationContext() {
        // Payloads cast this to android.app.Application, so it must be that instance.
        return android.app.Application.get();
    }

    public String getPackageName() {
        return "dev.tvgo.desktop";
    }

    public File getFilesDir() {
        return dir("files");
    }

    public File getCacheDir() {
        return dir("cache");
    }

    public File getDir(String name, int mode) {
        return dir(name);
    }

    public File getExternalFilesDir(String type) {
        return dir(type == null ? "external" : "external/" + type);
    }

    public File getExternalCacheDir() {
        return dir("external-cache");
    }

    public SharedPreferences getSharedPreferences(String name, int mode) {
        return new SharedPreferences(new File(dir("prefs"), name + ".json"));
    }

    public static final String CONNECTIVITY_SERVICE = "connectivity";

    public Object getSystemService(String name) {
        if (CONNECTIVITY_SERVICE.equals(name)) return new android.net.ConnectivityManager();
        return null;
    }

    public int checkCallingOrSelfPermission(String permission) {
        return 0;
    }

    public int checkPermission(String permission, int pid, int uid) {
        return 0;
    }

    public int checkSelfPermission(String permission) {
        return 0;
    }

    public ContentResolver getContentResolver() {
        return null;
    }

    public android.content.pm.PackageManager getPackageManager() {
        return null;
    }

    public android.content.res.Resources getResources() {
        return null;
    }

    public android.content.res.AssetManager getAssets() {
        return null;
    }

    public void startActivity(Intent intent) {
    }

    private File dir(String name) {
        File file = new File(root, name);
        //noinspection ResultOfMethodCallIgnored
        file.mkdirs();
        return file;
    }
}
