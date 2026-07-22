// Dashboard warning lights are a small, standardised set of pictograms (ISO 2575
// covers most). Like OBD codes, matching one is a table read, not a language
// problem — so this works offline with no key. Symbols are hand-drawn inline SVG
// (24x24 viewBox, currentColor) — lucide has none of these, and inlining keeps
// the app dependency-free and offline.
//
// Extend this table when a light turns up that isn't here (same policy as
// carModels.ts / obdCodes.ts). Manufacturer-specific lights are out of scope.

export type LightColour = 'red' | 'amber' | 'info'
export type Severity = 'stop' | 'soon' | 'note'

export interface DashboardLight {
  id: string
  name: string
  colour: LightColour
  severity: Severity
  meaning: string
  whatToDo: string
  svg: string // inner SVG markup, drawn in a 0 0 24 24 viewBox with currentColor
}

export const DASHBOARD_LIGHTS: DashboardLight[] = [
  {
    id: 'oil-pressure',
    name: 'Oil pressure',
    colour: 'red',
    severity: 'stop',
    meaning: 'Engine oil pressure has dropped too low. Running without oil pressure destroys an engine in minutes.',
    whatToDo: 'Stop safely as soon as you can and switch the engine off. Check the oil level; do not drive until the cause is found.',
    svg: '<path d="M3 15c2 0 3-1 4-1s2 1 4 1M2 12c1.5-3 4-4 7-4l9 3.5c1.5.6 2 1.3 2 2.5v1.5a1 1 0 0 1-1 1H6a4 4 0 0 1-4-4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12l2-3M12 12l1.5-2.5" stroke="currentColor" stroke-width="1.4"/>',
  },
  {
    id: 'coolant-temp',
    name: 'Coolant temperature',
    colour: 'red',
    severity: 'stop',
    meaning: 'The engine is overheating. Continuing can warp the head or seize the engine.',
    whatToDo: 'Pull over and switch off. Let it cool before opening anything. Check coolant once cold; do not remove the cap hot.',
    svg: '<path d="M4 14h6M4 11h6M4 8h6" stroke="currentColor" stroke-width="1.5"/><path d="M10 6a2 2 0 0 1 4 0v7a3 3 0 1 1-4 0V6Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/><path d="M17 8l3-1M17 11h3M17 14l3 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  },
  {
    id: 'brake-system',
    name: 'Brake system',
    colour: 'red',
    severity: 'stop',
    meaning: 'A brake fault, low brake fluid, or the handbrake is on. If it stays on while driving, braking may be impaired.',
    whatToDo: 'Check the handbrake is fully released. If it stays on, check brake fluid and stop driving — get the brakes looked at.',
    svg: '<circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8.5v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="15.4" r="1" fill="currentColor"/><path d="M4.5 8.5a6.5 6.5 0 0 0 0 7M19.5 8.5a6.5 6.5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  },
  {
    id: 'battery',
    name: 'Battery / charging',
    colour: 'red',
    severity: 'soon',
    meaning: 'The charging system is not keeping the battery charged — often the alternator or its belt.',
    whatToDo: 'You may lose electrical power soon. Switch off non-essentials and get to a garage before the battery drains.',
    svg: '<rect x="4" y="8" width="16" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 8V6h3v2M13 8V6h3v2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 13h3M9.5 11.5v3M14 13h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  },
  {
    id: 'power-steering',
    name: 'Power steering',
    colour: 'red',
    severity: 'soon',
    meaning: 'A power steering fault. The wheel can suddenly become very heavy to turn.',
    whatToDo: 'Drive gently — steering takes much more effort. Get it checked promptly.',
    svg: '<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="11" cy="11" r="2" fill="currentColor"/><path d="M11 4v5M11 13v5M4 11h5M13 11h5" stroke="currentColor" stroke-width="1.4"/><path d="M16 16l4 4M17 20h3v-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
  },
  {
    id: 'airbag',
    name: 'Airbag / SRS',
    colour: 'red',
    severity: 'soon',
    meaning: 'A fault in the airbag or seatbelt-pretensioner system. Airbags may not deploy in a crash.',
    whatToDo: 'The car drives normally but a safety system is offline. Have it diagnosed before relying on the airbags.',
    svg: '<path d="M7 4a3 3 0 0 0-3 3v3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17" cy="14" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 14h3" stroke="currentColor" stroke-width="1.6"/>',
  },
  {
    id: 'check-engine',
    name: 'Check engine',
    colour: 'amber',
    severity: 'soon',
    meaning: 'The engine management system found a fault. Steady = investigate soon; flashing = a misfire that can damage the catalytic converter.',
    whatToDo: 'If flashing, ease off and get it seen quickly. If steady, read the OBD code (below) and plan a diagnosis.',
    svg: '<path d="M5 10h2l1-2h3l1 2h4a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-1v-2h-2v2H8v-2H6v2H5a2 2 0 0 1-2-2v-2a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 4v3" stroke="currentColor" stroke-width="1.5"/>',
  },
  {
    id: 'abs',
    name: 'ABS',
    colour: 'amber',
    severity: 'soon',
    meaning: 'The anti-lock braking system is disabled. Normal brakes still work, but the wheels can lock under hard braking.',
    whatToDo: 'Brake with extra care, especially in the wet. Get the ABS checked — the ordinary brakes are unaffected.',
    svg: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.4 2.2"/><text x="12" y="15" font-size="7" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="currentColor">ABS</text>',
  },
  {
    id: 'tpms',
    name: 'Tyre pressure',
    colour: 'amber',
    severity: 'soon',
    meaning: 'One or more tyres is significantly under-inflated (or the TPMS sensor has a fault).',
    whatToDo: 'Check and set the tyre pressures cold. A low tyre wears fast, uses more fuel, and handles worse.',
    svg: '<path d="M4 17a8 6 0 0 1 16 0Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 17v-2M12 17v-3M16 17v-2" stroke="currentColor" stroke-width="1.5"/><path d="M12 6v3M10.5 7.5h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  },
  {
    id: 'esp',
    name: 'Stability / traction (ESP)',
    colour: 'amber',
    severity: 'note',
    meaning: 'Flashing = the car is actively controlling a slip. Steady = the stability system is off or has a fault.',
    whatToDo: 'Flashing while driving is normal on a slippery road — ease off. Steady: check it is not switched off, then have it looked at.',
    svg: '<path d="M12 3a5 5 0 0 0-5 5c0 3 5 4 5 4s5-1 5-4a5 5 0 0 0-5-5Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 16c1.5-1 3-1 4 0s2.5 1 4 0M5 20c1.5-1 3-1 4 0s2.5 1 4 0" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  },
  {
    id: 'glow-plug',
    name: 'Glow plug (diesel)',
    colour: 'amber',
    severity: 'note',
    meaning: 'On a diesel: the glow plugs are pre-heating. If it flashes after starting, there is an engine-management fault.',
    whatToDo: 'Wait for it to go out before starting a cold diesel. If it stays on or flashes, get it diagnosed.',
    svg: '<path d="M9 4h6M12 4v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 7c-2 2-3 3-3 6a3 3 0 0 0 6 0c0-3-1-4-3-6Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 20v-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  },
  {
    id: 'oil-level',
    name: 'Oil level',
    colour: 'amber',
    severity: 'soon',
    meaning: 'Engine oil level is low (distinct from the red oil-pressure light).',
    whatToDo: 'Check the dipstick and top up to the correct grade. Investigate if it drops again soon.',
    svg: '<path d="M3 14c2 0 3-1 4-1s2 1 4 1M2 12c1.5-3 4-4 7-4l9 3.5c1.5.6 2 1.3 2 2.5v1.5a1 1 0 0 1-1 1H6a4 4 0 0 1-4-4Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 5v3M12.5 6.5h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  },
  {
    id: 'low-fuel',
    name: 'Low fuel',
    colour: 'amber',
    severity: 'note',
    meaning: 'The fuel level is low — usually a range of a few dozen kilometres remains.',
    whatToDo: 'Fill up soon. Running the tank dry can draw debris into the fuel system.',
    svg: '<rect x="5" y="6" width="9" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 10h9" stroke="currentColor" stroke-width="1.4"/><path d="M14 9l3 1v5a1.5 1.5 0 0 0 3 0V11l-2-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><rect x="7" y="12" width="5" height="5" fill="currentColor"/>',
  },
  {
    id: 'seatbelt',
    name: 'Seatbelt',
    colour: 'red',
    severity: 'note',
    meaning: 'A seatbelt is unfastened.',
    whatToDo: 'Fasten the belt. It stays lit and may chime until you do.',
    svg: '<path d="M8 4c0 4 1 8 4 8s4-4 4-8" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><path d="M9 14l3 6 3-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 17h4" stroke="currentColor" stroke-width="1.4"/>',
  },
  {
    id: 'door-open',
    name: 'Door / boot open',
    colour: 'info',
    severity: 'note',
    meaning: 'A door, the bonnet, or the boot is not fully closed.',
    whatToDo: 'Check all doors and the boot are shut properly before driving off.',
    svg: '<rect x="6" y="5" width="6" height="14" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8l6-2v12l-6-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="9" cy="12" r="1" fill="currentColor"/>',
  },
  {
    id: 'lights-on',
    name: 'Headlights / beam',
    colour: 'info',
    severity: 'note',
    meaning: 'A green light shows the headlights or main beam are on (blue = main beam).',
    whatToDo: 'Nothing — informational. Turn main beam off for oncoming traffic.',
    svg: '<path d="M5 7c5-1 5 9 0 10Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 8h4M12 11h5M12 14h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  },
]
