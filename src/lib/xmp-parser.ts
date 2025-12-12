import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { XMLParser } from "fast-xml-parser";

// Dynamic import for exifr (ESM module)
let exifr: typeof import("exifr") | null = null;
async function getExifr() {
  if (!exifr) {
    exifr = await import("exifr");
  }
  return exifr;
}

export interface ExtractedMetadata {
  event?: string;
  photographer?: string;
  company?: string;
  band?: string;
  showOnSocial: boolean;
  dateCreated?: string;
  rawMetadata: Record<string, unknown>;
}

/**
 * Sanitize metadata for JSON storage - removes null bytes and control characters
 */
function sanitizeForJson(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    // Remove null bytes and other control characters
    return obj.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForJson);
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip numeric keys that might indicate binary data
      if (/^\d+$/.test(key) && typeof value === "number") {
        continue;
      }
      sanitized[key] = sanitizeForJson(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Parse hierarchicalSubject array (format: "Key|Value")
 */
function parseHierarchicalSubject(
  subjects: string[]
): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};

  for (const subject of subjects) {
    if (subject === "Show on Social") {
      result.showOnSocial = true;
    } else if (subject.includes("|")) {
      const [key, value] = subject.split("|", 2);
      const normalizedKey = key.toLowerCase().trim();
      result[normalizedKey] = value?.trim() || "";
    }
  }

  return result;
}

/**
 * Extract fields from parsed metadata structure
 */
function extractFieldsFromMetadata(metadata: Record<string, unknown>): {
  event?: string;
  photographer?: string;
  company?: string;
  band?: string;
  showOnSocial: boolean;
  dateCreated?: string;
} {
  let event: string | undefined;
  let photographer: string | undefined;
  let company: string | undefined;
  let band: string | undefined;
  let showOnSocial = false;
  let dateCreated: string | undefined;

  // Check for hierarchicalSubject (preferred source)
  const metadataRecord = metadata as Record<string, unknown>;
  const lrRecord = metadataRecord["lr"] as Record<string, unknown> | undefined;
  const hierarchicalSubject =
    metadataRecord.hierarchicalSubject ||
    metadataRecord.HierarchicalSubject ||
    lrRecord?.hierarchicalSubject;

  if (Array.isArray(hierarchicalSubject)) {
    const parsed = parseHierarchicalSubject(hierarchicalSubject as string[]);
    event = parsed.event as string | undefined;
    photographer = parsed.photographer as string | undefined;
    company = parsed.company as string | undefined;
    band = parsed.band as string | undefined;
    showOnSocial = Boolean(parsed.showOnSocial);
  }

  // Fallback to dc.subject if hierarchicalSubject didn't provide values
  if (!event && !photographer && !company) {
    const dcRecord = metadataRecord["dc"] as Record<string, unknown> | undefined;
    const dcSubject =
      metadataRecord.subject ||
      metadataRecord.Subject ||
      dcRecord?.subject;

    if (Array.isArray(dcSubject)) {
      // dc.subject is typically an array of tags
      for (const tag of dcSubject as string[]) {
        const lower = tag.toLowerCase();
        if (
          lower.includes("event") ||
          lower.includes("sydney") ||
          lower.includes("melbourne")
        ) {
          event = event || tag;
        } else if (
          lower.includes("photo") ||
          lower.includes("eddy") ||
          lower.includes("photographer")
        ) {
          photographer = photographer || tag;
        }
      }
    } else if (typeof dcSubject === "string") {
      // Sometimes it's a comma-separated string
      const parts = dcSubject.split(",").map((s: string) => s.trim());
      for (const part of parts) {
        const lower = part.toLowerCase();
        if (
          lower.includes("event") ||
          lower.includes("sydney") ||
          lower.includes("melbourne")
        ) {
          event = event || part;
        } else if (
          lower.includes("photo") ||
          lower.includes("eddy") ||
          lower.includes("photographer")
        ) {
          photographer = photographer || part;
        }
      }
    }
  }

  // Get date created
  const xmpRecord = metadataRecord["xmp"] as Record<string, unknown> | undefined;
  const photoshopRecord = metadataRecord["photoshop"] as Record<string, unknown> | undefined;
  dateCreated =
    (metadataRecord.CreateDate as string) ||
    (metadataRecord.DateCreated as string) ||
    (metadataRecord.DateTimeOriginal as string) ||
    (xmpRecord?.CreateDate as string) ||
    (photoshopRecord?.DateCreated as string);

  return { event, photographer, company, band, showOnSocial, dateCreated };
}

/**
 * Extract XMP metadata embedded in image file
 */
export async function extractEmbeddedXMP(
  imageBuffer: Buffer
): Promise<ExtractedMetadata | null> {
  try {
    const exifrModule = await getExifr();
    const metadata = await exifrModule.parse(imageBuffer, {
      xmp: true,
      iptc: true,
      icc: false,
      tiff: false,
      jfif: false,
      ihdr: false,
    });

    if (!metadata) {
      return null;
    }

    const fields = extractFieldsFromMetadata(metadata);

    return {
      ...fields,
      rawMetadata: sanitizeForJson(metadata) as Record<string, unknown>,
    };
  } catch (error) {
    console.error("Error extracting embedded XMP:", error);
    return null;
  }
}

/**
 * Parse XMP sidecar file (.xmp)
 */
export async function parseXMPSidecar(
  xmpPath: string
): Promise<ExtractedMetadata | null> {
  try {
    if (!existsSync(xmpPath)) {
      return null;
    }

    const xmpContent = await readFile(xmpPath, "utf-8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: true,
    });

    const parsed = parser.parse(xmpContent);
    const rdf = parsed?.xmpmeta?.RDF || parsed?.RDF;
    const description = rdf?.Description || {};

    // Extract hierarchicalSubject from sidecar
    let hierarchicalSubject: string[] = [];
    const lrHierarchical = description["lr:hierarchicalSubject"];
    if (lrHierarchical) {
      const bag = lrHierarchical.Bag || lrHierarchical;
      if (bag?.li) {
        hierarchicalSubject = Array.isArray(bag.li) ? bag.li : [bag.li];
      }
    }

    // Extract dc:subject
    let dcSubject: string[] = [];
    const dcSubjectRaw = description["dc:subject"];
    if (dcSubjectRaw) {
      const bag = dcSubjectRaw.Bag || dcSubjectRaw;
      if (bag?.li) {
        dcSubject = Array.isArray(bag.li) ? bag.li : [bag.li];
      }
    }

    const metadata: Record<string, unknown> = {
      ...description,
      hierarchicalSubject,
      subject: dcSubject,
    };

    const fields = extractFieldsFromMetadata(metadata);

    return {
      ...fields,
      rawMetadata: sanitizeForJson(metadata) as Record<string, unknown>,
    };
  } catch (error) {
    console.error("Error parsing XMP sidecar:", error);
    return null;
  }
}

/**
 * Extract metadata from image, checking both embedded XMP and sidecar
 */
export async function extractPhotoMetadata(
  imagePath: string,
  imageBuffer?: Buffer
): Promise<ExtractedMetadata> {
  // Try sidecar first (usually more complete from Lightroom)
  const xmpPath = imagePath.replace(/\.(jpe?g|png|tiff?|webp)$/i, ".xmp");
  const sidecarMetadata = await parseXMPSidecar(xmpPath);

  if (sidecarMetadata && sidecarMetadata.showOnSocial) {
    return sidecarMetadata;
  }

  // Try embedded XMP
  if (imageBuffer) {
    const embeddedMetadata = await extractEmbeddedXMP(imageBuffer);
    if (embeddedMetadata) {
      // Merge with sidecar if available
      if (sidecarMetadata) {
        return {
          event: sidecarMetadata.event || embeddedMetadata.event,
          photographer:
            sidecarMetadata.photographer || embeddedMetadata.photographer,
          company: sidecarMetadata.company || embeddedMetadata.company,
          band: sidecarMetadata.band || embeddedMetadata.band,
          showOnSocial:
            sidecarMetadata.showOnSocial || embeddedMetadata.showOnSocial,
          dateCreated:
            sidecarMetadata.dateCreated || embeddedMetadata.dateCreated,
          rawMetadata: {
            ...embeddedMetadata.rawMetadata,
            ...sidecarMetadata.rawMetadata,
          },
        };
      }
      return embeddedMetadata;
    }
  }

  // Return sidecar metadata or empty
  return (
    sidecarMetadata || {
      showOnSocial: false,
      rawMetadata: {},
    }
  );
}

