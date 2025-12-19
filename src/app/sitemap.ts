import { MetadataRoute } from "next";
import {
  getEvents,
  getBandsForEvent,
  getPhotographers,
} from "@/lib/db";
import { getBaseUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const sitemapEntries: MetadataRoute.Sitemap = [];

  // Static pages
  const staticPages = [
    { path: "", priority: 1.0, changeFrequency: "daily" as const },
    { path: "/about", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/faq", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/photos", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/videos", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/songs", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/events", priority: 0.8, changeFrequency: "weekly" as const },
    { path: "/photographers", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/companies", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
  ];

  for (const page of staticPages) {
    sitemapEntries.push({
      url: `${baseUrl}${page.path}`,
      lastModified: new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    });
  }

  try {
    // Get all events
    const events = await getEvents();

    // Add event pages
    for (const event of events) {
      sitemapEntries.push({
        url: `${baseUrl}/event/${event.id}`,
        lastModified: new Date(event.created_at),
        changeFrequency: "weekly",
        priority: 0.9,
      });

      // Add results pages for finalized events
      if (event.status === "finalized") {
        sitemapEntries.push({
          url: `${baseUrl}/results/${event.id}`,
          lastModified: new Date(event.created_at),
          changeFrequency: "monthly",
          priority: 0.8,
        });
      }

      // Get bands for this event
      try {
        const bands = await getBandsForEvent(event.id);
        for (const band of bands) {
          sitemapEntries.push({
            url: `${baseUrl}/band/${band.id}`,
            lastModified: new Date(band.created_at),
            changeFrequency: "monthly",
            priority: 0.7,
          });
        }
      } catch (error) {
        console.error(`Error fetching bands for event ${event.id}:`, error);
      }
    }

    // Get photographers
    try {
      const photographers = await getPhotographers();
      for (const photographer of photographers) {
        sitemapEntries.push({
          url: `${baseUrl}/photographer/${photographer.slug}`,
          lastModified: new Date(photographer.created_at),
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    } catch (error) {
      console.error("Error fetching photographers:", error);
    }

    // Get recent photos (limit to last 1000 for sitemap size)
    // Note: Individual photo pages redirect to /photos?photo=id, so we don't need to include them
    // But if we want to include them, we can uncomment this:
    /*
    try {
      const recentPhotos = await getPhotos({ limit: 1000, orderBy: "date" });
      for (const photo of recentPhotos) {
        sitemapEntries.push({
          url: `${baseUrl}/photo/${photo.id}`,
          lastModified: photo.uploaded_at ? new Date(photo.uploaded_at) : new Date(),
          changeFrequency: "monthly",
          priority: 0.5,
        });
      }
    } catch (error) {
      console.error("Error fetching photos:", error);
    }
    */
  } catch (error) {
    console.error("Error generating sitemap:", error);
  }

  return sitemapEntries;
}

