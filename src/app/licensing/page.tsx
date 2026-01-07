import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicLayout } from '@/components/layouts'
import { ChevronLeftIcon, ExternalLinkIcon } from '@/components/icons'
import { getBaseUrl, DEFAULT_OG_IMAGE } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Photo Licensing | Battle of the Tech Bands',
  description:
    'Photo licensing information for Battle of the Tech Bands. Our photos are licensed under CC BY-NC 4.0 - free for non-commercial use with attribution.',
  alternates: {
    canonical: `${getBaseUrl()}/licensing`,
  },
  openGraph: {
    title: 'Photo Licensing | Battle of the Tech Bands',
    description:
      'Photo licensing information for Battle of the Tech Bands. Our photos are licensed under CC BY-NC 4.0 - free for non-commercial use with attribution.',
    type: 'website',
    images: [DEFAULT_OG_IMAGE],
  },
}

export default function LicensingPage() {
  return (
    <PublicLayout headerVariant="solid" footerVariant="simple">
      <main className="max-w-4xl mx-auto px-6 lg:px-8 py-16 sm:py-24">
        {/* Header */}
        <div className="mb-12">
          <p className="text-xs tracking-[0.3em] uppercase text-text-muted mb-4">
            Legal
          </p>
          <h1 className="font-bold text-3xl sm:text-4xl md:text-5xl mb-4">
            Photo Licensing
          </h1>
          <p className="text-text-muted">
            How you can use photos from Battle of the Tech Bands
          </p>
        </div>

        {/* Content */}
        <div className="space-y-12">
          {/* License Overview */}
          <section>
            <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
              License
            </h2>
            <div className="text-text-muted space-y-4 leading-relaxed">
              <p>
                All photos on this site are licensed under{' '}
                <a
                  href="https://creativecommons.org/licenses/by-nc/4.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent-light transition-colors inline-flex items-center gap-1"
                >
                  Creative Commons Attribution-NonCommercial 4.0 International
                  (CC BY-NC 4.0)
                  <ExternalLinkIcon className="w-3.5 h-3.5" />
                </a>
                .
              </p>
              <p>
                This means you&apos;re free to share and adapt our photos for
                non-commercial purposes, as long as you give appropriate credit.
              </p>
            </div>
          </section>

          {/* What You Can Do */}
          <section>
            <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
              What You Can Do
            </h2>
            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <ul className="space-y-3 text-text-muted">
                <li className="flex items-start gap-3">
                  <span className="text-accent mt-1">✓</span>
                  <span>
                    Share photos on social media (Facebook, Instagram, LinkedIn,
                    etc.)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent mt-1">✓</span>
                  <span>Use photos for personal, non-commercial purposes</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent mt-1">✓</span>
                  <span>
                    Use photos for band promotion and portfolios
                    (non-commercial)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent mt-1">✓</span>
                  <span>Edit, crop, or adapt photos (with attribution)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent mt-1">✓</span>
                  <span>Use photos in news articles and editorial content</span>
                </li>
              </ul>
            </div>
          </section>

          {/* What Requires Permission */}
          <section>
            <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
              What Requires Permission
            </h2>
            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <ul className="space-y-3 text-text-muted">
                <li className="flex items-start gap-3">
                  <span className="text-accent mt-1">✗</span>
                  <span>Advertising and marketing campaigns</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent mt-1">✗</span>
                  <span>Merchandise (t-shirts, posters, etc.)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent mt-1">✗</span>
                  <span>Stock photography or resale</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-accent mt-1">✗</span>
                  <span>Any commercial purpose where money changes hands</span>
                </li>
              </ul>
              <p className="mt-6 text-sm text-text-dim">
                If you&apos;re unsure whether your use case is commercial,
                please reach out — we&apos;re happy to help.
              </p>
            </div>
          </section>

          {/* How to Credit */}
          <section>
            <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
              How to Credit
            </h2>
            <div className="text-text-muted space-y-4 leading-relaxed">
              <p>When sharing photos, please include attribution:</p>
              <div className="bg-bg-surface rounded-xl p-6 border border-white/5 space-y-4">
                <div>
                  <p className="text-sm text-text-dim mb-2">
                    If the photographer is credited:
                  </p>
                  <p className="text-white font-medium">
                    &ldquo;Photo by [Photographer Name] for Battle of the Tech
                    Bands&rdquo;
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-dim mb-2">
                    If the photographer is unknown:
                  </p>
                  <p className="text-white font-medium">
                    &ldquo;Battle of the Tech Bands&rdquo;
                  </p>
                </div>
              </div>
              <p className="text-sm">
                On social media, tagging{' '}
                <span className="text-white">@battleofthetechbands</span> is
                appreciated but not required.
              </p>
            </div>
          </section>

          {/* Commercial Licensing */}
          <section>
            <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
              Commercial Licensing
            </h2>
            <div className="bg-linear-to-br from-accent/10 to-transparent rounded-xl p-6 border border-accent/20">
              <p className="text-text-muted leading-relaxed mb-4">
                For commercial use, please contact us to discuss licensing
                options. We&apos;re generally flexible and supportive of the
                tech community.
              </p>
              <a
                href="mailto:info@bottb.com?subject=Photo%20Licensing%20Inquiry"
                className="inline-flex items-center gap-2 text-accent hover:text-accent-light transition-colors font-medium"
              >
                info@bottb.com
              </a>
            </div>
          </section>

          {/* Full License Text */}
          <section>
            <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
              Full License Terms
            </h2>
            <div className="text-text-muted space-y-4 leading-relaxed">
              <p>
                The complete legal text of the CC BY-NC 4.0 license is available
                at:
              </p>
              <a
                href="https://creativecommons.org/licenses/by-nc/4.0/legalcode"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-light transition-colors inline-flex items-center gap-2"
              >
                creativecommons.org/licenses/by-nc/4.0/legalcode
                <ExternalLinkIcon className="w-4 h-4" />
              </a>
            </div>
          </section>
        </div>

        {/* Back link */}
        <div className="mt-16 pt-8 border-t border-white/5">
          <Link
            href="/"
            className="text-text-muted hover:text-white transition-colors inline-flex items-center gap-2"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </main>
    </PublicLayout>
  )
}
