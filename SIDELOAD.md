# Installing GarageBook on your iPhone (free, via AltStore)

No Apple Developer account, no money. AltStore re-signs the app on your phone with your
own free Apple ID. Everything the repo needs is already prepared — the only things left
are the ones only you can do (installing Xcode, trusting AltStore on the phone).

## What's already done (by the overnight build)

- ✅ Capacitor iOS project at `ios/App/App.xcodeproj`, bundle id `com.madsfy.garagebook`
- ✅ App icon (1024×1024) generated into the project
- ✅ Latest web build synced into the iOS project (`npm run cap:sync`)
- ✅ Camera + photo-library permission strings in `Info.plist` (without these the receipt
     scanner and attachment picker crash the app)
- ✅ `npm run build:ipa` — builds an **unsigned** `.ipa` with no developer account

## What only you can do

### 1. Install Xcode (once, ~1 hr download)
From the **App Store** (it's free, ~10 GB). Then point the tools at it:
```sh
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -version    # should now print a version, not an error
xcodebuild -downloadPlatform iOS   # iOS platform component, ~8.5 GB, once
```
Open Xcode once so it finishes first-launch setup, then quit it.

### 2. Build the .ipa
```sh
cd ~/Claude/Car
npm run build:ipa      # → dist-ipa/GarageBook.ipa
```
If it complains about signing, the script already disables it — re-read the error; it's
usually the `xcode-select` step above not done.

### 3. Install AltStore (once)
- On the **Mac**: download **AltServer** from https://altstore.io and run it (menu-bar app).
- On the **iPhone**: plug in over USB, then in AltServer's menu-bar icon choose
  *Install AltStore → [your iPhone]*. Enter your **free Apple ID** when asked.
  (Use an app-specific password if you have 2FA.)
- On the iPhone: **Settings → General → VPN & Device Management** → trust your Apple ID.

### 4. Sideload GarageBook
- Get `dist-ipa/GarageBook.ipa` onto the phone — AirDrop it, or set
  `GARAGEBOOK_DELIVERY_DIR` in a local `.env.local` to a cloud-synced folder and every
  build lands there automatically. Then on the phone open **AltStore → My Apps → +**
  and pick it.
- Open **AltStore** on the phone → **My Apps** → it appears there.

## Living with the free route (Apple's limits, not AltStore's)

- **7-day expiry.** The app stops opening after 7 days until refreshed. AltServer on the Mac
  **auto-refreshes** over Wi-Fi when the phone is on the same network, so in practice it
  renews itself as long as the Mac stays on with AltServer running.
- **3 sideloaded apps max** at once on a free Apple ID.
- **No push notifications** (server-sent) — but **local notifications work**: date-based
  reminders fire on the phone at 09:00 on the due date. Km-based reminders still surface
  in-app only (the due banner) — the phone can't watch the odometer.

## Sharing with other people

Each person installs **AltStore** on their phone with **their own** free Apple ID and
sideloads the same `dist-ipa/GarageBook.ipa`. One AltServer on your Mac can refresh
everyone's install when their phone is on the home Wi-Fi. Their logbook data is entirely
separate — it never leaves each phone.

## Rebuilding after code changes

```sh
npm run build:ipa      # rebuild the .ipa; re-install it the same way
```
The data on the phone survives a re-install (same bundle id, same local storage).
