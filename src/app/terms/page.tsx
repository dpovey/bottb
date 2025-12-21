import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicLayout } from '@/components/layouts'
import { ChevronLeftIcon } from '@/components/icons'

export const metadata: Metadata = {
  title: 'Terms of Use | Battle of the Tech Bands',
  description:
    'Terms of Use for Battle of the Tech Bands website. Please read these terms carefully before using our services.',
  openGraph: {
    title: 'Terms of Use | Battle of the Tech Bands',
    description:
      'Terms of Use for Battle of the Tech Bands website. Please read these terms carefully before using our services.',
    type: 'website',
  },
}

export default function TermsOfUsePage() {
  return (
    <PublicLayout headerVariant="solid" footerVariant="simple">
      <main className="max-w-4xl mx-auto px-6 lg:px-8 py-16 sm:py-24">
        {/* Header */}
        <div className="mb-12">
          <p className="text-xs tracking-[0.3em] uppercase text-text-muted mb-4">
            Legal
          </p>
          <h1 className="font-bold text-3xl sm:text-4xl md:text-5xl mb-4">
            Terms of Use
          </h1>
          <p className="text-text-muted">Last updated: December 2024</p>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-lg max-w-none">
          <div className="space-y-12">
            {/* Acceptance of Terms */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                1. Acceptance of Terms
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  Welcome to Battle of the Tech Bands (&quot;BOTTB&quot;). By
                  accessing or using our website at bottb.com (the
                  &quot;Website&quot;) and related services, you agree to be
                  bound by these Terms of Use (&quot;Terms&quot;). If you do not
                  agree to these Terms, please do not use our Website.
                </p>
                <p>
                  Battle of the Tech Bands is a community-run charity event
                  supporting{' '}
                  <a
                    href="https://www.youngcare.com.au"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-light transition-colors"
                  >
                    Youngcare
                  </a>
                  . We are based in Brisbane, Australia.
                </p>
              </div>
            </section>

            {/* Use of Website */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                2. Use of Website
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <h3 className="font-medium text-lg text-text mb-2">
                  2.1 Permitted Use
                </h3>
                <p>You may use our Website to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    View information about Battle of the Tech Bands events
                  </li>
                  <li>Browse event photos and results</li>
                  <li>Participate in voting during live events</li>
                  <li>Register interest in participating as a band</li>
                  <li>
                    Access links to purchase tickets through third-party
                    platforms
                  </li>
                </ul>

                <h3 className="font-medium text-lg text-text mb-2 mt-6">
                  2.2 Prohibited Conduct
                </h3>
                <p>You agree not to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Use the Website for any unlawful purpose</li>
                  <li>Attempt to manipulate or circumvent the voting system</li>
                  <li>
                    Submit fraudulent votes or use bots, scripts, or automated
                    means to vote
                  </li>
                  <li>Interfere with or disrupt the Website or servers</li>
                  <li>Impersonate any person or entity</li>
                  <li>
                    Collect or harvest personal information of other users
                  </li>
                  <li>Upload or transmit malicious code or content</li>
                  <li>
                    Reproduce, duplicate, copy, or exploit any part of the
                    Website for commercial purposes without express permission
                  </li>
                </ul>
              </div>
            </section>

            {/* Voting */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                3. Voting
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  Voting is a core feature of Battle of the Tech Bands events.
                  By participating in voting, you agree to the following:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>One vote per person per voting category is permitted</li>
                  <li>
                    We use device fingerprinting and other technologies to
                    detect and prevent fraudulent voting
                  </li>
                  <li>
                    Votes submitted through automated means, VPNs, or other
                    circumvention methods may be invalidated
                  </li>
                  <li>All voting decisions by event organisers are final</li>
                  <li>
                    We reserve the right to disqualify votes that appear to be
                    fraudulent
                  </li>
                </ul>
              </div>
            </section>

            {/* Intellectual Property */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                4. Intellectual Property
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <h3 className="font-medium text-lg text-text mb-2">
                  4.1 Our Content
                </h3>
                <p>
                  The Website and its original content (excluding user-submitted
                  content), features, and functionality are owned by Battle of
                  the Tech Bands organisers and are protected by copyright,
                  trademark, and other intellectual property laws.
                </p>
                <p className="mt-4">
                  The Battle of the Tech Bands name, logo, and branding are our
                  property. You may not use them without our express written
                  permission.
                </p>

                <h3 className="font-medium text-lg text-text mb-2 mt-6">
                  4.2 Event Photography
                </h3>
                <p>
                  Photographs taken at our events may feature performers and
                  attendees. By attending or performing at a Battle of the Tech
                  Bands event, you grant us a non-exclusive, royalty-free
                  licence to use photographs and recordings of you for
                  promotional purposes, including on our Website and social
                  media.
                </p>

                <h3 className="font-medium text-lg text-text mb-2 mt-6">
                  4.3 Band Performances
                </h3>
                <p>
                  Bands performing at our events are responsible for ensuring
                  they have the necessary rights or licences to perform their
                  chosen songs. Battle of the Tech Bands does not assume
                  responsibility for copyright clearance of performed music.
                </p>
              </div>
            </section>

            {/* Third-Party Links and Services */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                5. Third-Party Links and Services
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  Our Website may contain links to third-party websites or
                  services, including:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Ticketing platforms for event tickets</li>
                  <li>Social media platforms</li>
                  <li>Youngcare and other charitable organisations</li>
                  <li>Sponsor websites</li>
                </ul>
                <p className="mt-4">
                  We are not responsible for the content, privacy policies, or
                  practices of third-party sites. Your use of third-party
                  services is at your own risk and subject to their terms and
                  conditions.
                </p>
              </div>
            </section>

            {/* Disclaimer of Warranties */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                6. Disclaimer of Warranties
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  The Website is provided on an &quot;as is&quot; and &quot;as
                  available&quot; basis. To the maximum extent permitted by
                  Australian law, we disclaim all warranties, express or
                  implied, including but not limited to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    Warranties of merchantability and fitness for a particular
                    purpose
                  </li>
                  <li>
                    Warranties that the Website will be uninterrupted,
                    error-free, or secure
                  </li>
                  <li>
                    Warranties regarding the accuracy or reliability of
                    information on the Website
                  </li>
                </ul>
                <p className="mt-4">
                  This disclaimer does not exclude any consumer guarantees under
                  the Australian Consumer Law that cannot be excluded.
                </p>
              </div>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                7. Limitation of Liability
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  To the maximum extent permitted by law, Battle of the Tech
                  Bands, its organisers, volunteers, sponsors, and partners will
                  not be liable for any:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    Indirect, incidental, special, consequential, or punitive
                    damages
                  </li>
                  <li>
                    Loss of profits, data, use, goodwill, or other intangible
                    losses
                  </li>
                  <li>
                    Damages resulting from your use of or inability to use the
                    Website
                  </li>
                  <li>
                    Damages resulting from unauthorised access to or alteration
                    of your data
                  </li>
                </ul>
                <p className="mt-4">
                  This limitation applies regardless of the theory of liability
                  (contract, tort, or otherwise) and even if we have been
                  advised of the possibility of such damages.
                </p>
                <p className="mt-4">
                  Nothing in these Terms limits or excludes our liability for
                  death or personal injury caused by our negligence, fraud, or
                  any other liability that cannot be excluded under Australian
                  law.
                </p>
              </div>
            </section>

            {/* Event Attendance */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                8. Event Attendance
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>If you attend a Battle of the Tech Bands event:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    You must comply with all venue rules and directions from
                    event staff
                  </li>
                  <li>
                    You attend at your own risk and are responsible for your own
                    safety
                  </li>
                  <li>
                    You acknowledge that events involve loud music and crowds
                  </li>
                  <li>Photography and filming may take place at events</li>
                  <li>
                    Refunds for tickets are subject to the ticketing
                    platform&apos;s policies
                  </li>
                </ul>
              </div>
            </section>

            {/* Band Participation */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                9. Band Participation
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  Bands wishing to participate in Battle of the Tech Bands
                  events must:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    Submit a registration of interest through our official
                    channels
                  </li>
                  <li>
                    Have at least one member working in the technology sector
                  </li>
                  <li>
                    Agree to any additional participation terms provided upon
                    registration
                  </li>
                  <li>
                    Ensure appropriate copyright licences for performed material
                  </li>
                  <li>Conduct themselves professionally and respectfully</li>
                </ul>
                <p className="mt-4">
                  Band selection is at the sole discretion of the event
                  organisers. We reserve the right to decline or withdraw
                  participation for any reason.
                </p>
              </div>
            </section>

            {/* Charitable Purpose */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                10. Charitable Purpose
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  Battle of the Tech Bands is a community charity event
                  supporting Youngcare. By participating in our events or using
                  our Website, you acknowledge that:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    Proceeds from ticket sales (excluding venue costs and
                    production expenses) are donated to Youngcare
                  </li>
                  <li>
                    We are a volunteer-run initiative, not a registered charity
                    ourselves
                  </li>
                  <li>
                    Sponsorship contributions support event production and
                    charitable donations
                  </li>
                  <li>
                    We do not guarantee any specific amount will be raised or
                    donated from any event
                  </li>
                </ul>
              </div>
            </section>

            {/* Modifications to Terms */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                11. Modifications to Terms
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  We reserve the right to modify these Terms at any time.
                  Changes will be effective when posted on this page with an
                  updated revision date. Your continued use of the Website after
                  changes are posted constitutes acceptance of the modified
                  Terms.
                </p>
              </div>
            </section>

            {/* Termination */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                12. Termination
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  We may terminate or suspend your access to the Website
                  immediately, without prior notice, for any reason, including
                  breach of these Terms. Upon termination, your right to use the
                  Website ceases immediately.
                </p>
              </div>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                13. Governing Law
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  These Terms are governed by and construed in accordance with
                  the laws of Queensland, Australia. You agree to submit to the
                  non-exclusive jurisdiction of the courts of Queensland,
                  Australia, for the resolution of any disputes.
                </p>
                <p className="mt-4">
                  If you are accessing the Website from outside Australia, you
                  are responsible for compliance with local laws to the extent
                  they apply.
                </p>
              </div>
            </section>

            {/* Severability */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                14. Severability
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  If any provision of these Terms is found to be unenforceable
                  or invalid, that provision will be limited or eliminated to
                  the minimum extent necessary, and the remaining provisions
                  will remain in full force and effect.
                </p>
              </div>
            </section>

            {/* Contact Us */}
            <section>
              <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
                15. Contact Us
              </h2>
              <div className="text-text-muted space-y-4 leading-relaxed">
                <p>
                  If you have any questions about these Terms, please contact
                  us:
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
                  <p className="mt-2 text-sm">
                    Brisbane, Queensland, Australia
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Related Links */}
        <div className="mt-16 pt-8 border-t border-white/5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/"
              className="text-text-muted hover:text-white transition-colors inline-flex items-center gap-2"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Back to Home
            </Link>
            <Link
              href="/privacy"
              className="text-text-muted hover:text-white transition-colors text-sm"
            >
              Privacy Policy →
            </Link>
          </div>
        </div>
      </main>
    </PublicLayout>
  )
}
