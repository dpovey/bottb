import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PublicLayout } from "@/components/layouts";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "About | Battle of the Tech Bands",
  description:
    "Battle of the Tech Bands is a community-run charity event where engineers who code by day rock by night, raising money for Youngcare.",
  openGraph: {
    title: "About | Battle of the Tech Bands",
    description:
      "Battle of the Tech Bands is a community-run charity event where engineers who code by day rock by night, raising money for Youngcare.",
    type: "website",
  },
};

// Social links for hero
const socialLinks = [
  {
    href: "https://linkedin.com/company/bottb",
    label: "LinkedIn",
    icon: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    href: "https://youtube.com/@bottb",
    label: "YouTube",
    icon: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    href: "https://instagram.com/bottb",
    label: "Instagram",
    icon: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
      </svg>
    ),
  },
  {
    href: "https://facebook.com/bottb",
    label: "Facebook",
    icon: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    href: "https://tiktok.com/@bottb",
    label: "TikTok",
    icon: (
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
];

export default function AboutPage() {
  return (
    <PublicLayout headerVariant="transparent" footerVariant="full">
      {/* Hero Section */}
      <section className="relative min-h-[70vh] flex items-end">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1920&q=80"
            alt="Concert crowd"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/30 via-transparent to-indigo-900/20" />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8 pb-16">
          <p className="text-xs tracking-[0.3em] uppercase text-text-muted mb-4">
            Est. 2022 • Community Charity Event
          </p>
          <h1 className="font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-4 leading-tight">
            Code by Day.
            <br />
            <span className="text-accent">Rock by Night.</span>
          </h1>
          <p className="text-text-muted text-lg sm:text-xl max-w-xl mb-8">
            Engineers who refuse to stay in their lanes.
          </p>

          {/* Social Icons */}
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                {social.icon}
              </a>
            ))}
            <span className="text-text-dim mx-2">|</span>
            <a
              href="mailto:info@bottb.com"
              className="text-text-muted hover:text-white transition-colors text-sm"
            >
              info@bottb.com
            </a>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 lg:px-8 pb-24">
        {/* Mission Statement */}
        <section className="mb-20">
          <div className="bg-bg-elevated rounded-2xl p-8 md:p-12 border border-white/5">
            <h2 className="font-semibold text-2xl sm:text-3xl mb-6">
              What is Battle of the Tech Bands?
            </h2>
            <div className="space-y-6 text-text-muted text-lg leading-relaxed">
              <p>
                <strong className="text-white">
                  BoTTB isn&apos;t a corporate or policy-driven event
                </strong>{" "}
                — it&apos;s a community-run charity gig, created by musicians
                who just happen to work in tech.
              </p>
              <p>
                Every dollar raised (with the exception of generous sponsorship
                from{" "}
                <strong className="text-white">Jumbo Interactive</strong>) comes
                from ticket sales and personal contributions from band members,
                friends and family.
              </p>
              <p>
                The spirit of Battle of the Tech Bands has always been about
                celebrating human creativity —{" "}
                <strong className="text-white">
                  real people performing together
                </strong>{" "}
                to help young people with physical support needs through{" "}
                <strong className="text-accent">Youngcare</strong>. ❤️
              </p>
            </div>
          </div>
        </section>

        {/* Taglines */}
        <section className="mb-20">
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-bg-surface rounded-xl p-6 border border-white/5 text-center">
              <p className="text-xl sm:text-2xl font-medium">
                &ldquo;Where tech goes loud.&rdquo;
              </p>
            </div>
            <div className="bg-bg-surface rounded-xl p-6 border border-white/5 text-center">
              <p className="text-xl sm:text-2xl font-medium">
                &ldquo;From stand-ups to standing ovations.&rdquo;
              </p>
            </div>
          </div>
        </section>

        {/* About Youngcare */}
        <section className="mb-20">
          <h2 className="font-semibold text-2xl sm:text-3xl mb-6">
            Supporting Youngcare
          </h2>
          <div className="bg-gradient-to-br from-accent/10 to-transparent rounded-2xl p-8 md:p-12 border border-accent/20">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="shrink-0 w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-xl mb-3">Why Youngcare?</h3>
                <p className="text-text-muted leading-relaxed mb-4">
                  Youngcare is an Australian charity fighting to ensure young
                  people with high care needs get the choice, control, and
                  independence they deserve — not left to live in aged care.
                </p>
                <p className="text-text-muted leading-relaxed">
                  Every ticket sold, every donation made, goes directly to
                  supporting young Australians who need physical support to live
                  their best lives.
                </p>
                <a
                  href="https://www.youngcare.com.au"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-6 text-accent hover:text-accent-light transition-colors"
                >
                  Learn more about Youngcare
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-20">
          <h2 className="font-semibold text-2xl sm:text-3xl mb-8">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-accent">1</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Form a Band</h3>
              <p className="text-text-muted text-sm">
                Gather your colleagues, friends, or anyone in tech who can hold
                a tune (or fake it convincingly).
              </p>
            </div>
            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-accent">2</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Perform Live</h3>
              <p className="text-text-muted text-sm">
                Take the stage at a real venue, in front of a real crowd. No
                lip-syncing. No auto-tune. Just raw talent.
              </p>
            </div>
            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center mb-4">
                <span className="text-xl font-bold text-accent">3</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Raise Money</h3>
              <p className="text-text-muted text-sm">
                Every ticket, every vote, every dollar goes to supporting young
                Australians through Youngcare.
              </p>
            </div>
          </div>
        </section>

        {/* History */}
        <section className="mb-20">
          <h2 className="font-semibold text-2xl sm:text-3xl mb-6">Our Story</h2>
          <div className="space-y-6">
            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 text-center">
                  <p className="text-2xl font-bold text-accent">2022</p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    The Beginning — Black Bear Lodge
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    It all started at Brisbane&apos;s iconic{" "}
                    <strong className="text-white">Black Bear Lodge</strong> in
                    Fortitude Valley — a beloved venue known for its intimate
                    atmosphere and rich musical heritage. Four bands took the
                    stage: Jumbo, Rex, FoundU, and Teach Starter.{" "}
                    <strong className="text-white">Jumbo</strong> took home the
                    inaugural trophy.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 text-center">
                  <p className="text-2xl font-bold text-accent">2023</p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    Moving to The Triffid
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    The event outgrew its original home and moved to{" "}
                    <strong className="text-white">The Triffid</strong> in
                    Newstead — one of Brisbane&apos;s premier live music venues.
                    Five bands competed: Jumbo, Rex, CitrusAd, TechnologyOne,
                    and FoundU.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 text-center">
                  <p className="text-2xl font-bold text-accent">2024</p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Growing Strong</h3>
                  <p className="text-text-muted leading-relaxed">
                    The Triffid remained our home as five more bands battled it
                    out. The tech community showed up in force, and the funds
                    raised for Youngcare continued to grow.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 text-center">
                  <p className="text-2xl font-bold text-accent">2025</p>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    Expanding to Sydney
                  </h3>
                  <p className="text-text-muted leading-relaxed">
                    For the first time, Battle of the Tech Bands goes
                    interstate! Brisbane continues at The Triffid, while Sydney
                    joins the movement with its own event at{" "}
                    <strong className="text-white">The Factory Theatre</strong>.
                    Ten bands across two cities — the biggest year yet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sponsor Acknowledgment */}
        <section className="mb-20">
          <div className="text-center">
            <p className="text-xs tracking-[0.2em] uppercase text-text-dim mb-4">
              Proudly Supported By
            </p>
            <div className="inline-flex items-center justify-center gap-8 opacity-60 hover:opacity-100 transition-opacity">
              <span className="text-text-muted text-lg font-medium">
                Jumbo Interactive
              </span>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="font-semibold text-2xl sm:text-3xl mb-4">
            Ready to Rock?
          </h2>
          <p className="text-text-muted mb-8 max-w-xl mx-auto">
            Whether you&apos;re forming a band, buying tickets, or just
            spreading the word — every bit helps.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/">
              <Button variant="filled" size="lg">
                View Events
              </Button>
            </Link>
            <Link href="mailto:info@bottb.com">
              <Button variant="outline" size="lg">
                Register a Band
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}

