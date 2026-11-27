package android.net;

/** The network state payloads check before making calls: a desktop is always online. */
public class NetworkInfo {
    public boolean isConnected() {
        return true;
    }

    public boolean isAvailable() {
        return true;
    }

    public boolean isRoaming() {
        return false;
    }

    public int getType() {
        return ConnectivityManager.TYPE_WIFI;
    }

    public String getTypeName() {
        return "WIFI";
    }

    public State getState() {
        return State.CONNECTED;
    }

    public String getExtraInfo() {
        return null;
    }

    public String getReason() {
        return null;
    }

    public enum State {
        CONNECTED,
        CONNECTING,
        DISCONNECTED,
        DISCONNECTING,
        SUSPENDED,
        UNKNOWN
    }
}
