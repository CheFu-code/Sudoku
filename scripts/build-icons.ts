/**
 * build-icons.ts — offline, dev-time only (like build-puzzle-bank.ts).
 *
 * Rasterizes the brand SVGs in `assets/svgs/` into the PNGs that Expo references
 * in `app.json` (icon / favicon / splash / Android adaptive + monochrome).
 * Overwrites the files in `assets/images/` in place, so no config paths change.
 *
 * Run: `npm run build:icons`  (or `make build-icons`)
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(__dirname, '..');
const SVG_DIR = path.join(ROOT, 'assets', 'svgs');
const OUT_DIR = path.join(ROOT, 'assets', 'images');

// Render the source SVG at a high DPI so downscaling stays crisp.
const DENSITY = 384;

const LIGHT_BG = '#ECF7FF'; // brand light background (icon corners + adaptive bg)

async function loadSvg(name: string): Promise<string> {
  return fs.readFile(path.join(SVG_DIR, `${name}.svg`), 'utf8');
}

/** Replace hex colors in an SVG string (case-insensitive). */
function recolor(svg: string, map: Record<string, string>): string {
  let out = svg;
  for (const [from, to] of Object.entries(map)) {
    out = out.replace(new RegExp(from, 'gi'), to);
  }
  return out;
}

/** Strip the full-canvas background rect so only the mark remains (transparent). */
function stripBackgroundRect(svg: string): string {
  return svg.replace(/<rect\s+width="512"\s+height="512"[^>]*\/>/i, '');
}

/**
 * Rasterize `svg` to `canvas*contentFraction` px and composite it centered on a
 * `canvas x canvas` surface. Transparent unless `background` is given.
 */
async function renderCentered(
  svg: string,
  canvas: number,
  contentFraction: number,
  outFile: string,
  background?: string,
): Promise<void> {
  const content = Math.round(canvas * contentFraction);
  const mark = await sharp(Buffer.from(svg), { density: DENSITY })
    .resize(content, content, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const base = sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  await base.composite([{ input: mark, gravity: 'center' }]).png().toFile(outFile);
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const icon = await loadSvg('sudoku-icon'); // light bg, colored mark
  const mono = await loadSvg('sudoku-mark-mono'); // grid + 9, single dark color
  const out = (f: string) => path.join(OUT_DIR, f);

  // 1. iOS / store icon — 1024², fully opaque square (flatten fills the rounded
  //    corners so there is no transparency, which the App Store rejects).
  await sharp(Buffer.from(icon), { density: DENSITY })
    .resize(1024, 1024)
    .flatten({ background: LIGHT_BG })
    .png()
    .toFile(out('icon.png'));

  // 2. Web favicon — 196², transparency is fine on the web.
  await sharp(Buffer.from(icon), { density: DENSITY })
    .resize(196, 196)
    .png()
    .toFile(out('favicon.png'));

  // 3. Android adaptive foreground — mark only, centered in the safe zone. The
  //    grid fills ~65% of the icon's own viewBox, so ~0.92 lands the grid at
  //    ~60% of the canvas (inside the guaranteed-visible 66dp region).
  await renderCentered(stripBackgroundRect(icon), 1024, 0.92, out('android-icon-foreground.png'));

  // 4. Android monochrome (themed icons, tinted by the OS) — white silhouette.
  //    The mono SVG's viewBox is tight to its content, so a smaller fraction
  //    keeps the grid near the same ~60% safe-zone footprint.
  await renderCentered(
    recolor(mono, { '#021A31': '#FFFFFF' }),
    1024,
    0.7,
    out('android-icon-monochrome.png'),
  );

  // 5. Splash mark — white grid + 9 for the blue (#208AEF) splash background.
  await renderCentered(recolor(mono, { '#021A31': '#FFFFFF' }), 512, 1.0, out('splash-icon.png'));

  console.log('✓ icons written to assets/images/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
