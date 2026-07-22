import type { CapacitorConfig } from '@capacitor/cli'

// The native shell serves the built app from the bundle, which makes it a
// secure origin: service workers, offline, and a storage container that no
// longer moves when the Wi-Fi does. None of the LAN-server workarounds apply.
const config: CapacitorConfig = {
  appId: 'com.madsfy.garagebook',
  appName: 'GarageBook',
  webDir: 'dist',
  ios: {
    // The logbook is a document, not a browser page — bouncing looks broken
    scrollEnabled: true,
    // 'never': the webview fills the screen and the CSS handles the notch/home
    // bar itself (viewport-fit=cover + env(safe-area-inset-*) in header/TabBar).
    // 'always' double-applied the insets and letterboxed the app in black bars.
    contentInset: 'never',
  },
}

export default config
