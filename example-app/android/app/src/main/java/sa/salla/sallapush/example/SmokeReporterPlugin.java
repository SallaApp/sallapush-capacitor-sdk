package sa.salla.sallapush.example;

import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The example's test hook for the smoke tests; never part of the library or of an app. JavaScript's
 * SmokeReporter.report({ line }) writes a self-test line to Logcat (tag SallaPushSmoke), where the smoke tests read it:
 * release builds don't forward the WebView's console.
 */
@CapacitorPlugin(name = "SmokeReporter")
public class SmokeReporterPlugin extends Plugin {

    @PluginMethod(returnType = PluginMethod.RETURN_NONE)
    public void report(PluginCall call) {
        Log.i("SallaPushSmoke", call.getString("line", ""));
    }
}
