#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";
import { put } from "@vercel/blob";
import { readFile, readdir, stat } from "fs/promises";
import { join, basename, extname } from "path";
import { existsSync } from "fs";
import { parseArgs } from "util";

import { extractPhotoMetadata } from "../lib/xmp-parser";
import { matchEventName, matchBandName, debugMatchBandName } from "../lib/name-matcher";
import { processImage } from "../lib/image-processor";

// Load environment variables
config({ path: ".env.local" });

interface EventRow {
  id: string;
  name: string;
}

interface BandRow {
  id: string;
  name: string;
  event_id: string;
}

/**
 * Validate that an event ID exists, with fuzzy matching suggestions
 */
async function validateEventId(eventId: string): Promise<{ valid: boolean; suggestion?: string }> {
  // Check exact match
  const { rows: exact } = await sql<EventRow>`
    SELECT id, name FROM events WHERE id = ${eventId}
  `;
  if (exact.length > 0) {
    return { valid: true };
  }

  // Try fuzzy match on ID or name
  const { rows: allEvents } = await sql<EventRow>`SELECT id, name FROM events`;
  
  const normalizedInput = eventId.toLowerCase().replace(/[^a-z0-9]/g, "");
  let bestMatch: EventRow | null = null;
  let bestScore = 0;

  for (const event of allEvents) {
    const normalizedId = event.id.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normalizedName = event.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    
    // Check if input is contained in ID or name
    if (normalizedId.includes(normalizedInput) || normalizedInput.includes(normalizedId)) {
      const score = normalizedId === normalizedInput ? 1 : 0.8;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = event;
      }
    }
    if (normalizedName.includes(normalizedInput) || normalizedInput.includes(normalizedName)) {
      const score = 0.7;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = event;
      }
    }
  }

  if (bestMatch && bestScore >= 0.7) {
    return { valid: false, suggestion: bestMatch.id };
  }

  return { valid: false };
}

/**
 * Validate that a band ID exists, with fuzzy matching suggestions
 */
async function validateBandId(bandId: string, eventId?: string): Promise<{ valid: boolean; suggestion?: string }> {
  // Check exact match
  const { rows: exact } = await sql<BandRow>`
    SELECT id, name, event_id FROM bands WHERE id = ${bandId}
  `;
  if (exact.length > 0) {
    // If event specified, verify band belongs to that event
    if (eventId && exact[0].event_id !== eventId) {
      console.error(`⚠️  Warning: Band "${exact[0].name}" belongs to event "${exact[0].event_id}", not "${eventId}"`);
    }
    return { valid: true };
  }

  // Try fuzzy match
  let allBands: BandRow[];
  if (eventId) {
    const { rows } = await sql<BandRow>`SELECT id, name, event_id FROM bands WHERE event_id = ${eventId}`;
    allBands = rows;
  } else {
    const { rows } = await sql<BandRow>`SELECT id, name, event_id FROM bands`;
    allBands = rows;
  }
  
  const normalizedInput = bandId.toLowerCase().replace(/[^a-z0-9]/g, "");
  let bestMatch: BandRow | null = null;
  let bestScore = 0;

  for (const band of allBands) {
    const normalizedId = band.id.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normalizedName = band.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    
    if (normalizedId.includes(normalizedInput) || normalizedInput.includes(normalizedId)) {
      const score = normalizedId === normalizedInput ? 1 : 0.8;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = band;
      }
    }
    if (normalizedName.includes(normalizedInput) || normalizedInput.includes(normalizedName)) {
      const score = 0.7;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = band;
      }
    }
  }

  if (bestMatch && bestScore >= 0.7) {
    return { valid: false, suggestion: bestMatch.id };
  }

  return { valid: false };
}

interface UploadResult {
  success: boolean;
  filename: string;
  photoId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
  // Summary data for compact output
  summary?: {
    exists: boolean;
    event?: string;
    eventConfidence?: string;
    band?: string;
    bandConfidence?: string;
    company?: string;
    photographer?: string;
    social: boolean;
    // Debug info
    bestScore?: number;
    candidates?: Array<{ name: string; id: string; score: number }>;
  };
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
    summary: boolean;
    debug: boolean;
  }
): Promise<UploadResult> {
  const filename = basename(imagePath);

  try {
    // Check for duplicates
    const exists = await photoExists(filename);
    
    // For summary mode, we still need to extract metadata even if file exists
    if (exists && !options.summary) {
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
      if (options.summary) {
        return {
          success: false,
          filename,
          skipped: true,
          reason: "Not marked for social",
          summary: {
            exists,
            company: metadata.company,
            photographer: metadata.photographer,
            social: metadata.showOnSocial,
          },
        };
      }
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
    let debugBestScore: number | undefined;
    let debugCandidates: Array<{ name: string; id: string; score: number }> | undefined;

    if (!bandId && (metadata.band || metadata.company)) {
      const bandNameToMatch = metadata.band || metadata.company || "";
      
      if (options.debug) {
        // Use debug version for detailed matching info
        const bandMatch = await debugMatchBandName(bandNameToMatch, eventId);
        if (bandMatch.id) {
          bandId = bandMatch.id;
          matchedBandName = bandMatch.name;
          bandConfidence = bandMatch.confidence;
        }
        debugBestScore = bandMatch.bestScore;
        debugCandidates = bandMatch.candidates;
      } else {
        const bandMatch = await matchBandName(bandNameToMatch, eventId);
        if (bandMatch.id) {
          bandId = bandMatch.id;
          matchedBandName = bandMatch.name;
          bandConfidence = bandMatch.confidence;
        }
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

    // Summary mode - return compact data for single-line output
    if (options.summary) {
      return {
        success: !exists,
        filename,
        skipped: exists,
        reason: exists ? "Already uploaded" : undefined,
        summary: {
          exists,
          event: eventId || undefined,
          eventConfidence,
          band: matchedBandName || bandId || undefined,
          bandConfidence,
          company: metadata.company,
          photographer: metadata.photographer,
          social: metadata.showOnSocial,
          bestScore: debugBestScore,
          candidates: debugCandidates,
        },
      };
    }

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
    const _thumbnailBlob = await put(
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
      summary: { type: "boolean", short: "s", default: false },
      debug: { type: "boolean", short: "d", default: false },
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
  -s, --summary   Compact one-line summary per photo (implies --dry-run)
  -d, --debug     Show band matching debug info (use with --summary)
  -v, --verbose   Show detailed metadata for each file
  -h, --help      Show this help

Examples:
  npm run bulk-upload-photos -- /path/to/photos
  npm run bulk-upload-photos -- /path/to/photos --social-only
  npm run bulk-upload-photos -- /path/to/photos --event sydney-2025 --band the-agentics
  npm run bulk-upload-photos -- /path/to/photos --dry-run --verbose
  npm run bulk-upload-photos -- /path/to/photos --summary
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

  // Validate event ID if specified
  if (values.event) {
    const eventValidation = await validateEventId(values.event);
    if (!eventValidation.valid) {
      console.error(`❌ Event not found: "${values.event}"`);
      if (eventValidation.suggestion) {
        console.error(`   Did you mean: "${eventValidation.suggestion}"?`);
        console.error(`   Run again with: --event ${eventValidation.suggestion}`);
      } else {
        // List available events
        const { rows } = await sql<EventRow>`SELECT id, name FROM events ORDER BY name`;
        console.error(`\n   Available events:`);
        for (const event of rows) {
          console.error(`     - ${event.id} (${event.name})`);
        }
      }
      process.exit(1);
    }
  }

  // Validate band ID if specified
  if (values.band) {
    const bandValidation = await validateBandId(values.band, values.event);
    if (!bandValidation.valid) {
      console.error(`❌ Band not found: "${values.band}"`);
      if (bandValidation.suggestion) {
        console.error(`   Did you mean: "${bandValidation.suggestion}"?`);
        console.error(`   Run again with: --band ${bandValidation.suggestion}`);
      } else {
        // List available bands (for event if specified)
        if (values.event) {
          const { rows } = await sql<BandRow>`SELECT id, name FROM bands WHERE event_id = ${values.event} ORDER BY name`;
          console.error(`\n   Available bands for event "${values.event}":`);
          for (const band of rows) {
            console.error(`     - ${band.id} (${band.name})`);
          }
        } else {
          console.error(`   Tip: Specify --event first to see available bands for that event`);
        }
      }
      process.exit(1);
    }
  }

  const isSummary = values.summary || false;
  const isDryRun = values["dry-run"] || isSummary; // summary implies dry-run

  if (!isSummary) {
    console.log("🚀 Starting bulk photo upload...");
    console.log(`📁 Source: ${sourceDir}`);
    console.log(`🔍 Recursive: ${values.recursive}`);
    console.log(`🧪 Dry run: ${isDryRun}`);
    console.log(`📱 Social only: ${values["social-only"]}`);
    if (values.event) console.log(`🎪 Event: ${values.event}`);
    if (values.band) console.log(`🎸 Band: ${values.band}`);
    console.log("");
    console.log("🔎 Scanning for images...");
  }

  // Find all images
  const imageFiles = await findImageFiles(sourceDir, values.recursive !== false);
  
  if (!isSummary) {
    console.log(`📷 Found ${imageFiles.length} image(s)\n`);
  }

  if (imageFiles.length === 0) {
    console.log("No images found.");
    process.exit(0);
  }

  // Summary mode header
  if (isSummary) {
    console.log("# Photo Upload Summary");
    console.log(`# Source: ${sourceDir}`);
    console.log(`# Found: ${imageFiles.length} image(s)`);
    if (values.event) console.log(`# Event override: ${values.event}`);
    if (values.band) console.log(`# Band override: ${values.band}`);
    console.log("#");
    console.log("# STATUS | FILENAME | EVENT | BAND | COMPANY | SOCIAL");
    console.log("# " + "-".repeat(70));
  }

  // Upload each photo
  const results: UploadResult[] = [];
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < imageFiles.length; i++) {
    const imagePath = imageFiles[i];
    const filename = basename(imagePath);
    
    if (!isSummary) {
      console.log(`[${i + 1}/${imageFiles.length}] ${filename}`);
    }

    const result = await uploadPhoto(imagePath, {
      eventId: values.event,
      bandId: values.band,
      socialOnly: values["social-only"] || false,
      dryRun: isDryRun,
      verbose: values.verbose || false,
      summary: isSummary,
      debug: values.debug || false,
    });

    results.push(result);

    if (isSummary) {
      if (result.summary) {
        // Compact single-line output
        const s = result.summary;
        const status = s.exists ? "EXISTS" : "NEW   ";
        const event = s.event || "-";
        const band = s.band || "-";
        const company = s.company || "-";
        const social = s.social ? "✓" : "-";
        console.log(`${status} | ${filename} | ${event} | ${band} | ${company} | ${social}`);
        
        // Show debug info if available and no match was found
        if (values.debug && s.candidates && s.candidates.length > 0 && !s.band) {
          const scoreStr = s.bestScore !== undefined ? ` (best: ${(s.bestScore * 100).toFixed(0)}%)` : "";
          console.log(`       └─ No match${scoreStr}. Candidates: ${s.candidates.map(c => `${c.name} (${(c.score * 100).toFixed(0)}%)`).join(", ")}`);
        }
        
        if (s.exists) {
          skipped++;
        } else {
          uploaded++;
        }
      } else if (result.error) {
        // Error during processing
        console.log(`ERROR  | ${filename} | ${result.error}`);
        failed++;
      }
    } else if (result.success && !result.skipped) {
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

  // Final summary
  if (isSummary) {
    console.log("#");
    console.log(`# Total: ${imageFiles.length} | New: ${uploaded} | Exists: ${skipped} | Failed: ${failed}`);
  } else {
    console.log("\n" + "=".repeat(50));
    console.log("📊 Summary:");
    console.log(`   ✅ Uploaded: ${uploaded}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📷 Total: ${imageFiles.length}`);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

