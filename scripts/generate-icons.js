/**
 * generate-icons.js
 * Converts the SVG icon to multiple PNG sizes for PWA manifest.
 * Run: node scripts/generate-icons.js
 */
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const ICONS_DIR = resolve(ROOT, 'public', 'icons')
const SVG_PATH = resolve(ICONS_DIR, 'icon.svg')

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

async function generateIcons() {
  const svgBuffer = readFileSync(SVG_PATH)

  for (const size of SIZES) {
    const outPath = resolve(ICONS_DIR, `icon-${size}x${size}.png`)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath)
    console.log(`✓ Generated ${outPath}`)
  }

  console.log('\nAll icons generated successfully!')
}

generateIcons().catch(err => {
  console.error('Failed to generate icons:', err)
  process.exit(1)
})
