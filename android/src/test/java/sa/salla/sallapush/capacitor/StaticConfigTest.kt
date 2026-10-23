package sa.salla.sallapush.capacitor

import android.content.Context
import android.os.Bundle
import android.util.Log
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.shadows.ShadowLog

@RunWith(RobolectricTestRunner::class)
class StaticConfigTest {
  private val context: Context = ApplicationProvider.getApplicationContext()

  @Before
  fun clearLog() {
    ShadowLog.clear()
  }

  @Test
  fun readsEveryKeyFromTextValues() {
    val metaData = Bundle().apply {
      putString(StaticConfig.APP_ID, "  st_42_android  ")
      putString(StaticConfig.OPEN_LAUNCH_URLS, "true")
      putString(StaticConfig.REQUIRES_USER_CONSENT, "YES")
      putString(StaticConfig.CLEAR_TAGS_ON_LOGOUT, "0")
      putString(StaticConfig.APP_VERSION, " 2.1.0 ")
      putString(StaticConfig.DISPLAY_ONESIGNAL_COMPAT_PAYLOADS, "No")
      putString(StaticConfig.AUTO_CLEAR_BADGE, "false")
      putString(StaticConfig.AUTO_UPDATE_BADGE, "NO")
    }

    val config = StaticConfig.from(context, metaData)

    assertEquals(
      StaticConfig(
        appId = "st_42_android",
        openLaunchUrls = true,
        requiresUserConsent = true,
        clearTagsOnLogout = false,
        appVersion = "2.1.0",
        displayOneSignalCompatPayloads = false,
        autoClearBadge = false,
        autoUpdateBadge = false,
      ),
      config
    )
    assertTrue(errors().isEmpty())
  }

  @Test
  fun readsBooleanValues() {
    val metaData = Bundle().apply {
      putBoolean(StaticConfig.OPEN_LAUNCH_URLS, true)
      putBoolean(StaticConfig.REQUIRES_USER_CONSENT, false)
      putBoolean(StaticConfig.CLEAR_TAGS_ON_LOGOUT, true)
      putBoolean(StaticConfig.DISPLAY_ONESIGNAL_COMPAT_PAYLOADS, false)
      putBoolean(StaticConfig.AUTO_CLEAR_BADGE, false)
      putBoolean(StaticConfig.AUTO_UPDATE_BADGE, true)
    }

    val config = StaticConfig.from(context, metaData)

    assertEquals(
      StaticConfig(
        openLaunchUrls = true,
        requiresUserConsent = false,
        clearTagsOnLogout = true,
        displayOneSignalCompatPayloads = false,
        autoClearBadge = false,
        autoUpdateBadge = true,
      ),
      config
    )
  }

  @Test
  fun readsBooleansThatArriveAsIntegers() {
    val metaData = Bundle().apply {
      putInt(StaticConfig.REQUIRES_USER_CONSENT, 1)
      putInt(StaticConfig.OPEN_LAUNCH_URLS, 0)
    }

    val config = StaticConfig.from(context, metaData)

    assertEquals(true, config.requiresUserConsent)
    assertEquals(false, config.openLaunchUrls)
  }

  @Test
  fun readsAnAppIdFromAStringResource() {
    val metaData = Bundle().apply { putInt(StaticConfig.APP_ID, android.R.string.ok) }

    assertEquals(context.getString(android.R.string.ok), StaticConfig.from(context, metaData).appId)
  }

  @Test
  fun readsANumericAppIdThatIsNotAResource() {
    val metaData = Bundle().apply { putInt(StaticConfig.APP_ID, 12345) }

    assertEquals("12345", StaticConfig.from(context, metaData).appId)
    assertTrue(errors().isEmpty())
  }

  @Test
  fun rejectsALongNumericAppIdThatArrivesAsAFloat() {
    val metaData = Bundle().apply { putFloat(StaticConfig.APP_ID, 1.2345679E10f) }

    val config = StaticConfig.from(context, metaData)

    assertNull(config.appId)
    val error = errors().single()
    assertTrue(error, error.startsWith("[SallaPush] Ignored com.salla.push.APP_ID: "))
    assertTrue(error, error.contains("Float") && error.contains("string resource"))
  }

  @Test
  fun treatsEmptyAndBlankValuesAsAbsent() {
    val metaData = Bundle().apply {
      putString(StaticConfig.APP_ID, "")
      putString(StaticConfig.APP_VERSION, "   ")
      putString(StaticConfig.OPEN_LAUNCH_URLS, "")
    }

    assertEquals(StaticConfig(), StaticConfig.from(context, metaData))
    assertTrue(errors().isEmpty())
  }

  @Test
  fun treatsAbsentKeysAndAbsentMetaDataAsUnset() {
    assertEquals(StaticConfig(), StaticConfig.from(context, Bundle()))
    assertEquals(StaticConfig(), StaticConfig.from(context, null))
    assertTrue(errors().isEmpty())
  }

  @Test
  fun ignoresAValueThatIsNotABooleanWithOneConsoleLine() {
    val metaData = Bundle().apply {
      putString(StaticConfig.APP_ID, "st_42_android")
      putString(StaticConfig.REQUIRES_USER_CONSENT, "maybe")
    }

    val config = StaticConfig.from(context, metaData)

    assertNull(config.requiresUserConsent)
    assertEquals("st_42_android", config.appId)
    assertEquals(
      listOf("[SallaPush] Ignored com.salla.push.REQUIRES_USER_CONSENT: \"maybe\" is not true, false, YES, NO, 1 or 0."),
      errors()
    )
  }

  @Test
  fun ignoresABadgeValueThatIsNotABooleanWithOneConsoleLine() {
    val metaData = Bundle().apply {
      putString(StaticConfig.APP_ID, "st_42_android")
      putString(StaticConfig.AUTO_UPDATE_BADGE, "never")
    }

    val config = StaticConfig.from(context, metaData)

    assertNull(config.autoUpdateBadge)
    assertEquals(
      listOf("[SallaPush] Ignored com.salla.push.AUTO_UPDATE_BADGE: \"never\" is not true, false, YES, NO, 1 or 0."),
      errors()
    )
  }

  @Test
  fun readsTheMetaDataOfTheAppsManifest() {
    val packageInfo = shadowOf(context.packageManager).getInternalMutablePackageInfo(context.packageName)
    packageInfo.applicationInfo?.metaData = Bundle().apply {
      putString(StaticConfig.APP_ID, "st_42_android")
      putBoolean(StaticConfig.CLEAR_TAGS_ON_LOGOUT, false)
    }

    assertEquals(StaticConfig(appId = "st_42_android", clearTagsOnLogout = false), StaticConfig.read(context))
  }

  @Test
  fun buildsTheNativeConfigurationWithTheGivenOptionsOnly() {
    val config = StaticConfig(openLaunchUrls = true, clearTagsOnLogout = false).toSallaPushConfig()

    assertTrue(config.openLaunchUrls)
    assertFalse(config.clearTagsOnLogout)
    assertFalse(config.requiresUserConsent)
    assertNull(config.appVersion)
    assertNull(config.apiBaseUrl)
    assertNull(config.logLevel)
    assertTrue(config.autoClearBadge)
    assertTrue(config.autoUpdateBadge)
  }

  @Test
  fun passesEveryOptionToTheNativeConfiguration() {
    val config = StaticConfig(
      appId = "st_42_android",
      openLaunchUrls = false,
      requiresUserConsent = true,
      clearTagsOnLogout = true,
      appVersion = "2.1.0",
      displayOneSignalCompatPayloads = false,
      autoClearBadge = false,
      autoUpdateBadge = false,
    ).toSallaPushConfig()

    assertFalse(config.openLaunchUrls)
    assertTrue(config.requiresUserConsent)
    assertTrue(config.clearTagsOnLogout)
    assertEquals("2.1.0", config.appVersion)
    assertFalse(config.autoClearBadge)
    assertFalse(config.autoUpdateBadge)
  }

  // Each badge setting alone, at the value that isn't native's default, so the two swapped can't pass.
  @Test
  fun passesEachBadgeSettingAlone() {
    val clear = StaticConfig(autoClearBadge = false).toSallaPushConfig()
    val update = StaticConfig(autoUpdateBadge = false).toSallaPushConfig()

    assertFalse(clear.autoClearBadge)
    assertTrue(clear.autoUpdateBadge)
    assertTrue(update.autoClearBadge)
    assertFalse(update.autoUpdateBadge)
  }

  private fun errors(): List<String> =
    ShadowLog.getLogsForTag("SallaPush").filter { it.type == Log.ERROR }.map { it.msg }
}
