# Changelog

Every release of GarageBook. Versions follow [semantic versioning](https://semver.org):
the middle number changes when a feature lands, the last when something is fixed.

Downloads are on the [releases page](https://github.com/Maggot-ciso/garage/releases).

## v1.5.0 — tells you when an update exists
_2026-07-22_

Settings checks the public releases page and offers a link when a newer version
is out, so a sideloaded app no longer goes stale silently. Adds a generated
CHANGELOG and restores the licence and credits to the published README.

## v1.4.1 — shareable Android build
_2026-07-22_

Release-signed, non-debuggable APK with a versioned filename, plus install
instructions aimed at someone who has never sideloaded an app.

## v1.4.0 — region from device locale
_2026-07-22_

Parts-sourcing advice follows the device's country instead of a hardcoded one.
Adds a one-command sanitized publish to the public mirror with a leak-audit gate.

## v1.3.0 — Android build and itemised receipts
_2026-07-22_

Android platform added (Capacitor): same codebase, APK sideloads directly with
no expiry. Entries gain a company field and an itemised table (part/service +
price incl. DPH) filled from the receipt instead of stuffing notes.

## v1.2.0 — Diagnostics tab
_2026-07-22_

OBD-II code lookup and the dashboard warning-light decoder split out of the
Assistant into their own deterministic Diagnostics tab. Assistant is now AI
chat only. 'Ask what to do about it' hands a decoded code to the assistant.

## v1.1.0 — eKasa QR receipt import
_2026-07-22_

Scan a Slovak eKasa receipt QR to import a logbook entry: the Financial
Administration API returns the full receipt (exact litres, cost, date, shop).
Deterministic - no AI, no API key, no cost.

## v1.0.0 — first versioned release
_2026-07-20_

Native iOS shell sideloaded via AltStore, single-source versioning
(package.json -> app UI + iOS build), dead GitHub Pages deploy removed.
