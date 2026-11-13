package app.paygauge.mobile;

import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Receives the app's "what's left" summary and redraws the home-screen widget. */
@CapacitorPlugin(name = "TallyWidget")
public class TallyWidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        String snapshot = call.getString("snapshot");
        if (snapshot == null) {
            call.reject("snapshot is required");
            return;
        }
        Context context = getContext();
        context.getSharedPreferences(TallyWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(TallyWidgetProvider.KEY_SNAPSHOT, snapshot)
            .apply();
        TallyWidgetProvider.updateAll(context);
        call.resolve();
    }
}
