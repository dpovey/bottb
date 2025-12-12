#!/usr/bin/env tsx

import { config } from "dotenv";
import { sql } from "@vercel/postgres";
import { del, list } from "@vercel/blob";

// Load environment variables from .env.local
config({ path: ".env.local" });

interface PhotoRow {
  id: string;
  blob_url: string;
  blob_pathname: string;
  original_filename: string;
}

async function deleteAllPhotos() {
  console.log("🗑️  Delete All Photos\n");
  console.log("This will delete ALL photos from:");
  console.log("  - Vercel Blob storage");
  console.log("  - PostgreSQL database\n");

  // Get count first
  const { rows: countRows } = await sql<{ count: string }>`
    SELECT COUNT(*) as count FROM photos
  `;
  const photoCount = parseInt(countRows[0]?.count || "0", 10);

  if (photoCount === 0) {
    console.log("No photos found in database.");
    return;
  }

  console.log(`Found ${photoCount} photo(s) in database.\n`);

  // Ask for confirmation via command line arg
  const args = process.argv.slice(2);
  if (!args.includes("--confirm")) {
    console.log("⚠️  To proceed, run with --confirm flag:");
    console.log("   npm run delete-all-photos -- --confirm");
    console.log("\nOr to delete specific photo:");
    console.log("   npm run delete-all-photos -- --id <photo-id>");
    return;
  }

  // Check for specific photo ID
  const idIndex = args.indexOf("--id");
  if (idIndex !== -1 && args[idIndex + 1]) {
    const photoId = args[idIndex + 1];
    await deletePhotoById(photoId);
    return;
  }

  // Delete all photos
  console.log("Starting deletion...\n");

  // First, delete all blobs in the photos/ prefix
  console.log("🗂️  Deleting blob storage files...");
  try {
    let cursor: string | undefined;
    let deletedBlobs = 0;

    do {
      const result = await list({ prefix: "photos/", limit: 100, cursor });
      
      for (const blob of result.blobs) {
        try {
          await del(blob.url);
          deletedBlobs++;
          if (deletedBlobs % 10 === 0) {
            console.log(`   Deleted ${deletedBlobs} blobs...`);
          }
        } catch (error) {
          console.error(`   Failed to delete blob: ${blob.pathname}`, error);
        }
      }

      cursor = result.cursor;
    } while (cursor);

    console.log(`   ✅ Deleted ${deletedBlobs} blob files\n`);
  } catch (error) {
    console.error("   ❌ Error deleting blobs:", error);
  }

  // Then delete all database records
  console.log("💾 Deleting database records...");
  try {
    const { rowCount } = await sql`DELETE FROM photos`;
    console.log(`   ✅ Deleted ${rowCount} database records\n`);
  } catch (error) {
    console.error("   ❌ Error deleting database records:", error);
  }

  console.log("✨ Done!");
}

async function deletePhotoById(photoId: string) {
  console.log(`Deleting photo: ${photoId}\n`);

  // Get photo from database
  const { rows } = await sql<PhotoRow>`
    SELECT id, blob_url, blob_pathname, original_filename 
    FROM photos WHERE id = ${photoId}
  `;

  if (rows.length === 0) {
    console.log("❌ Photo not found");
    return;
  }

  const photo = rows[0];
  console.log(`Found: ${photo.original_filename}`);

  // Extract the photo folder path to delete all variants
  const pathParts = photo.blob_pathname.split("/");
  const photoFolder = pathParts.slice(0, 2).join("/"); // photos/{photoId}

  console.log(`Deleting blobs in: ${photoFolder}/`);

  // Delete all blobs in this photo's folder
  try {
    const result = await list({ prefix: `${photoFolder}/` });
    for (const blob of result.blobs) {
      await del(blob.url);
      console.log(`   Deleted: ${blob.pathname}`);
    }
  } catch (error) {
    console.error("Error deleting blobs:", error);
  }

  // Delete database record
  try {
    await sql`DELETE FROM photos WHERE id = ${photoId}`;
    console.log(`   Deleted database record`);
  } catch (error) {
    console.error("Error deleting database record:", error);
  }

  console.log("\n✨ Done!");
}

deleteAllPhotos().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

