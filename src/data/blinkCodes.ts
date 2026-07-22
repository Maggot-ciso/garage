// MIL blink codes for motorcycles and scooters.
//
// WHY THERE IS NO CODE→FAULT TABLE HERE.
//
// Researched 2026-07-22 before writing anything, because a wrong fault code is
// worse than none. What the sources actually show:
//
// - Honda documents the *counting* precisely and consistently (service manual:
//   long blink 1.3 s = 10, short blink 0.5 s = 1, multiple faults reported
//   lowest number first). What a given number MEANS varies by model — code 21
//   on a CBR600F4i is the O2 sensor, and that mapping does not transfer.
// - Yamaha does not use MIL blink codes in this sense at all. Faults are read
//   from a dashboard diagnostic mode (d01–d64) with the number shown on the
//   LCD, which is a different procedure entirely.
// - Piaggio/Vespa do blink, but every source says the sequence to enter
//   self-diagnosis differs between models and to use the model's manual.
//
// So this table holds the part that is true across a make — how to get the
// number out of the lamp — and stops there. Turning a blink pattern into a
// number is deterministic and always correct; claiming to know what the number
// means on an unseen model would be exactly the confident wrongness the VIN
// decoder already refuses. The number is handed to the assistant, which can
// search for the specific model.

import type { VehicleType } from '../db/db'

export type ReadMethod = 'blink' | 'dash-menu' | 'unknown'

export interface BlinkScheme {
  /** Lowercase make, matched case-insensitively against the vehicle's make. */
  make: string
  method: ReadMethod
  /** Value of one long flash in the count. Blink schemes only. */
  longWorth?: number
  /** Value of one short flash. Blink schemes only. */
  shortWorth?: number
  howToRead: string
  /** Named so the rider can go and find the authoritative meaning themselves. */
  whereItsDefined: string
}

export const BLINK_SCHEMES: BlinkScheme[] = [
  {
    make: 'honda',
    method: 'blink',
    longWorth: 10,
    shortWorth: 1,
    howToRead:
      'The FI/MIL lamp spells the code out: a long flash (about 1.3 s) counts 10, a short flash (about 0.5 s) counts 1. Two long and one short is 21. If more than one fault is stored they are shown in order, lowest number first, so watch for the pause and count each group separately.',
    whereItsDefined:
      "Honda's PGM-FI self-diagnosis table, in the service manual for your exact model — the numbers are not shared across models.",
  },
  {
    make: 'piaggio',
    method: 'blink',
    longWorth: 10,
    shortWorth: 1,
    howToRead:
      'The lamp flashes in groups separated by a pause: count each group, tens first. How you put the scooter into self-diagnosis differs from model to model, so check the manual for yours before counting.',
    whereItsDefined:
      "Piaggio's workshop manual for your model — both the entry procedure and the code meanings vary between models.",
  },
  {
    make: 'vespa',
    method: 'blink',
    longWorth: 10,
    shortWorth: 1,
    howToRead:
      'Same scheme as other Piaggio-group scooters: flashes in groups separated by a pause, tens first. The way into self-diagnosis differs by model.',
    whereItsDefined: "Piaggio/Vespa workshop manual for your model.",
  },
  {
    make: 'yamaha',
    method: 'dash-menu',
    howToRead:
      'Yamaha does not flash the code at you. The fault number is read from the dashboard diagnostic mode (screens d01–d64, with d60/d61 holding stored faults) and shown on the display, so there is nothing to count.',
    whereItsDefined:
      "Yamaha's service manual for your model, under self-diagnosis / diagnostic mode.",
  },
]

export function schemeForMake(make: string | undefined): BlinkScheme | null {
  if (!make) return null
  const needle = make.trim().toLowerCase()
  return BLINK_SCHEMES.find((s) => needle === s.make || needle.startsWith(`${s.make} `)) ?? null
}

/**
 * Turn a counted flash pattern into the code number. This is the only part of
 * blink diagnosis that can be got right without the model's manual, so it is
 * the only part that is computed.
 */
export function blinkCode(longFlashes: number, shortFlashes: number, scheme: BlinkScheme): number | null {
  if (scheme.method !== 'blink') return null
  if (longFlashes < 0 || shortFlashes < 0) return null
  if (!Number.isInteger(longFlashes) || !Number.isInteger(shortFlashes)) return null
  const code = longFlashes * (scheme.longWorth ?? 10) + shortFlashes * (scheme.shortWorth ?? 1)
  return code > 0 ? code : null
}

/** Whether a blink reader is worth offering for this vehicle at all. */
export function usesBlinkCodes(vehicleType: VehicleType | undefined): boolean {
  return vehicleType === 'motorcycle'
}
