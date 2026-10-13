package sa.salla.sallapush.capacitor

import android.content.Context
import android.content.pm.ProviderInfo
import android.net.Uri
import android.os.Bundle
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf

@RunWith(RobolectricTestRunner::class)
class InitProviderTest {
  private val context: Context = ApplicationProvider.getApplicationContext()
  private val native = FakeNativeSallaPush()

  @Before
  fun resetEarlyInit() {
    EarlyInit.config = null
  }

  @Test
  fun startsSallaPushWithTheAppIdAndTheBuiltConfiguration() {
    val config = StaticConfig(
      appId = "st_42_android",
      openLaunchUrls = true,
      requiresUserConsent = true,
      clearTagsOnLogout = false,
      appVersion = "2.1.0",
    )

    EarlyInit.start(context, config, native)

    assertEquals(listOf("initWithContext(st_42_android)"), native.calls)
    assertSame(context, native.initContexts.single())
    val nativeConfig = native.initConfigs.single()
    assertTrue(nativeConfig.openLaunchUrls)
    assertTrue(nativeConfig.requiresUserConsent)
    assertFalse(nativeConfig.clearTagsOnLogout)
    assertEquals("2.1.0", nativeConfig.appVersion)
    assertEquals(config, EarlyInit.config)
  }

  @Test
  fun startsNothingWithoutAnAppId() {
    EarlyInit.start(context, StaticConfig(openLaunchUrls = true, requiresUserConsent = true), native)

    assertTrue(native.calls.isEmpty())
    assertNull(EarlyInit.config)
  }

  @Test
  fun appliesTheCompatibilityFlagBeforeInit() {
    EarlyInit.start(context, StaticConfig(appId = "st_42_android", displayOneSignalCompatPayloads = false), native)

    assertEquals(
      listOf("setDisplayOneSignalCompatPayloads(false)", "initWithContext(st_42_android)"),
      native.calls
    )
  }

  @Test
  fun appliesTheCompatibilityFlagWithoutAnAppId() {
    EarlyInit.start(context, StaticConfig(displayOneSignalCompatPayloads = true), native)

    assertEquals(listOf("setDisplayOneSignalCompatPayloads(true)"), native.calls)
    assertNull(EarlyInit.config)
  }

  @Test
  fun leavesTheCompatibilityFlagToNativeWhenTheKeyIsAbsent() {
    EarlyInit.start(context, StaticConfig(appId = "st_42_android"), native)

    assertEquals(listOf("initWithContext(st_42_android)"), native.calls)
  }

  @Test
  fun theProviderStartsSallaPushFromTheManifest() {
    setMetaData(
      Bundle().apply {
        putString(StaticConfig.APP_ID, "st_42_android")
        putString(StaticConfig.REQUIRES_USER_CONSENT, "true")
        putBoolean(StaticConfig.DISPLAY_ONESIGNAL_COMPAT_PAYLOADS, false)
      }
    )

    attachProvider()

    assertEquals(
      listOf("setDisplayOneSignalCompatPayloads(false)", "initWithContext(st_42_android)"),
      native.calls
    )
    assertTrue(native.initConfigs.single().requiresUserConsent)
    assertEquals(
      StaticConfig(appId = "st_42_android", requiresUserConsent = true, displayOneSignalCompatPayloads = false),
      EarlyInit.config
    )
  }

  @Test
  fun theProviderStartsNothingWithoutMetaData() {
    setMetaData(null)

    val provider = attachProvider()

    assertTrue(native.calls.isEmpty())
    assertNull(EarlyInit.config)
    assertTrue(provider.onCreate())
  }

  @Test
  fun theProviderProvidesNoData() {
    val provider = SallaPushInitProvider().apply { native = this@InitProviderTest.native }
    val uri = Uri.parse("content://sa.salla.sallapush.example.sallapush-capacitor-init")

    assertNull(provider.query(uri, null, null, null, null))
    assertNull(provider.getType(uri))
    assertNull(provider.insert(uri, null))
    assertEquals(0, provider.delete(uri, null, null))
    assertEquals(0, provider.update(uri, null, null, null))
  }

  private fun attachProvider(): SallaPushInitProvider {
    val provider = SallaPushInitProvider().apply { native = this@InitProviderTest.native }
    provider.attachInfo(context, ProviderInfo())
    return provider
  }

  private fun setMetaData(metaData: Bundle?) {
    shadowOf(context.packageManager).getInternalMutablePackageInfo(context.packageName).applicationInfo?.metaData = metaData
  }
}
