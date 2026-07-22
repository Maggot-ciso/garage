// Slovak PZP (povinné zmluvné poistenie) comparison calculators.
//
// This is a lookup, not a language problem: naming the real comparators keeps
// the assistant from inventing a plausible-looking .sk address, which is the
// worst outcome for someone trying to insure a car. Every entry below was
// checked to be a live multi-insurer calculator on 2026-07-22.
//
// Deliberately no prices here, and none anywhere else in the app. A PZP quote
// depends on the driver's age, licence history, bonus/malus, region and the
// vehicle — nothing that can be precomputed and nothing the app can verify.
// The comparators are where a real number comes from.

export interface ComparisonSite {
  name: string
  url: string
  /** What distinguishes it, so the assistant can say something true about it. */
  note: string
}

const SK_PZP: ComparisonSite[] = [
  {
    name: 'Netfinancie.sk',
    url: 'https://www.netfinancie.sk/pzp/',
    note: 'quote by EČV or VIN; the longest-running Slovak comparator',
  },
  {
    name: 'Poistenie.sk',
    url: 'https://www.poistenie.sk/povinne-zmluvne-poistenie',
    note: 'compares a wide insurer panel, concludes online',
  },
  {
    name: 'PZPečko.sk',
    url: 'https://www.pzpecko.sk/',
    note: 'shows all prices without asking for a phone number or e-mail first',
  },
  {
    name: 'mojePZP.sk',
    url: 'https://www.mojepzp.sk/pzp/kalkulacka-pzp/',
    note: 'calculator plus immediate online conclusion',
  },
]

// Keyed by ISO 3166-1 alpha-2. Only Slovakia is covered: these are national
// insurance markets, and listing a comparator for a country nobody has checked
// would be the same invention this table exists to prevent.
const BY_COUNTRY: Record<string, ComparisonSite[]> = { SK: SK_PZP }

export function comparisonSitesFor(countryCode: string | undefined | null): ComparisonSite[] {
  if (!countryCode) return []
  return BY_COUNTRY[countryCode.toUpperCase()] ?? []
}
