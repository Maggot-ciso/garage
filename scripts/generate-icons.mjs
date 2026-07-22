// Generates the PWA icons (minimal white steering-wheel mark on signal red)
// without any image dependencies, by writing PNGs directly.
// Rerun with: npm run icons
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(publicDir, { recursive: true })

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const BG = [0xdc, 0x26, 0x26] // red-600 — signal red
const MARK = [0xff, 0xff, 0xff]

// Steering wheel: outer ring + hub + three spokes (down, upper-left, upper-right)
const RING_R = 0.3
const RING_W = 0.055
const HUB_R = 0.075
const SPOKE_W = 0.05
const SPOKES = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 - (2 * Math.PI) / 3]

function isMark(u, v) {
  const dx = u - 0.5
  const dy = v - 0.5
  const d = Math.hypot(dx, dy)
  if (Math.abs(d - (RING_R - RING_W / 2)) <= RING_W / 2) return true
  if (d <= HUB_R) return true
  for (const angle of SPOKES) {
    const ex = Math.cos(angle)
    const ey = Math.sin(angle)
    const t = dx * ex + dy * ey // distance along the spoke
    if (t < 0 || t > RING_R) continue
    const perp = Math.abs(dx * ey - dy * ex)
    if (perp <= SPOKE_W / 2) return true
  }
  return false
}

// 4x supersampling so circle edges come out smooth, not pixelated
const SS = 4
function pixel(x, y, size) {
  let hits = 0
  for (let sy = 0; sy < SS; sy++) {
    for (let sx = 0; sx < SS; sx++) {
      const u = (x + (sx + 0.5) / SS) / size
      const v = (y + (sy + 0.5) / SS) / size
      if (isMark(u, v)) hits++
    }
  }
  const a = hits / (SS * SS)
  return [
    Math.round(BG[0] + (MARK[0] - BG[0]) * a),
    Math.round(BG[1] + (MARK[1] - BG[1]) * a),
    Math.round(BG[2] + (MARK[2] - BG[2]) * a),
  ]
}

function png(size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3)
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y, size)
      row[1 + x * 3] = r
      row[2 + x * 3] = g
      row[3 + x * 3] = b
    }
    rows.push(row)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const [name, size] of [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(join(publicDir, name), png(size))
  console.log(`wrote public/${name}`)
}

// The native shell's app icon. Modern Xcode takes a single 1024x1024 and
// derives every other size, so there is only one file to keep in sync.
const iosIcon = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'ios',
  'App',
  'App',
  'Assets.xcassets',
  'AppIcon.appiconset',
  'AppIcon-512@2x.png',
)
try {
  writeFileSync(iosIcon, png(1024))
  console.log('wrote ios AppIcon-512@2x.png (1024x1024)')
} catch {
  // No ios/ platform yet — the web icons above are still written
  console.log('skipped ios icon (no ios/ platform)')
}

// Android wants a real bitmap per density bucket (no single-source derivation
// like Xcode), plus the adaptive-icon foreground. Same artwork, five sizes.
const androidRes = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'android',
  'app',
  'src',
  'main',
  'res',
)
const ANDROID_ICONS = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192],
]
try {
  for (const [dir, size] of ANDROID_ICONS) {
    const bytes = png(size)
    writeFileSync(join(androidRes, dir, 'ic_launcher.png'), bytes)
    writeFileSync(join(androidRes, dir, 'ic_launcher_round.png'), bytes)
    // The adaptive foreground is drawn inside a safe zone, so it needs to be
    // larger than the legacy icon at the same density.
    writeFileSync(join(androidRes, dir, 'ic_launcher_foreground.png'), png(size * 2))
  }
  console.log(`wrote android launcher icons (${ANDROID_ICONS.length} densities)`)
} catch {
  // No android/ platform yet — the icons above are still written
  console.log('skipped android icons (no android/ platform)')
}
