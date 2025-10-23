#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";
import { uploadImage, generateBandImageFilename } from "../lib/blob";
import { readFileSync, existsSync } from "fs";
import { extname, basename } from "path";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function uploadBandLogo(bandId: string, filePath: string) {
  try {
    console.log(`🎸 Uploading logo for band: ${bandId}`);
    console.log(`📁 Source file: ${filePath}`);

    // Check if file exists
    if (!existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }

    // First, verify the band exists
    const { rows: bandRows } = await sql`
      SELECT id, name FROM bands WHERE id = ${bandId}
    `;

    if (bandRows.length === 0) {
      console.error(`❌ Band with ID ${bandId} not found`);
      process.exit(1);
    }

    const band = bandRows[0];
    console.log(`✅ Found band: ${band.name}`);

    // Read the file
    console.log("📥 Reading file...");
    const fileBuffer = readFileSync(filePath);
    const fileExtension = extname(filePath);
    const _fileName = basename(filePath, fileExtension);

    // Determine MIME type based on extension
    const mimeTypes: { [key: string]: string } = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };

    const mimeType = mimeTypes[fileExtension.toLowerCase()] || "image/png";
    console.log(`📄 File type: ${mimeType}`);

    const imageFile = new File([fileBuffer], `logo${fileExtension}`, {
      type: mimeType,
    });

    // Generate filename for blob storage with preserved extension
    const filename = generateBandImageFilename(
      bandId,
      `logo${fileExtension}`,
      "logo"
    );
    console.log(`📁 Blob filename: ${filename}`);

    // Upload to blob storage
    console.log("☁️  Uploading to Vercel Blob...");
    const result = await uploadImage(imageFile, filename, {
      access: "public",
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000, // 1 year
    });

    console.log(`✅ Upload successful!`);
    console.log(`🔗 Blob URL: ${result.url}`);

    // Update the band's info column with the logo URL
    console.log("💾 Updating database...");
    await sql`
      UPDATE bands 
      SET info = jsonb_set(
        COALESCE(info, '{}'::jsonb), 
        '{logo_url}', 
        ${JSON.stringify(result.url)}::jsonb
      )
      WHERE id = ${bandId}
    `;

    console.log("✅ Database updated successfully!");
    console.log(`🎉 Logo uploaded and linked to band: ${band.name}`);
    console.log(`🔗 Logo URL: ${result.url}`);
  } catch (error) {
    console.error("❌ Upload failed:", error);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.log("Usage: npm run upload-band-logo <band-id> <file-path>");
    console.log("");
    console.log("Example:");
    console.log("npm run upload-band-logo canvanauts-sydney-2025 ./logo.png");
    console.log(
      "npm run upload-band-logo the-agentics-sydney-2025 /path/to/logo.jpg"
    );
    process.exit(1);
  }

  const [bandId, filePath] = args;
  await uploadBandLogo(bandId, filePath);
}

main();
