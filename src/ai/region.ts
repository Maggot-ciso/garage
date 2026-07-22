// Where the driver is, derived from the device rather than hardcoded, so part
// recommendations ship to the right place for whoever is running the app. This
// is a lookup, not a language problem — deterministic and unit-tested.

const EU_MEMBERS = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE',
])

export interface Region {
  /** ISO 3166-1 alpha-2, e.g. "SK" */
  code: string
  /** English country name, e.g. "Slovakia" */
  name: string
  inEu: boolean
}

// A BCP-47 tag carries the region as a 2-letter subtag after the language:
// "sk-SK" and "sk-Latn-SK" both mean Slovakia. A bare "sk" carries no region.
export function regionFromLocale(locale: string | undefined | null): Region | null {
  if (!locale) return null
  const parts = locale.split(/[-_]/)
  const code = parts.slice(1).find((p) => /^[A-Za-z]{2}$/.test(p))?.toUpperCase()
  if (!code) return null
  return { code, name: countryName(code), inEu: EU_MEMBERS.has(code) }
}

function countryName(code: string): string {
  try {
    // Intl ships the country names — no table to maintain or keep current.
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

export function detectRegion(): Region | null {
  if (typeof navigator === 'undefined') return null
  const candidates = [...(navigator.languages ?? []), navigator.language]
  for (const locale of candidates) {
    const region = regionFromLocale(locale)
    if (region) return region
  }
  return null
}

// The shipping rule handed to the assistant. Without a detectable region we say
// nothing about shipping rather than guessing a continent wrong.
export function shippingRule(region: Region | null): string {
  if (!region) {
    return '- For parts, prefer retailers that ship internationally, and tell the driver to confirm shipping, customs and VAT at checkout, since you cannot verify live shipping or stock.'
  }
  const market = region.inEu ? `${region.name} (EU)` : region.name
  const target = region.inEu ? 'the EU' : region.name
  return `- The driver is in ${market}. Only recommend places to buy that ship to ${target}. Retailers abroad are fine when they ship internationally — RockAuto (rockauto.com) is often the better source for a US-market car, while local or regional retailers (e.g. Autodoc in Europe) usually suit a locally sold car; judge which fits from the car above. Give direct product links where you can, and always remind the driver to confirm shipping — and any customs or import VAT — at checkout, since you cannot verify live shipping or stock.`
}
