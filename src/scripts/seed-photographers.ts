import { sql } from "@vercel/postgres";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

interface PhotographerSeed {
  slug: string;
  name: string;
  bio: string;
  location: string;
  website: string | null;
  instagram: string | null;
  email: string | null;
}

const photographers: PhotographerSeed[] = [
  {
    slug: "eddy-hill",
    name: "Eddy Hill",
    bio: "Sydney-based photographer shooting gigs since 2019. What started as a pandemic hobby has become an undeniable passion. With 300+ bands captured at iconic venues like the Factory Theatre, Metro Theatre, Marys Underground, The Lansdowne, and Drifters Wharf, Eddy's strength lies in building relationships with the bands he works with. This connection allows him to capture not just the excitement and raw energy of performances, but also those special backstage moments and post-show euphoria.",
    location: "Sydney, Australia",
    website: "https://www.eddyhillphotography.com/",
    instagram: "https://www.instagram.com/eddyhill_gigphotography/",
    email: null,
  },
  {
    slug: "rod-hunt",
    name: "Rod Hunt",
    bio: "Professional photographer specialising in live music photoshoots and portraiture for the music and creative arts industry. With 25+ years of experience and know-how in Australia and internationally, Rod brings expertise and passion to every shoot.",
    location: "Australia",
    website: "https://www.rodhunt.com.au/",
    instagram: "https://www.instagram.com/rodhuntphotog/",
    email: null,
  },
  {
    slug: "renee-andrews",
    name: "Renee Andrews",
    bio: "Brisbane-based photographer specialising in fitness, events, and brand photography. With a focus on creativity and collaboration, Renee works closely with clients to bring their vision to life through the lens, capturing the emotion and energy of each moment.",
    location: "Brisbane, Australia",
    website: "https://reneeandrews.com.au/",
    instagram: null,
    email: null,
  },
  {
    slug: "jacob-briant",
    name: "Jacob Briant",
    bio: "With over 19 years of music behind him, Jacob understands the passion, intensity, and atmosphere that make live performances unforgettable. His photography is dedicated to preserving these moments—whether it's the raw emotion of a solo artist, the energy of a full band, or the electric connection between performers and the crowd. While live music is his specialty, he also covers festivals, studio sessions, and promotional shoots.",
    location: "Australia",
    website: "https://jacobbriantphotography.com.au/",
    instagram: "https://www.instagram.com/j.b_photo/",
    email: null,
  },
];

async function seed() {
  console.log("🚀 Starting photographer seed...\n");

  try {
    // First ensure the table exists
    const { rows: tables } = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'photographers'
    `;

    if (tables.length === 0) {
      console.log("📝 Creating photographers table...");
      await sql`
        CREATE TABLE IF NOT EXISTS photographers (
          slug VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          bio TEXT,
          location VARCHAR(255),
          website TEXT,
          instagram TEXT,
          email TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_photographers_name ON photographers(name)
      `;
      console.log("✅ Table created.\n");
    }

    // Insert or update photographers
    for (const photographer of photographers) {
      console.log(`📸 Processing ${photographer.name}...`);

      // Check if photographer exists
      const { rows: existing } = await sql`
        SELECT slug FROM photographers WHERE slug = ${photographer.slug}
      `;

      if (existing.length > 0) {
        // Update existing
        await sql`
          UPDATE photographers SET
            name = ${photographer.name},
            bio = ${photographer.bio},
            location = ${photographer.location},
            website = ${photographer.website},
            instagram = ${photographer.instagram},
            email = ${photographer.email}
          WHERE slug = ${photographer.slug}
        `;
        console.log(`   ↻ Updated ${photographer.name}`);
      } else {
        // Insert new
        await sql`
          INSERT INTO photographers (slug, name, bio, location, website, instagram, email)
          VALUES (
            ${photographer.slug},
            ${photographer.name},
            ${photographer.bio},
            ${photographer.location},
            ${photographer.website},
            ${photographer.instagram},
            ${photographer.email}
          )
        `;
        console.log(`   ✓ Added ${photographer.name}`);
      }
    }

    console.log("\n✨ Seed completed successfully!");
    console.log(`   ${photographers.length} photographers processed.`);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

seed();



