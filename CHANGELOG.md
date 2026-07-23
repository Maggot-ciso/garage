# Changelog

Every release of GarageBook. Versions follow [semantic versioning](https://semver.org):
the middle number changes when a feature lands, the last when something is fixed.

Downloads are on the [releases page](https://github.com/Maggot-ciso/garage/releases).

## v1.7.3 — documents you can actually read, and Slovak that is actually finished
_2026-07-23_

The PZP now opens inside the app. Tapping a stored document renders it on
screen instead of asking where to send it — which is what you want when the
document is being asked for at the roadside. Sharing is still there, as a
button, for when sending it really is the point.

Slovak is complete this time, and checked by measurement rather than by eye:
every screen captured in English, switched, captured again, and diffed for
anything that did not change. That found the settings screen, the reminder
presets, the fault-lamp instructions and the OBD system descriptions, none of
which the earlier passes caught.

Wording corrected with a native speaker rather than guessed: the tab is
Záznamy, recurrence reads "raz za" (the old form produced "každých 1 mesiac",
which is simply wrong), tread readings are "hĺbka dezénu", and the stability
lamp is just ESP. Numbers now group the way the chosen language groups them —
155 200 km, not 155,200 km.

A build-time check now fails on any user-facing text that does not come from
the dictionaries, so this stops being something anyone has to notice.

## v1.7.0 — vehicle documents, bike diagnostics, and Slovak everywhere
_2026-07-22_

Keep the PZP on the phone instead of in the glovebox: attach a PDF to a vehicle
and open it at a roadside check through the iOS share sheet. Insurance cost
still lives in the logbook; this is the certificate itself.

Motorcycles and scooters get diagnostics that fit them. The warning-light
decoder now shows the lights a bike actually has — neutral, side stand, FI —
and hides the ones it does not, like airbag and door ajar. A new fault-lamp
reader counts the flashes into a code number. It stops there on purpose: the
counting is documented per make, but what a number means differs between
models, so the app says so and offers to look it up rather than guessing.

The assistant now sees everything stored about a vehicle — tyre sets, the whole
logbook rather than the last twenty entries, who did the work and what it
included, the other vehicles in the garage, and which documents are on file. It
can also help find an authorised service or compare PZP prices, without ever
stating a dealer or a premium it cannot show you a source for.

Export is no longer all-or-nothing: choose which kinds of data, and which
vehicles. A partial backup can no longer delete what it does not contain, and a
single-vehicle backup merges into the garage instead of replacing it.

Every screen is now translated, not just the shell — including the warning-light
advice you read at the roadside. OBD code text stays in English on purpose, as
it appears in scan tools and parts catalogues.

Fixes: deleting a vehicle left its reminders, tyres, chat and attachments behind,
invisible but still in every backup.

## v1.6.0 — motorcycles, and Slovak alongside English
_2026-07-22_

The garage holds motorcycles as well as cars, with the assistant told which it
is so its advice fits. Adds a typed Slovak/English foundation: the language
follows the device by default, persists in Settings, uses the browser's own
plural rules for Slovak's three forms, and the assistant answers in the chosen
language while leaving part names and OBD codes verbatim. The shell is
translated; screen bodies still fall back to English.

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
