// Convert above-the-fold blog INDEX images from CDN to local AVIF + WebP + JPG.
// Targets the featured guide hero + the first 2 visible post cards in /blog & /es/blog.
// Sources are downloaded to /tmp/ivae-blog-heroes/ then written to /images/blog/.
// Quality: AVIF q=58 effort=6, WebP q=82 effort=5 (matches existing convert-cdn-heroes.mjs).
//
// Usage:
//   cd tools/img-converter
//   node convert-blog-heroes.mjs

import sharp from "sharp";
import { stat, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "../..");
const TMP = "/tmp/ivae-blog-heroes";
const CDN = "https://assets.ivaestudios.com/blog";
const OUT_DIR = path.join(REPO, "images/blog");

// Slugs of the 4 above-the-fold images on the blog INDEX (featured + first 3 cards).
// We convert these to AVIF + WebP locally for fast LCP on the blog landing page.
const HEROES = [
  // Featured hero (largest, full-bleed)
  { slug: "destination-wedding-riviera-maya-og", width: 2000, isHero: true },
  // First 3 post cards above the fold
  { slug: "honeymoon-photographer-riviera-maya-og", width: 1400 },
  { slug: "wedding-photographer-cancun-og", width: 1400 },
  { slug: "couples-photographer-cancun-og", width: 1400 },
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

async function downloadSource(slug) {
  const url = `${CDN}/${slug}.jpg`;
  const dest = path.join(TMP, `${slug}.jpg`);
  if (existsSync(dest)) {
    return dest;
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return dest;
}

async function convertOne(hero) {
  const src = await downloadSource(hero.slug);
  const srcSize = await fileSize(src);

  const baseOut = path.join(OUT_DIR, hero.slug);
  const jpgOut = `${baseOut}.jpg`;
  const avifOut = `${baseOut}.avif`;
  const webpOut = `${baseOut}.webp`;

  await sharp(src)
    .resize({ width: hero.width, withoutEnlargement: true })
    .jpeg({ quality: 84, progressive: true, mozjpeg: true })
    .toFile(jpgOut);

  await sharp(src)
    .resize({ width: hero.width, withoutEnlargement: true })
    .avif({ quality: hero.isHero ? 60 : 58, effort: 6 })
    .toFile(avifOut);

  await sharp(src)
    .resize({ width: hero.width, withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toFile(webpOut);

  const jpgSize = await fileSize(jpgOut);
  const avifSize = await fileSize(avifOut);
  const webpSize = await fileSize(webpOut);
  const meta = await sharp(jpgOut).metadata();
  const avifPct = ((1 - avifSize / jpgSize) * 100).toFixed(0);
  const webpPct = ((1 - webpSize / jpgSize) * 100).toFixed(0);

  console.log(`  ✓ ${hero.slug}  (${meta.width}x${meta.height})`);
  console.log(`      Source : ${fmt(srcSize)}`);
  console.log(`      JPG    : ${fmt(jpgSize)}`);
  console.log(`      WebP   : ${fmt(webpSize)}  (${webpPct}% smaller)`);
  console.log(`      AVIF   : ${fmt(avifSize)}  (${avifPct}% smaller)`);
}

async function main() {
  await mkdir(TMP, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`=== Convert ${HEROES.length} blog INDEX images → local AVIF + WebP + JPG ===\n`);
  for (const h of HEROES) {
    await convertOne(h);
  }
  console.log("\n✓ Conversion complete — outputs in /images/blog/");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
