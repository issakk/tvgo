package android.widget;

import android.content.Context;

/** A toast that shows nothing: payloads use it to report a failure a desktop has no tray for. */
public class Toast {
    public static final int LENGTH_SHORT = 0;
    public static final int LENGTH_LONG = 1;

    private CharSequence text;

    public static Toast makeText(Context context, CharSequence text, int duration) {
        Toast toast = new Toast();
        toast.text = text;
        return toast;
    }

    public static Toast makeText(Context context, int resourceId, int duration) {
        return new Toast();
    }

    public void show() {
        if (text != null) System.err.println("[payload] " + text);
    }

    public void cancel() {
    }

    public void setText(CharSequence value) {
        text = value;
    }
}
