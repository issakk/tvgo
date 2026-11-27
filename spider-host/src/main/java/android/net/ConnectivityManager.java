package android.net;

/** ConnectivityManager with the one answer payloads need: online. */
public class ConnectivityManager {
    public static final int TYPE_MOBILE = 0;
    public static final int TYPE_WIFI = 1;
    public static final int TYPE_ETHERNET = 9;
    public static final String CONNECTIVITY_ACTION = "android.net.conn.CONNECTIVITY_CHANGE";

    private static final NetworkInfo ONLINE = new NetworkInfo();

    public NetworkInfo getActiveNetworkInfo() {
        return ONLINE;
    }

    public NetworkInfo getNetworkInfo(int type) {
        return ONLINE;
    }

    public boolean isActiveNetworkMetered() {
        return false;
    }

    public NetworkInfo[] getAllNetworkInfo() {
        return new NetworkInfo[]{ONLINE};
    }
}
