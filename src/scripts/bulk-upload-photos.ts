#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";
import { put } from "@vercel/blob";
import { readFile, readdir, stat } from "fs/promises";
import { join, basename, extname } from "path";
import { existsSync } from "fs";
import { parseArgs } from "util";

import { extractPhotoMetadata } from "../lib/xmp-parser";
import { matchEventName, matchBandName } from "../lib/name-matcher";
import { processImage } from "../lib/image-processor";

// Load environment variables
config({ path: ".env.local" });

interface UploadResult {
  success: boolean;
  filename: string;
  photoId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

interface PhotoRecord {
  id: string;
  original_filename: string;
}

/**
 * Find all image files in a directory (recursively if specified)
 */
async function findImageFiles(
  dir: string,
  recursive: boolean
): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    // Skip macOS metadata files
    if (entry.name.startsWith("._") || entry.name === ".DS_Store") {
      continue;
    }

    if (entry.isDirectory() && recursive) {
      const subFiles = await findImageFiles(fullPath, recursive);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if ([".jpg", ".jpeg", ".png", ".tiff", ".tif"].includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Check if a photo with this filename already exists
 */
async function photoExists(filename: string): Promise<boolean> {
  const { rows } = await sql<PhotoRecord>`
    SELECT id FROM photos WHERE original_filename = ${filename} LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * Upload a single photo
 */
async function uploadPhoto(
  imagePath: string,
  options: {
    eventId?: string;
    bandId?: string;
    socialOnly: boolean;
    dryRun: boolean;
    verbose: boolean;
  }
): Promise<UploadResult> {
  const filename = basename(imagePath);

  try {
    // Check for duplicates
    if (await photoExists(filename)) {
      return {
        success: false,
        filename,
        skipped: true,
        reason: "Already uploaded",
      };
    }

    // Read image file
    const imageBuffer = await readFile(imagePath);

    // Extract metadata
    const metadata = await extractPhotoMetadata(imagePath, imageBuffer);

    if (options.verbose) {
      console.log(`  📋 Metadata:`, {
        event: metadata.event,
        photographer: metadata.photographer,
        company: metadata.company,
        showOnSocial: metadata.showOnSocial,
      });
    }

    // Check social filter
    if (options.socialOnly && !metadata.showOnSocial) {
      return {
        success: false,
        filename,
        skipped: true,
        reason: "Not marked for social",
      };
    }

    // Match event
    let eventId = options.eventId;
    let matchedEventName: string | null = null;
    let eventConfidence: "exact" | "fuzzy" | "manual" | "unmatched" = "manual";

    if (!eventId && metadata.event) {
      const eventMatch = await matchEventName(metadata.event);
      if (eventMatch.id) {
        eventId = eventMatch.id;
        matchedEventName = eventMatch.name;
        eventConfidence = eventMatch.confidence;
      }
    } else if (eventId) {
      eventConfidence = "manual";
    }

    // Match band
    let bandId = options.bandId;
    let matchedBandName: string | null = null;
    let bandConfidence: "exact" | "fuzzy" | "manual" | "unmatched" = "manual";

    if (!bandId && (metadata.band || metadata.company)) {
      const bandMatch = await matchBandName(
        metadata.band || metadata.company || "",
        eventId
      );
      if (bandMatch.id) {
        bandId = bandMatch.id;
        matchedBandName = bandMatch.name;
        bandConfidence = bandMatch.confidence;
      }
    } else if (bandId) {
      bandConfidence = "manual";
    }

    // Determine overall match confidence
    const matchConfidence =
      eventConfidence === "unmatched" || bandConfidence === "unmatched"
        ? "unmatched"
        : eventConfidence === "manual" || bandConfidence === "manual"
          ? "manual"
          : eventConfidence === "fuzzy" || bandConfidence === "fuzzy"
            ? "fuzzy"
            : "exact";

    if (options.dryRun) {
      console.log(`  🧪 Would upload: ${filename}`);
      console.log(`     Event: ${eventId || "unmatched"} (${eventConfidence})`);
      console.log(`     Band: ${bandId || "unmatched"} (${bandConfidence})`);
      return { success: true, filename, skipped: true, reason: "Dry run" };
    }

    // Process image (create variants)
    const processed = await processImage(imageBuffer);

    // Generate unique photo ID
    const photoId = crypto.randomUUID();

    // Upload to blob storage
    const thumbnailBlob = await put(
      `photos/${photoId}/thumbnail.webp`,
      processed.thumbnail,
      { access: "public", contentType: "image/webp" }
    );

    const largeBlob = await put(
      `photos/${photoId}/large.webp`,
      processed.large,
      { access: "public", contentType: "image/webp" }
    );

    // Store in database
    await sql`
      INSERT INTO photos (
        id, event_id, band_id, photographer,
        blob_url, blob_pathname, original_filename,
        width, height, file_size, content_type,
        xmp_metadata, matched_event_name, matched_band_name, match_confidence,
        uploaded_at
      ) VALUES (
        ${photoId}, ${eventId}, ${bandId}, ${metadata.photographer},
        ${largeBlob.url}, ${`photos/${photoId}/large.webp`}, ${filename},
        ${processed.width}, ${processed.height}, ${processed.fileSize}, ${`image/${processed.format}`},
        ${JSON.stringify(metadata.rawMetadata)}, ${matchedEventName}, ${matchedBandName}, ${matchConfidence},
        NOW()
      )
    `;

    return { success: true, filename, photoId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, filename, error: message };
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
      recursive: { type: "boolean", default: true },
      verbose: { type: "boolean", short: "v", default: false },
      "social-only": { type: "boolean", default: false },
      event: { type: "string" },
      band: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(`
📷 Bulk Photo Upload

Usage: npm run bulk-upload-photos -- <directory> [options]

Options:
  --dry-run       Show what would be uploaded without actually uploading
  --social-only   Only upload photos marked "Show on Social"
  --event <id>    Manually assign all photos to this event ID
  --band <id>     Manually assign all photos to this band ID
  --no-recursive  Don't scan subdirectories
  -v, --verbose   Show detailed metadata for each file
  -h, --help      Show this help

Examples:
  npm run bulk-upload-photos -- /path/to/photos
  npm run bulk-upload-photos -- /path/to/photos --social-only
  npm run bulk-upload-photos -- /path/to/photos --event sydney-2025 --band the-agentics
  npm run bulk-upload-photos -- /path/to/photos --dry-run --verbose
`);
    process.exit(0);
  }

  const sourceDir = positionals[0];

  if (!existsSync(sourceDir)) {
    console.error(`❌ Directory not found: ${sourceDir}`);
    process.exit(1);
  }

  const stats = await stat(sourceDir);
  if (!stats.isDirectory()) {
    console.error(`❌ Not a directory: ${sourceDir}`);
    process.exit(1);
  }

  console.log("🚀 Starting bulk photo upload...");
  console.log(`📁 Source: ${sourceDir}`);
  console.log(`🔍 Recursive: ${values.recursive}`);
  console.log(`🧪 Dry run: ${values["dry-run"]}`);
  console.log(`📱 Social only: ${values["social-only"]}`);
  if (values.event) console.log(`🎪 Event: ${values.event}`);
  if (values.band) console.log(`🎸 Band: ${values.band}`);
  console.log("");

  // Find all images
  console.log("🔎 Scanning for images...");
  const imageFiles = await findImageFiles(sourceDir, values.recursive !== false);
  console.log(`📷 Found ${imageFiles.length} image(s)\n`);

  if (imageFiles.length === 0) {
    console.log("No images found.");
    process.exit(0);
  }

  // Upload each photo
  const results: UploadResult[] = [];
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const imagePath = imageFiles[i];
    const filename = basename(imagePath);
    console.log(`[${i + 1}/${imageFiles.length}] ${filename}`);

    const result = await uploadPhoto(imagePath, {
      eventId: values.event,
      bandId: values.band,
      socialOnly: values["social-only"] || false,
      dryRun: values["dry-run"] || false,
      verbose: values.verbose || false,
    });

    results.push(result);

    if (result.success && !result.skipped) {
      uploaded++;
      console.log(`  ✅ Uploaded (${result.photoId})`);
    } else if (result.skipped) {
      skipped++;
      console.log(`  ⏭️  Skipped: ${result.reason}`);
    } else {
      failed++;
      console.log(`  ❌ Failed: ${result.error}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  console.log(`   ✅ Uploaded: ${uploaded}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📷 Total: ${imageFiles.length}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

