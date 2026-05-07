// Convert 3 CDN-hosted hero images to local AVIF + WebP + resized JPG.
// Source originals are downloaded to /tmp/ivae-cdn-heroes/.
// Outputs go to images/ with short page-purpose names.
// Same quality settings as convert-heroes.mjs (AVIF q=60 effort=6, WebP q=82 effort=5).

import sharp from "sharp";
import { stat, copyFile } from "node:fs/promises";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "../..");
const TMP = "/tmp/ivae-cdn-heroes";

const HEROES = [
  {
    src: `${TMP}/cancun-hero.jpg`,
    out: "images/cancun-hero",
    // Source is 8484x5656 landscape — resize to 2000 wide
    resizeWidth: 2000,
  },
  {
    src: `${TMP}/riviera-maya-hero.jpg`,
    out: "images/riviera-maya-hero",
    // Source is 5612x8418 portrait — resize to 2000 wide
    resizeWidth: 2000,
  },
  {
    src: `${TMP}/los-cabos-hero.jpg`,
    out: "images/los-cabos-hero",
    // Source is 1920x2880 portrait — already small, keep at native size
    resizeWidth: 1920,
  },
];

async function fileSize(filePath) {
  try {
    const s = await stat(filePath);
    return s.size;
  } catch {
    return null;
  }
}

function fmt(bytes) {
  if (bytes == null) return "—";
  return (bytes / 1024).toFixed(0) + "kb";
}

async function convertOne(hero) {
  const srcSize = await fileSize(hero.src);
  if (srcSize == null) {
    console.log(`  ⚠️  MISSING SOURCE: ${hero.src}`);
    return;
  }

  const jpgOut = path.join(REPO, hero.out + ".jpg");
  const avifOut = path.join(REPO, hero.out + ".avif");
  const webpOut = path.join(REPO, hero.out + ".webp");

  // Resized JPG fallback — for clients that don't support AVIF/WebP and
  // so we don't depend on the CDN. Quality 85 is high but file size sane.
  await sharp(hero.src)
    .resize({ width: hero.resizeWidth, withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true, mozjpeg: true })
    .toFile(jpgOut);

  // AVIF — quality 60, effort 6 (same as Phase 2)
  await sharp(hero.src)
    .resize({ width: hero.resizeWidth, withoutEnlargement: true })
    .avif({ quality: 60, effort: 6 })
    .toFile(avifOut);

  // WebP — quality 82, effort 5 (same as Phase 2)
  await sharp(hero.src)
    .resize({ width: hero.resizeWidth, withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toFile(webpOut);

  const jpgSize = await fileSize(jpgOut);
  const avifSize = await fileSize(avifOut);
  const webpSize = await fileSize(webpOut);
  const avifPct = ((1 - avifSize / jpgSize) * 100).toFixed(0);
  const webpPct = ((1 - webpSize / jpgSize) * 100).toFixed(0);

  // Get final dimensions
  const meta = await sharp(jpgOut).metadata();

  console.log(`  ✓ ${hero.out}`);
  console.log(`      Source : ${fmt(srcSize)} (${(await sharp(hero.src).metadata()).width}x${(await sharp(hero.src).metadata()).height})`);
  console.log(`      JPG    : ${fmt(jpgSize)} (${meta.width}x${meta.height})`);
  console.log(`      WebP   : ${fmt(webpSize)}  (${webpPct}% smaller than new JPG)`);
  console.log(`      AVIF   : ${fmt(avifSize)}  (${avifPct}% smaller than new JPG)`);
}

async function main() {
  console.log(`=== Convert ${HEROES.length} CDN hero images → local AVIF + WebP + JPG ===\n`);
  for (const h of HEROES) {
    await convertOne(h);
  }
  console.log("\n✓ Conversion complete");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
