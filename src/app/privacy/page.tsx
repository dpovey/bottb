import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicLayout } from '@/components/layouts'
import { ChevronLeftIcon } from '@/components/icons'
import { getBaseUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Privacy Policy | Battle of the Tech Bands',
  description:
    'Privacy Policy for Battle of the Tech Bands. Learn how we collect, use, and protect your personal information.',
  alternates: {
    canonical: `${getBaseUrl()}/privacy`,
  },
  openGraph: {
    title: 'Privacy Policy | Battle of the Tech Bands',
    description:
      'Privacy Policy for Battle of the Tech Bands. Learn how we collect, use, and protect your personal information.',
    type: 'website',
  },
}

export default function PrivacyPolicyPage() {
  return (
    <PublicLayout headerVariant="solid" footerVariant="simple">
      <main className="max-w-4xl mx-auto px-6 lg:px-8 py-16 sm:py-24">
        {/* Header */}
        <div className="mb-12">
          <p className="text-xs tracking-[0.3em] uppercase text-text-muted mb-4">
            Legal
          </p>
          <h1 className="font-bold text-3xl sm:text-4xl md:text-5xl mb-4">
            Privacy Policy
          </h1>
          <p className="text-text-muted">Last updated: December 2024</p>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-lg max-w-none">
          <div className="space-y-12">
            {/* Introduction */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                1. Introduction
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  Battle of the Tech Bands (&quot;BOTTB&quot;, &quot;we&quot;,
                  &quot;us&quot;, or &quot;our&quot;) is committed to protecting
                  your privacy. This Privacy Policy explains how we collect,
                  use, disclose, and safeguard your information when you visit
                  our website bottb.com and use our services.
                </p>
                <p>
                  We are based in Australia and comply with the Australian
                  Privacy Principles (APPs) contained in the{' '}
                  <em>Privacy Act 1988</em> (Cth). If you are accessing our
                  services from outside Australia, please be aware that your
                  information may be transferred to, stored, and processed in
                  Australia.
                </p>
              </div>
            </section>

            {/* Information We Collect */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                2. Information We Collect
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <h3 className="font-medium text-lg text-text mb-2">
                  2.1 Information You Provide
                </h3>
                <p>
                  We may collect personal information that you voluntarily
                  provide when you:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Register a band for an event</li>
                  <li>
                    Purchase tickets through third-party ticketing platforms
                  </li>
                  <li>Submit votes during events</li>
                  <li>Contact us via email or social media</li>
                  <li>Subscribe to our updates or newsletter</li>
                </ul>
                <p className="mt-4">This information may include:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    Name and contact details (email address, phone number)
                  </li>
                  <li>Company or organisation affiliation</li>
                  <li>Band member information for registered bands</li>
                  <li>Social media handles</li>
                </ul>

                <h3 className="font-medium text-lg text-text mb-2 mt-6">
                  2.2 Information Collected Automatically
                </h3>
                <p>
                  When you access our website, we may automatically collect:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Device and browser information</li>
                  <li>IP address and general location data</li>
                  <li>Pages visited and interaction patterns</li>
                  <li>
                    Device fingerprint data for vote verification (to ensure
                    voting integrity)
                  </li>
                </ul>

                <h3 className="font-medium text-lg text-text mb-2 mt-6">
                  2.3 Photographs and Media
                </h3>
                <p>
                  Events may be photographed and filmed. By attending a Battle
                  of the Tech Bands event, you acknowledge that photographs and
                  recordings may be taken and used for promotional purposes,
                  including on our website and social media channels.
                </p>
              </div>
            </section>

            {/* How We Use Your Information */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                3. How We Use Your Information
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>We use the information we collect to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    Organise and administer Battle of the Tech Bands events
                  </li>
                  <li>
                    Process band registrations and manage event participation
                  </li>
                  <li>Ensure fair voting and prevent fraudulent votes</li>
                  <li>
                    Communicate with you about events, updates, and
                    announcements
                  </li>
                  <li>Display event photographs and results on our website</li>
                  <li>Improve our website and services</li>
                  <li>Comply with legal obligations</li>
                  <li>
                    Support our charitable mission in partnership with Youngcare
                  </li>
                </ul>
              </div>
            </section>

            {/* Disclosure of Information */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                4. Disclosure of Your Information
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>We may share your information with:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong className="text-text">Service providers:</strong>{' '}
                    Including web hosting, email services, and analytics
                    providers
                  </li>
                  <li>
                    <strong className="text-text">Event partners:</strong>{' '}
                    Venues and event production companies as necessary for event
                    delivery
                  </li>
                  <li>
                    <strong className="text-text">Sponsors:</strong> Aggregate,
                    anonymised data about event attendance and engagement (never
                    personal details without consent)
                  </li>
                  <li>
                    <strong className="text-text">Youngcare:</strong> Our
                    charity partner, for fundraising coordination
                  </li>
                  <li>
                    <strong className="text-text">Legal authorities:</strong>{' '}
                    When required by law or to protect our rights
                  </li>
                </ul>
                <p className="mt-4">
                  Some of our service providers may be located overseas
                  (including the United States). By using our services, you
                  consent to the transfer of your information to these
                  jurisdictions. We take reasonable steps to ensure overseas
                  recipients handle your information in accordance with
                  Australian privacy standards.
                </p>
              </div>
            </section>

            {/* Cookies and Tracking */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                5. Cookies and Tracking Technologies
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  We use cookies and similar technologies to enhance your
                  experience on our website. These may include:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong className="text-text">Essential cookies:</strong>{' '}
                    Required for website functionality and voting systems
                  </li>
                  <li>
                    <strong className="text-text">Analytics cookies:</strong>{' '}
                    Help us understand how visitors use our website
                  </li>
                  <li>
                    <strong className="text-text">Social media cookies:</strong>{' '}
                    Enable sharing features and embedded content
                  </li>
                </ul>
                <p className="mt-4">
                  Most web browsers allow you to control cookies through
                  settings. However, disabling cookies may affect your ability
                  to use certain features, including voting.
                </p>
              </div>
            </section>

            {/* Data Security */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                6. Data Security
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  We implement appropriate technical and organisational measures
                  to protect your personal information against unauthorised
                  access, alteration, disclosure, or destruction. These measures
                  include:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Encrypted data transmission (HTTPS)</li>
                  <li>Secure data storage with access controls</li>
                  <li>Regular security reviews</li>
                </ul>
                <p className="mt-4">
                  However, no method of transmission over the internet or
                  electronic storage is 100% secure. While we strive to protect
                  your personal information, we cannot guarantee its absolute
                  security.
                </p>
              </div>
            </section>

            {/* Data Retention */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                7. Data Retention
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  We retain your personal information only for as long as
                  necessary to fulfil the purposes for which it was collected,
                  including:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Event organisation and historical records</li>
                  <li>Legal and regulatory compliance</li>
                  <li>Dispute resolution</li>
                </ul>
                <p className="mt-4">
                  Vote records may be retained indefinitely as part of our event
                  history. Photographs and media from events are retained as
                  part of our ongoing promotional archive.
                </p>
              </div>
            </section>

            {/* Your Rights */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                8. Your Rights
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>Under Australian privacy law, you have the right to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong className="text-text">Access:</strong> Request
                    access to the personal information we hold about you
                  </li>
                  <li>
                    <strong className="text-text">Correction:</strong> Request
                    correction of inaccurate or incomplete information
                  </li>
                  <li>
                    <strong className="text-text">Complaint:</strong> Lodge a
                    complaint about how we handle your personal information
                  </li>
                </ul>
                <p className="mt-4">
                  To exercise these rights, please contact us at{' '}
                  <a
                    href="mailto:info@bottb.com"
                    className="text-accent hover:text-accent-light transition-colors"
                  >
                    info@bottb.com
                  </a>
                  . We will respond to your request within a reasonable
                  timeframe.
                </p>
                <p className="mt-4">
                  If you are located in the European Union or United Kingdom,
                  you may have additional rights under GDPR. If you are a
                  California resident, you may have additional rights under
                  CCPA. Please contact us for more information.
                </p>
              </div>
            </section>

            {/* Third-Party Links */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                9. Third-Party Links
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  Our website may contain links to third-party websites,
                  including ticketing platforms, social media, and our charity
                  partner Youngcare. We are not responsible for the privacy
                  practices or content of these external sites. We encourage you
                  to review their privacy policies.
                </p>
              </div>
            </section>

            {/* Children's Privacy */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                10. Children&apos;s Privacy
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  Our services are not directed to individuals under 18 years of
                  age. We do not knowingly collect personal information from
                  children. If we become aware that we have collected personal
                  information from a child without parental consent, we will
                  take steps to delete that information.
                </p>
              </div>
            </section>

            {/* Changes to This Policy */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                11. Changes to This Policy
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  We may update this Privacy Policy from time to time. Any
                  changes will be posted on this page with an updated revision
                  date. We encourage you to review this policy periodically.
                </p>
              </div>
            </section>

            {/* Contact Us */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                12. Contact Us
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  If you have any questions about this Privacy Policy or our
                  privacy practices, please contact us:
                </p>
                <div className="bg-bg-elevated rounded-xl p-6 border border-white/5 mt-4">
                  <p className="text-white font-medium mb-2">BOTB Events Ltd</p>
                  <p className="text-sm text-text-dim mb-2">ACN 691 201 153</p>
                  <p className="text-sm text-text-dim mb-3">
                    Trading as Battle of the Tech Bands
                  </p>
                  <p>
                    Email:{' '}
                    <a
                      href="mailto:info@bottb.com"
                      className="text-accent hover:text-accent-light transition-colors"
                    >
                      info@bottb.com
                    </a>
                  </p>
                </div>
                <p className="mt-4 text-sm">
                  If you are not satisfied with our response to your privacy
                  complaint, you may contact the{' '}
                  <a
                    href="https://www.oaic.gov.au/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-light transition-colors"
                  >
                    Office of the Australian Information Commissioner (OAIC)
                  </a>
                  .
                </p>
              </div>
            </section>
          </div>
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
