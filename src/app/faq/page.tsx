import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicLayout } from '@/components/layouts'
import { FAQJsonLd } from '@/components/seo'
import { getBaseUrl } from '@/lib/seo'
import { ChevronDownIcon } from '@/components/icons'

export const metadata: Metadata = {
  title: 'FAQ | Battle of the Tech Bands',
  description:
    'Frequently asked questions about Battle of the Tech Bands - how to register a band, how voting works, and more.',
  alternates: {
    canonical: `${getBaseUrl()}/faq`,
  },
  openGraph: {
    title: 'FAQ | Battle of the Tech Bands',
    description:
      'Frequently asked questions about Battle of the Tech Bands - how to register a band, how voting works, and more.',
    type: 'website',
  },
}

// FAQ content - structured for both display and JSON-LD schema
const faqItems = [
  {
    category: 'About the Event',
    questions: [
      {
        question: 'What is Battle of the Tech Bands?',
        answer:
          'Battle of the Tech Bands (BOTTB) is a community-run charity event where bands made up of technology professionals compete in a live music battle. All proceeds support Youngcare, an Australian charity helping young people with high care needs.',
      },
      {
        question: 'When and where are the events held?',
        answer:
          'We host events in Brisbane and Sydney throughout the year. Brisbane events are held at The Triffid in Newstead, and Sydney events at The Factory Theatre. Check our homepage for upcoming event dates.',
      },
      {
        question: 'How much does it cost to attend?',
        answer:
          'Ticket prices vary by event but typically range from $25-40. All ticket sales go directly to supporting Youngcare. Tickets are available through our event pages closer to each event date.',
      },
    ],
  },
  {
    category: 'For Bands',
    questions: [
      {
        question: 'How do I register a band?',
        answer:
          'To register a band, email us at info@bottb.com with your band name, company affiliation, and a brief description. Bands must have at least one member who works in the technology industry. We typically open registrations 3-4 months before each event.',
      },
      {
        question: 'What are the requirements to compete?',
        answer:
          "Bands must have at least one member working in the tech industry. There's no minimum or maximum band size. You'll need to prepare a 15-20 minute set of cover songs. Original music is allowed but cover songs tend to engage the crowd better.",
      },
      {
        question: 'Do we need our own equipment?',
        answer:
          "Basic backline (drums, bass amp, guitar amps) is provided. You'll need to bring your own guitars, bass, cymbals, snare, pedals, and any specialty instruments. A full equipment list is sent to registered bands before the event.",
      },
      {
        question: 'How are bands scored?',
        answer:
          'Bands are judged on three criteria by a panel of judges: Song Choice (20 points), Performance (30 points), and Crowd Vibe (30 points). The audience also votes for their favorite band, contributing 20 points. The band with the highest combined score wins.',
      },
    ],
  },
  {
    category: 'Voting & Scoring',
    questions: [
      {
        question: 'How does crowd voting work?',
        answer:
          'During the event, scan the QR code displayed at the venue or visit our website to cast your vote. You can vote for your favorite band once per event. Voting opens when the event starts and closes shortly after the last band performs.',
      },
      {
        question: 'Can I change my vote?',
        answer:
          'Yes! You can change your vote at any time while voting is open. Simply visit the voting page again and select a different band. Only your final vote will be counted.',
      },
      {
        question: 'When are results announced?',
        answer:
          'Results are announced live at the venue immediately after voting closes. Full results including score breakdowns are published on our website within 24 hours of the event.',
      },
    ],
  },
  {
    category: 'Charity & Support',
    questions: [
      {
        question: 'What is Youngcare?',
        answer:
          'Youngcare is an Australian charity fighting to ensure young people with high care needs get the choice, control, and independence they deserve. They provide housing, support services, and advocacy for young Australians who might otherwise be left in aged care facilities.',
      },
      {
        question: 'How much has BOTTB raised for charity?',
        answer:
          'Since our first event in 2022, Battle of the Tech Bands has raised over $50,000 for Youngcare through ticket sales, donations, and sponsorships. Every dollar from ticket sales goes directly to the charity.',
      },
      {
        question: 'How can my company sponsor BOTTB?',
        answer:
          'We welcome corporate sponsors! Sponsorship packages include logo placement, VIP tickets, and recognition at the event. Contact us at info@bottb.com to discuss sponsorship opportunities.',
      },
    ],
  },
]

// Flatten questions for JSON-LD schema
const allQuestions = faqItems.flatMap((category) => category.questions)

export default function FAQPage() {
  return (
    <PublicLayout
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'FAQ' }]}
      footerVariant="simple"
    >
      <FAQJsonLd items={allQuestions} />

      <main className="max-w-4xl mx-auto px-6 py-12 lg:py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="font-semibold text-4xl sm:text-5xl mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-text-muted text-lg max-w-2xl mx-auto">
            Everything you need to know about Battle of the Tech Bands.
            Can&apos;t find what you&apos;re looking for?{' '}
            <a
              href="mailto:info@bottb.com"
              className="text-accent hover:text-accent-light"
            >
              Contact us
            </a>
            .
          </p>
        </div>

        {/* FAQ Categories */}
        <div className="space-y-12">
          {faqItems.map((category) => (
            <section key={category.category}>
              <h2 className="text-sm tracking-widest uppercase text-accent mb-6">
                {category.category}
              </h2>
              <div className="space-y-4">
                {category.questions.map((item, index) => (
                  <details
                    key={index}
                    className="group bg-bg-elevated rounded-xl border border-white/5 overflow-hidden"
                  >
                    <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none hover:bg-white/2 transition-colors">
                      <h3 className="font-medium text-lg pr-4">
                        {item.question}
                      </h3>
                      <ChevronDownIcon
                        className="w-5 h-5 text-text-muted shrink-0 transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <div className="px-5 pb-5 pt-0">
                      <p className="text-text-muted leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center bg-bg-surface rounded-2xl p-8 border border-white/5">
          <h2 className="font-semibold text-2xl mb-3">Still have questions?</h2>
          <p className="text-text-muted mb-6">
            We&apos;re here to help. Reach out and we&apos;ll get back to you as
            soon as possible.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="mailto:info@bottb.com"
              className="inline-flex items-center justify-center bg-white text-bg px-6 py-3 rounded-full text-sm tracking-widest uppercase font-medium hover:bg-gray-200 transition-colors"
            >
              Email Us
            </a>
            <Link
              href="/about"
              className="inline-flex items-center justify-center border border-white/30 px-6 py-3 rounded-full text-sm tracking-widest uppercase hover:border-white/60 hover:bg-white/5 transition-all"
            >
              Learn More
            </Link>
          </div>
        </div>
      </main>
    </PublicLayout>
  )
}
