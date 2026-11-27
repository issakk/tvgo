// Handler on top of the host's Looper: posts run immediately on the calling thread, so
// a payload's Init.run(...) work happens without the payload having to pump a queue.
package android.os;

public class Handler {
    private final Looper looper;

    public interface Callback {
        boolean handleMessage(Message message);
    }

    public Handler() {
        this(Looper.getMainLooper());
    }

    public Handler(Looper looper) {
        this.looper = looper == null ? Looper.getMainLooper() : looper;
    }

    public Handler(Looper looper, Callback callback) {
        this(looper);
    }

    public Looper getLooper() {
        return looper;
    }

    public boolean post(Runnable action) {
        action.run();
        return true;
    }

    public boolean postDelayed(Runnable action, long delayMillis) {
        action.run();
        return true;
    }

    public void removeCallbacks(Runnable action) {
    }

    public void removeCallbacksAndMessages(Object token) {
    }

    public Message obtainMessage() {
        return new Message();
    }

    public Message obtainMessage(int what) {
        Message message = new Message();
        message.what = what;
        return message;
    }

    public Message obtainMessage(int what, Object object) {
        Message message = obtainMessage(what);
        message.obj = object;
        return message;
    }

    public boolean sendMessage(Message message) {
        if (message.callback != null) message.callback.run();
        else handleMessage(message);
        return true;
    }

    public boolean sendEmptyMessage(int what) {
        return sendMessage(obtainMessage(what));
    }

    public boolean sendMessageDelayed(Message message, long delayMillis) {
        return sendMessage(message);
    }

    public void handleMessage(Message message) {
    }

    public void dispatchMessage(Message message) {
        if (message.callback != null) message.callback.run();
        else handleMessage(message);
    }
}
