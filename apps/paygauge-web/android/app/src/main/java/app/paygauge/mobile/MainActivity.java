package app.paygauge.mobile;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(android.os.Bundle savedInstanceState) {
		registerPlugin(AppSettingsPlugin.class);
		registerPlugin(TallyWidgetPlugin.class);
		super.onCreate(savedInstanceState);
	}
}
