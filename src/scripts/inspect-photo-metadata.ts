#!/usr/bin/env tsx

import { config } from "dotenv";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { basename, extname } from "path";
import { extractPhotoMetadata, extractEmbeddedXMP, parseXMPSidecar } from "../lib/xmp-parser";

// Load environment variables
config({ path: ".env.local" });

async function inspectPhoto(imagePath: string) {
  console.log("📷 Photo Metadata Inspector\n");
  console.log(`File: ${imagePath}`);
  console.log("=".repeat(60) + "\n");

  if (!existsSync(imagePath)) {
    console.error(`❌ File not found: ${imagePath}`);
    process.exit(1);
  }

  const filename = basename(imagePath);
  const ext = extname(imagePath).toLowerCase();

  if (![".jpg", ".jpeg", ".png", ".tiff", ".tif"].includes(ext)) {
    console.error(`❌ Unsupported file type: ${ext}`);
    process.exit(1);
  }

  // Read the image
  console.log("📥 Reading file...");
  const imageBuffer = await readFile(imagePath);
  console.log(`   Size: ${(imageBuffer.byteLength / 1024 / 1024).toFixed(2)} MB\n`);

  // Check for XMP sidecar
  const xmpPath = imagePath.replace(/\.(jpe?g|png|tiff?|webp)$/i, ".xmp");
  const hasSidecar = existsSync(xmpPath);
  console.log(`📄 XMP Sidecar: ${hasSidecar ? "Found" : "Not found"}`);
  if (hasSidecar) {
    console.log(`   Path: ${xmpPath}\n`);
  } else {
    console.log("");
  }

  // Extract embedded XMP
  console.log("🔍 Extracting embedded metadata...");
  const embeddedMetadata = await extractEmbeddedXMP(imageBuffer);
  
  if (embeddedMetadata) {
    console.log("\n📊 Embedded Metadata:");
    console.log("─".repeat(40));
    
    // Key fields
    console.log("\n🔑 Key Fields:");
    if (embeddedMetadata.event) {
      console.log(`   Event: ${embeddedMetadata.event}`);
    }
    if (embeddedMetadata.photographer) {
      console.log(`   Photographer: ${embeddedMetadata.photographer}`);
    }
    if (embeddedMetadata.company) {
      console.log(`   Company: ${embeddedMetadata.company}`);
    }
    if (embeddedMetadata.band) {
      console.log(`   Band: ${embeddedMetadata.band}`);
    }
    console.log(`   Show on Social: ${embeddedMetadata.showOnSocial ? "✅ Yes" : "❌ No"}`);
    if (embeddedMetadata.dateCreated) {
      console.log(`   Date Created: ${embeddedMetadata.dateCreated}`);
    }

    // Raw metadata segments
    console.log("\n📦 Raw Metadata Segments:");
    const raw = embeddedMetadata.rawMetadata;
    
    // Check for hierarchicalSubject
    if (raw.hierarchicalSubject || raw.HierarchicalSubject) {
      const hs = raw.hierarchicalSubject || raw.HierarchicalSubject;
      console.log(`   hierarchicalSubject: ${JSON.stringify(hs, null, 2).split('\n').join('\n   ')}`);
    }
    
    // Check for dc:subject
    if (raw.subject || raw.Subject) {
      const subj = raw.subject || raw.Subject;
      console.log(`   dc:subject: ${JSON.stringify(subj, null, 2).split('\n').join('\n   ')}`);
    }

    // List all top-level keys
    console.log("\n📋 All Top-Level Keys:");
    const keys = Object.keys(raw).sort();
    for (const key of keys) {
      const value = raw[key];
      const type = Array.isArray(value) ? "array" : typeof value;
      const preview = type === "string" 
        ? `"${String(value).substring(0, 50)}${String(value).length > 50 ? "..." : ""}"`
        : type === "array" 
          ? `[${(value as unknown[]).length} items]`
          : type === "object"
            ? "{...}"
            : String(value);
      console.log(`   ${key}: ${preview}`);
    }
  } else {
    console.log("   No embedded metadata found.\n");
  }

  // Extract sidecar metadata if available
  if (hasSidecar) {
    console.log("\n📄 Sidecar Metadata:");
    console.log("─".repeat(40));
    
    const sidecarMetadata = await parseXMPSidecar(xmpPath);
    
    if (sidecarMetadata) {
      console.log("\n🔑 Key Fields:");
      if (sidecarMetadata.event) {
        console.log(`   Event: ${sidecarMetadata.event}`);
      }
      if (sidecarMetadata.photographer) {
        console.log(`   Photographer: ${sidecarMetadata.photographer}`);
      }
      if (sidecarMetadata.company) {
        console.log(`   Company: ${sidecarMetadata.company}`);
      }
      if (sidecarMetadata.band) {
        console.log(`   Band: ${sidecarMetadata.band}`);
      }
      console.log(`   Show on Social: ${sidecarMetadata.showOnSocial ? "✅ Yes" : "❌ No"}`);
      if (sidecarMetadata.dateCreated) {
        console.log(`   Date Created: ${sidecarMetadata.dateCreated}`);
      }
    } else {
      console.log("   Failed to parse sidecar file.\n");
    }
  }

  // Combined extraction
  console.log("\n" + "=".repeat(60));
  console.log("🎯 Combined Extraction Result:");
  console.log("─".repeat(40));
  
  const combined = await extractPhotoMetadata(imagePath, imageBuffer);
  console.log(`   Event: ${combined.event || "(not found)"}`);
  console.log(`   Photographer: ${combined.photographer || "(not found)"}`);
  console.log(`   Company: ${combined.company || "(not found)"}`);
  console.log(`   Band: ${combined.band || "(not found)"}`);
  console.log(`   Show on Social: ${combined.showOnSocial ? "✅ Yes" : "❌ No"}`);
  console.log(`   Date Created: ${combined.dateCreated || "(not found)"}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
📷 Photo Metadata Inspector

Usage: npm run inspect-photo -- <image-path>

Extracts and displays all XMP metadata from a photo file,
including embedded metadata and XMP sidecar files.

Examples:
  npm run inspect-photo -- /path/to/photo.jpg
  npm run inspect-photo -- "./My Photo.JPG"
`);
    process.exit(0);
  }

  await inspectPhoto(args[0]);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

