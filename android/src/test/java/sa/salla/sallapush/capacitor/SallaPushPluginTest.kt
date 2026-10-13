package sa.salla.sallapush.capacitor

import android.util.Log
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.shadows.ShadowLog

@RunWith(RobolectricTestRunner::class)
class SallaPushPluginTest {
  private val native = FakeNativeSallaPush()
  private val once = OncePerProcess()

  @Before
  fun clearLog() {
    ShadowLog.clear()
  }

  @Test
  fun loadReportsAPluginsSallaPushSectionOncePerProcessAndStartsNothing() {
    plugin(pluginConfigIsEmpty = false).load()
    plugin(pluginConfigIsEmpty = false).load()

    assertEquals(
      listOf(
        "[SallaPush] capacitor.config's plugins.SallaPush section is ignored: SallaPush reads its settings from the " +
          "Info.plist keys on iOS and the com.salla.push meta-data on Android (README, iOS setup and Android setup)."
      ),
      errors()
    )
    assertTrue(native.calls.isEmpty())
  }

  @Test
  fun loadReportsNothingWithoutAPluginsSallaPushSection() {
    plugin(pluginConfigIsEmpty = true).load()

    assertTrue(errors().isEmpty())
    assertTrue(native.calls.isEmpty())
  }

  private fun plugin(pluginConfigIsEmpty: Boolean) =
    SallaPushPlugin(SallaPushPlugin.Seams(native = native, once = once, pluginConfigIsEmpty = { pluginConfigIsEmpty }))

  private fun errors(): List<String> =
    ShadowLog.getLogsForTag("SallaPush").filter { it.type == Log.ERROR }.map { it.msg }
}
