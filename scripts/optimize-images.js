#!/usr/bin/env node
/**
 * optimize-images.js
 *
 * Scans /images/ for .jpg/.jpeg/.png source files, generates responsive
 * variants in /images/optimized/ across multiple widths and formats,
 * writes /images/manifest.json mapping each source -> variants + LQIP,
 * and skips work that has already been done (idempotent).
 *
 * Usage:
 *   node scripts/optimize-images.js
 *
 * Dependencies: sharp, glob, p-limit (see scripts/package.json).
 */

'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const sharp = require('sharp');
const { glob } = require('glob');
const pLimit = require('p-limit');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(PROJECT_ROOT, 'images');
const OPTIMIZED_DIR = path.join(IMAGES_DIR, 'optimized');
const MANIFEST_PATH = path.join(IMAGES_DIR, 'manifest.json');

const WIDTHS = [480, 768, 1200, 1920, 2400];

const FORMATS = [
  {
    ext: 'avif',
    encode: (pipeline) => pipeline.avif({ quality: 50, effort: 4 }),
  },
  {
    ext: 'webp',
    encode: (pipeline) => pipeline.webp({ quality: 75 }),
  },
  {
    ext: 'jpg',
    encode: (pipeline) =>
      pipeline.jpeg({ quality: 80, mozjpeg: true, progressive: true }),
  },
];

const SOURCE_EXTENSIONS = ['jpg', 'jpeg', 'png'];
const CONCURRENCY = 6;
const LQIP_WIDTH = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function fileExists(p) {
  try {
    await fsp.access(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

/**
 * Build the variant output path for a given source image, width and format.
 * Mirrors the source's relative subdirectory structure under /optimized/.
 */
function variantPathFor(sourceRel, width, ext) {
  const parsed = path.parse(sourceRel);
  const baseName = `${parsed.name}-${width}.${ext}`;
  return path.join(OPTIMIZED_DIR, parsed.dir, baseName);
}

/**
 * Generate a base64 data-URI LQIP (low quality image placeholder).
 * Tiny (LQIP_WIDTH px) + blurred JPEG, encoded as data URI for inline use.
 */
async function generateLqip(absSourcePath) {
  const buffer = await sharp(absSourcePath)
    .resize({ width: LQIP_WIDTH, withoutEnlargement: true })
    .blur(1.2)
    .jpeg({ quality: 40, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

/**
 * Encode a single (width, format) variant. Skip if the output already exists.
 * Returns the relative public path to the variant.
 */
async function encodeVariant(absSourcePath, sourceRel, width, format, sourceWidth) {
  const outAbs = variantPathFor(sourceRel, width, format.ext);
  const outRel = toPosix(path.relative(PROJECT_ROOT, outAbs));

  if (await fileExists(outAbs)) {
    return { width, format: format.ext, path: `/${outRel}`, skipped: true };
  }

  // Don't upscale: if source is narrower than target width, cap at source width.
  const targetWidth = sourceWidth && sourceWidth < width ? sourceWidth : width;

  await ensureDir(path.dirname(outAbs));

  let pipeline = sharp(absSourcePath).resize({
    width: targetWidth,
    withoutEnlargement: true,
    fit: 'inside',
  });
  pipeline = format.encode(pipeline);

  await pipeline.toFile(outAbs);

  return { width, format: format.ext, path: `/${outRel}`, skipped: false };
}

/**
 * Process a single source image: generate all variants + LQIP.
 */
async function processSource(absSourcePath) {
  const sourceRel = path.relative(IMAGES_DIR, absSourcePath);
  const publicSourcePath = `/${toPosix(path.relative(PROJECT_ROOT, absSourcePath))}`;

  const metadata = await sharp(absSourcePath).metadata();
  const sourceWidth = metadata.width || null;
  const sourceHeight = metadata.height || null;

  const variants = [];
  const tasks = [];

  for (const width of WIDTHS) {
    for (const format of FORMATS) {
      tasks.push(
        encodeVariant(absSourcePath, sourceRel, width, format, sourceWidth).then((v) => {
          variants.push(v);
        }),
      );
    }
  }

  await Promise.all(tasks);

  const lqip = await generateLqip(absSourcePath);

  // Sort variants for stable manifest output (by format then width).
  variants.sort((a, b) => {
    if (a.format !== b.format) return a.format.localeCompare(b.format);
    return a.width - b.width;
  });

  return {
    source: publicSourcePath,
    width: sourceWidth,
    height: sourceHeight,
    aspectRatio: sourceWidth && sourceHeight ? +(sourceWidth / sourceHeight).toFixed(4) : null,
    lqip,
    variants,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const startedAt = Date.now();

  if (!(await fileExists(IMAGES_DIR))) {
    console.error(`[optimize-images] Source directory not found: ${IMAGES_DIR}`);
    process.exit(1);
  }

  await ensureDir(OPTIMIZED_DIR);

  // Find all .jpg/.jpeg/.png under /images, excluding anything already in /optimized.
  const pattern = `**/*.{${SOURCE_EXTENSIONS.join(',')}}`;
  const matches = await glob(pattern, {
    cwd: IMAGES_DIR,
    nocase: true,
    nodir: true,
    ignore: ['optimized/**'],
  });

  if (matches.length === 0) {
    console.warn('[optimize-images] No source images found.');
    await fsp.writeFile(
      MANIFEST_PATH,
      JSON.stringify({ generatedAt: new Date().toISOString(), images: {} }, null, 2),
    );
    return;
  }

  console.log(
    `[optimize-images] Found ${matches.length} source image(s). ` +
      `Generating ${WIDTHS.length} widths x ${FORMATS.length} formats with concurrency ${CONCURRENCY}.`,
  );

  const limit = pLimit(CONCURRENCY);
  const manifest = { generatedAt: new Date().toISOString(), images: {} };

  let completed = 0;
  let createdVariants = 0;
  let skippedVariants = 0;

  await Promise.all(
    matches.map((rel) =>
      limit(async () => {
        const absSource = path.join(IMAGES_DIR, rel);
        try {
          const entry = await processSource(absSource);
          const key = `/images/${toPosix(rel)}`;
          manifest.images[key] = entry;

          for (const v of entry.variants) {
            if (v.skipped) skippedVariants++;
            else createdVariants++;
          }

          completed++;
          if (completed % 10 === 0 || completed === matches.length) {
            console.log(
              `[optimize-images] Progress: ${completed}/${matches.length} ` +
                `(created=${createdVariants}, skipped=${skippedVariants})`,
            );
          }
        } catch (err) {
          console.error(`[optimize-images] FAILED on ${rel}: ${err.message}`);
        }
      }),
    ),
  );

  await fsp.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[optimize-images] Done in ${elapsed}s. ` +
      `Sources: ${matches.length}, variants created: ${createdVariants}, skipped (cached): ${skippedVariants}. ` +
      `Manifest: ${MANIFEST_PATH}`,
  );
}

main().catch((err) => {
  console.error('[optimize-images] Fatal error:', err);
  process.exit(1);
});
