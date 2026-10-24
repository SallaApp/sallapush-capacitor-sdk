package sa.salla.sallapush.capacitor;

/**
 * The plugin's lifecycle calls as Capacitor's bridge makes them. The plugin keeps Capacitor's protected hooks
 * protected, and Java reaches a protected method from the package of the class that declares it.
 */
final class PluginLifecycle {
  private PluginLifecycle() {}

  /** What the bridge calls when the plugin's activity is destroyed. */
  static void destroy(SallaPushPlugin plugin) {
    plugin.handleOnDestroy();
  }
}
