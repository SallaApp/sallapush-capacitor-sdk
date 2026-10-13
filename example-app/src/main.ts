import { SallaPush } from '@salla.sa/sallapush-capacitor';

const sdkVersion = document.querySelector<HTMLElement>('#sdk-version');

function show(text: string): void {
  if (sdkVersion) {
    sdkVersion.textContent = text;
  }
}

SallaPush.getSdkVersion().then(
  (version) => show(`SallaPush ${version}`),
  (error: unknown) =>
    show(
      `SallaPush isn't available: ${error instanceof Error ? error.message : String(error)}`
    )
);
