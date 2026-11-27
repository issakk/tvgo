package android.os;

/** A message, for payloads that post what they handle through a Handler. */
public final class Message {
    public int what;
    public int arg1;
    public int arg2;
    public Object obj;
    public long when;
    public Handler target;
    public Runnable callback;

    public Message() {
    }

    public static Message obtain() {
        return new Message();
    }

    public static Message obtain(Handler handler) {
        Message message = new Message();
        message.target = handler;
        return message;
    }

    public static Message obtain(Handler handler, int what) {
        Message message = obtain(handler);
        message.what = what;
        return message;
    }

    public void sendToTarget() {
        if (target != null) target.sendMessage(this);
    }

    public void recycle() {
    }

    @Override
    public String toString() {
        return "Message{what=" + what + "}";
    }
}
