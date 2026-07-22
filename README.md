# 🚗 GarageBook

**A phone-first car logbook and smart assistant that runs entirely on your device.**
Track fuel and maintenance, decode dashboard lights and OBD-II codes, get part-search
help, and keep a shareable service history — with **no backend, no accounts, and no
data ever leaving your phone** (everything lives in on-device IndexedDB).

Distributed as **free native iOS and Android apps** you sideload yourself — no App Store,
no Google Play, no Apple Developer Program, no cost. Both platforms build from the same
codebase.

---

## Features

| | |
|---|---|
| 🅿️ **Garage** | Car profiles with offline VIN decode (+ NHTSA enrichment for US-market cars) |
| 📒 **Logbook** | Fuel & maintenance entries, quick 3-tap fill-up, photo/PDF attachments, itemised receipts (company + line items incl. DPH) |
| 📷 **eKasa QR** | Scan a Slovak receipt's QR code and the whole receipt is imported — exact litres, cost, date, shop. No AI, no key, no cost |
| 📈 **Insights** | Fuel economy, cost-per-km, €/litre trends, projected yearly cost — pure math, never AI |
| 🔧 **Diagnostics** | OBD-II code lookup and dashboard warning-light decoder — offline tables, no AI, works with no key |
| 💬 **Assistant** | AI chat about your car: symptom help, EU-shipping part search. Diagnostics can hand a decoded code straight to it |
| ⏰ **Reminders** | Recurring service/tyre reminders, in-app due banner, **local notifications** on the due date |
| 🛞 **Tyres** | Seasonal sets, tread history, storage tracking, swap reminders |
| 📤 **Service history** | Export a shareable/printable maintenance record — the thing a logbook is for at sale time |
| 💾 **Backup** | One-file JSON export/import, optionally including attachments |

**Design principle:** no AI where deterministic code will do. Extraction, calculation,
lookup and validation are tested pure functions; the model is reserved for genuine
language problems (diagnostics, symptoms, parts). The app is fully usable with no API key.

---

## 📱 Install on your iPhone (free, via AltStore)

No Apple Developer account and no money — AltStore re-signs the app on your phone with
your own free Apple ID. Full checklist with troubleshooting: **[SIDELOAD.md](SIDELOAD.md)**.

**One-time setup**

1. **Install Xcode** from the Mac App Store, then point the tools at it and grab the iOS platform:
   ```sh
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   xcodebuild -downloadPlatform iOS      # ~8.5 GB, once
   ```
2. **Install AltServer** on the Mac (from [altstore.io](https://altstore.io)), plug in your
   iPhone over USB, and choose *Install AltStore → [your iPhone]* from its menu-bar icon.
   Sign in with your free Apple ID (use an app-specific password if you have 2FA).
3. On the iPhone: **Settings → Privacy & Security → Developer Mode → On** (requires a restart),
   and **Settings → General → VPN & Device Management** → trust your Apple ID.

**Build & install the app**

```sh
npm install
npm run build:ipa      # → dist-ipa/GarageBook.ipa
```

On the phone: **AltStore → My Apps → +** → pick `GarageBook.ipa`. It signs and installs;
GarageBook appears on your home screen.

> **Tip:** set `GARAGEBOOK_DELIVERY_DIR` in a local `.env.local` (gitignored) to a cloud-synced
> folder and each build lands there automatically, so the phone can pick it up without a cable.

> **Living with the free route (Apple's limits, not the app's):** apps expire after **7 days** —
> keep AltServer running on the Mac and it auto-refreshes over Wi-Fi. Max **3 sideloaded apps**
> per Apple ID. **No push notifications** on free provisioning, so reminders surface in-app
> (the due banner) and as **local** notifications scheduled on the phone.

**Updating:** re-run `npm run build:ipa` and install the new `.ipa` over the old one in AltStore
— your data survives (same bundle id). Or grab the artifact from the **Build .ipa** GitHub Action.

---

## 🤖 Install on Android (free, no store)

Far simpler than iOS: no re-signing service, **no 7-day expiry**, no app limit.

```sh
npm install
npm run build:apk      # → dist-apk/GarageBook.apk
```

Copy the `.apk` to the phone (cloud, cable or messaging), tap it, and allow *install from
unknown sources* once when prompted. That's it — the app stays installed and never expires.

Building requires a JDK and the Android SDK; both install into user space with no admin
rights and no Android Studio needed:

```sh
# JDK 21 (Temurin) and the Android command-line SDK
ANDROID_HOME=~/Library/Android/sdk
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

**Permissions used:** camera (eKasa QR scanning) and notifications (reminders). Nothing else —
no location, no contacts, no network beyond the AI provider and the eKasa lookup you trigger.

---

## 🛠️ Develop

```sh
npm install
npm run dev         # Vite dev server
npm test            # unit tests (Vitest)
npm run typecheck   # TypeScript strict check
npm run build       # production web build (dist/)
npm run build:ipa   # unsigned iOS .ipa for sideloading
npm run build:apk   # Android .apk for sideloading
```

**Stack:** React + Vite + TypeScript (strict) · Tailwind CSS v4 · Dexie/IndexedDB · Capacitor
(iOS + Android shells) · Vitest + React Testing Library · recharts. See **[CLAUDE.md](CLAUDE.md)** for
architecture, conventions, and the full status.

### Versioning

The app version lives in `package.json` as the single source of truth. Bump it with:

```sh
npm version patch    # or: minor | major  (updates package.json, no git tag)
```

The version is injected into the web build (shown in **Settings**, bottom of the screen) and
stamped onto both native builds — iOS `MARKETING_VERSION` (so AltStore shows it) and Android
`versionName`. The build number is the commit count. Each release is an annotated git tag
(`v1.3.0`), so the tag list doubles as the changelog.

---

## 🔐 AI features & your API key

AI features call the model provider **directly from your browser/app** — there is no middleman
server. Paste your own API key in **Settings**; it is stored only in your device's local database
and sent only to the provider (Anthropic by default). Everything else works fully without a key.

## 🌿 Branches and releases

**One branch: `main`.** It stays green and is always releasable.

There are deliberately **no long-lived `ios` / `android` / `test` branches.** Both platforms
are thin native shells (Capacitor) around the *same* `src/` — 100+ shared files versus a
handful of generated per-platform project files. A platform branch would have to be
constantly merged back or it would silently drift, doubling the maintenance for zero gain.
The same reasoning rules out a `test` branch: CI already runs typecheck, tests and build on
every push and pull request, so `main` *is* the tested branch.

The model that fits this project:

| | |
|---|---|
| `main` | Always releasable. Both the iOS and Android builds come from here. |
| `feature/<name>` | Short-lived — one change, merged with `git merge --no-ff`, then deleted. |
| `v1.2.3` tags | Annotated tag per release, created at the version-bump commit. |

Release flow: branch → commit → `npm run typecheck && npm test && npm run build` → merge to
`main` → `npm version minor` → tag → `npm run build:ipa` / `build:apk`.

There is no hosting — the app is installed directly onto the device, never deployed to a
server.
