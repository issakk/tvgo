package android.app;

import android.content.Intent;

/** An activity with no window: payloads only reach for it to ask about permissions. */
public class Activity extends android.content.Context {
    private Intent intent;

    public Intent getIntent() {
        return intent;
    }

    public void setIntent(Intent value) {
        intent = value;
    }

    public void runOnUiThread(Runnable action) {
        action.run();
    }

    public int checkSelfPermission(String permission) {
        return 0;
    }

    public void requestPermissions(String[] permissions, int requestCode) {
    }

    public boolean shouldShowRequestPermissionRationale(String permission) {
        return false;
    }

    public Object findViewById(int id) {
        return null;
    }

    public void finish() {
    }

    public void setResult(int resultCode) {
    }

    public boolean isFinishing() {
        return false;
    }

    public android.content.ComponentName getComponentName() {
        return null;
    }

    public void startActivityForResult(Intent value, int requestCode) {
    }
}
