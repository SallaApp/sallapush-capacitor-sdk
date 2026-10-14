package sa.salla.sallapush.example;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle state) {
        // The example's own plugin, registered before the bridge starts.
        registerPlugin(SmokeReporterPlugin.class);
        super.onCreate(state);
    }
}
