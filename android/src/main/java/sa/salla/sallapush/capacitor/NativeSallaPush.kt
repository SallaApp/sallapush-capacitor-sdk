package sa.salla.sallapush.capacitor

import com.salla.push.SallaPush

/** The native SallaPush calls the wrapper makes. Tests replace it with a fake. */
internal interface NativeSallaPush {
  val sdkVersion: String
}

internal object LiveNativeSallaPush : NativeSallaPush {
  override val sdkVersion: String
    get() = SallaPush.sdkVersion
}
