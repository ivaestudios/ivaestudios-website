// Convert local hero JPGs to AVIF + WebP for PR 6 Phase 2.
// Output goes next to the JPG (e.g. hero.jpg → hero.avif + hero.webp).

import sharp from "sharp";
import { stat } from "node:fs/promises";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "../..");

const HEROES = [
  "images/wedding-bride-tulum-ivae-studios.jpg",
  "images/family-cancun-ivae-studios.jpg",
  "images/couple-cancun-ivae-studios-3.jpg",
  "images/wedding-cancun-hotel-zone-ivae-studios.jpg",
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

async function convertOne(relPath) {
  const fullJpg = path.join(REPO, relPath);
  const avifOut = fullJpg.replace(/\.jpg$/, ".avif");
  const webpOut = fullJpg.replace(/\.jpg$/, ".webp");

  const jpgSize = await fileSize(fullJpg);
  if (jpgSize == null) {
    console.log(`  ⚠️  MISSING: ${relPath}`);
    return;
  }

  // AVIF — quality 60 is high quality, ~50% smaller than JPG
  await sharp(fullJpg)
    .avif({ quality: 60, effort: 6 })
    .toFile(avifOut);

  // WebP — quality 82 is high quality, ~30% smaller than JPG
  await sharp(fullJpg)
    .webp({ quality: 82, effort: 5 })
    .toFile(webpOut);

  const avifSize = await fileSize(avifOut);
  const webpSize = await fileSize(webpOut);
  const avifPct = ((1 - avifSize / jpgSize) * 100).toFixed(0);
  const webpPct = ((1 - webpSize / jpgSize) * 100).toFixed(0);

  console.log(`  ✓ ${relPath}`);
  console.log(`      JPG : ${fmt(jpgSize)}`);
  console.log(`      WebP: ${fmt(webpSize)}  (${webpPct}% smaller)`);
  console.log(`      AVIF: ${fmt(avifSize)}  (${avifPct}% smaller)`);
}

async function main() {
  console.log(`=== PR 6 Phase 2 — Convert ${HEROES.length} hero images ===\n`);
  for (const h of HEROES) {
    await convertOne(h);
  }
  console.log("\n✓ Conversion complete");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
