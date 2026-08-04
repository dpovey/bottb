import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicLayout } from '@/components/layouts'
import { Button } from '@/components/ui'
import { getNavEvents } from '@/lib/nav-data'
import { getBaseUrl, DEFAULT_OG_IMAGE } from '@/lib/seo'
import {
  getCategories,
  getCategoryById,
  getDefaultScoringVersion,
  getMaxJudgePoints,
  getScoringConfig,
  getScoringFormula,
  type ScoringVersion,
} from '@/lib/scoring'

const TITLE = 'How Scoring Works | Battle of the Tech Bands'
const DESCRIPTION =
  'The full Battle of the Tech Bands scoring system explained for bands — what each category rewards, how judge scores are averaged, and how the crowd vote is converted to points.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: `${getBaseUrl()}/about/scoring`,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'article',
    images: [DEFAULT_OG_IMAGE],
  },
}

// The scoring system in use for upcoming events. Points, labels and category
// order all come from `@/lib/scoring`, so this page follows the engine rather
// than duplicating it — only the long-form guidance below is written by hand.
const CURRENT_VERSION = getDefaultScoringVersion()

interface CategoryGuide {
  /** What the category is actually measuring, in plain language */
  summary: string
  /** Concrete things that earn points */
  lookFor: string[]
  /** The single most useful piece of advice for this category */
  tip: string
}

const CATEGORY_GUIDES: Record<string, CategoryGuide> = {
  song_choice: {
    summary:
      'Whether your setlist was the right setlist — for this room, this crowd, and this band.',
    lookFor: [
      'Songs the room recognises and can latch onto within the first few bars',
      'A set with an arc: a strong opener, light and shade in the middle, a closer that leaves the room lifted',
      'Material that suits your singer’s range and the band’s current playing level',
      'Variety in tempo, key and feel across the set rather than four songs that blur together',
      'Arrangements trimmed to keep the set moving — long intros and jams cost you momentum',
    ],
    tip: 'A well-chosen crowd-pleaser played comfortably beats an ambitious deep cut played nervously. Pick songs you can nail on a loud stage with limited monitoring.',
  },
  performance: {
    summary:
      'How well you played and how you carried it on stage — musicianship plus presence.',
    lookFor: [
      'Tightness: timing, tuning, vocal pitch, and clean starts and endings',
      'Dynamics — not everything at full volume for the whole set',
      'Confidence and stage presence: eye contact, movement, using the space you’re given',
      'A band that visibly enjoys itself and plays as one unit rather than four solo acts',
      'Composure when something goes wrong; recovering smoothly scores better than stopping',
    ],
    tip: 'This is not a musicianship contest won by the best player. A tight, committed band that commands the stage consistently outscores a more technical band staring at its shoes.',
  },
  crowd_vibe: {
    summary:
      'The response your set actually produces in the room — energy you transfer, not energy you have.',
    lookFor: [
      'People moving forward, dancing, singing along or filming',
      'Direct engagement: talking to the room, counting them in, handing over a chorus',
      'How the room feels when you finish compared to when you started',
      'Whether you win over people who came to watch a different band',
      'Momentum held between songs — long gaps while you retune let the room drift',
    ],
    tip: 'Bringing a big cheer squad helps, but this category is scored on the whole room. Judges are watching the people who did not arrive as your fans.',
  },
  visuals: {
    summary:
      'The visual show you put on: costume, staging, and everything the crowd sees before you play a note.',
    lookFor: [
      'A visible idea — a theme, a look, coordinated costumes, or a strong band identity',
      'Backdrops, banners, props, or artwork on the screens',
      'Whole-band commitment: consistency across every member beats one great outfit',
      'Choices that read from the back of a dark room, not just up close',
      'Presentation that suits the music rather than fighting it',
    ],
    tip: 'Budget is not what is being scored — intent is. A committed op-shop theme done by the whole band scores well above expensive gear with no idea behind it.',
  },
  crowd_vote: {
    summary:
      'The audience’s own verdict, cast on their phones during the event.',
    lookFor: [
      'One vote per person, cast by scanning the QR codes displayed around the venue',
      'Voters can change their mind at any time while voting is open — only the final vote counts',
      'Voting closes shortly after the last band finishes',
      'Duplicate voting is filtered out, so ballot-stuffing does not help you',
    ],
    tip: 'Remind the room to vote while you are on stage, and again after your set. The single biggest cause of lost crowd-vote points is supporters who enjoyed you but never opened the voting page.',
  },
}

/** Past formats, so bands reading historical results know what they are seeing. */
const FORMAT_HISTORY: {
  version: ScoringVersion
  events: string
  note: string
}[] = [
  {
    version: '2022.1',
    events: 'Brisbane 2022 – 2025',
    note: 'Early events recorded the winning band only, with no published score breakdown.',
  },
  {
    version: '2025.1',
    events: 'Sydney 2025',
    note: 'First full breakdown. Included the Scream-o-Meter, a live measurement of crowd noise.',
  },
  {
    version: '2026.1',
    events: 'Melbourne 2026',
    note: 'The Scream-o-Meter was replaced by Visuals, judging costume and staging.',
  },
  {
    version: '2026.2',
    events: 'Brisbane 2026, Sydney 2026',
    note: 'Even weighting — all five categories are worth the same, so no single category can decide the night on its own.',
  },
]

export default async function ScoringPage() {
  const navEvents = await getNavEvents()

  const config = getScoringConfig(CURRENT_VERSION)
  const categories = getCategories(CURRENT_VERSION)
  const judgeCategories = categories.filter((c) => c.type === 'judge')
  const maxJudgePoints = getMaxJudgePoints(CURRENT_VERSION)
  const crowdVoteMax =
    getCategoryById(CURRENT_VERSION, 'crowd_vote')?.maxPoints ?? 0

  return (
    <PublicLayout
      headerVariant="solid"
      footerVariant="full"
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' },
        { label: 'Scoring' },
      ]}
      navEvents={navEvents}
    >
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-16 sm:py-24">
        {/* Header */}
        <header className="mb-12">
          <p className="text-xs tracking-[0.3em] uppercase text-text-muted mb-4">
            For Bands
          </p>
          <h1 className="font-bold text-3xl sm:text-4xl md:text-5xl mb-6">
            How Scoring Works
          </h1>
          <p className="text-text-muted text-lg leading-relaxed">
            Every Battle of the Tech Bands set is scored out of{' '}
            <strong className="text-white">{config.totalPoints} points</strong>{' '}
            across {categories.length} categories — {judgeCategories.length}{' '}
            scored by a panel of judges, one decided by the crowd. Nothing here
            is secret: this is the same rubric printed on the judges&apos; score
            sheets on the night.
          </p>
        </header>

        {/* Points at a glance */}
        <section className="mb-16">
          <h2 className="font-semibold text-xl sm:text-2xl mb-6 text-white">
            The {config.totalPoints} points at a glance
          </h2>
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <ul className="space-y-4">
              {categories.map((category) => (
                <li key={category.id}>
                  <div className="flex items-baseline justify-between gap-4 mb-2">
                    <span className="text-white font-medium">
                      <span aria-hidden="true" className="mr-2">
                        {category.emoji}
                      </span>
                      {category.label}
                    </span>
                    <span className="text-sm text-text-dim">
                      {category.type === 'crowd' ? 'Crowd' : 'Judges'}
                      <span className="text-accent font-medium ml-3">
                        {category.maxPoints} pts
                      </span>
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full bg-white/5 overflow-hidden"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full bg-accent/70"
                      style={{
                        width: `${(category.maxPoints / config.totalPoints) * 100}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-6 border-t border-white/5 grid sm:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-white">
                  {maxJudgePoints}
                </p>
                <p className="text-xs text-text-dim">Judge points</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{crowdVoteMax}</p>
                <p className="text-xs text-text-dim">Crowd vote points</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-accent">
                  {config.totalPoints}
                </p>
                <p className="text-xs text-text-dim">Total</p>
              </div>
            </div>
          </div>
        </section>

        {/* Category detail */}
        <section className="mb-16">
          <h2 className="font-semibold text-xl sm:text-2xl mb-2 text-white">
            The categories in detail
          </h2>
          <p className="text-text-muted mb-6">
            Judges score each band on every category independently, as you play.
          </p>
          <div className="space-y-6">
            {categories.map((category) => {
              const guide = CATEGORY_GUIDES[category.id]
              return (
                <article
                  key={category.id}
                  className="bg-bg-elevated rounded-xl p-6 md:p-8 border border-white/5"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <span aria-hidden="true" className="text-3xl shrink-0">
                      {category.emoji}
                    </span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="font-semibold text-lg text-white">
                          {category.label}
                        </h3>
                        <span className="text-accent font-medium">
                          {category.maxPoints} points
                        </span>
                        <span className="text-xs uppercase tracking-wider text-text-dim">
                          {category.type === 'crowd'
                            ? 'Scored by the audience'
                            : 'Scored by judges'}
                        </span>
                      </div>
                      {guide && (
                        <p className="text-text-muted mt-2 leading-relaxed">
                          {guide.summary}
                        </p>
                      )}
                    </div>
                  </div>

                  {guide && (
                    <>
                      <h4 className="text-xs tracking-widest uppercase text-text-muted mb-3">
                        {category.type === 'crowd'
                          ? 'How the vote runs'
                          : 'What judges reward'}
                      </h4>
                      <ul className="space-y-2 mb-5">
                        {guide.lookFor.map((item) => (
                          <li
                            key={item}
                            className="flex items-start gap-3 text-text-muted"
                          >
                            <span aria-hidden="true" className="text-accent">
                              ✓
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm text-text-muted bg-bg-surface rounded-lg p-4 border border-white/5">
                        <span className="text-white font-medium">Tip: </span>
                        {guide.tip}
                      </p>
                    </>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        {/* Judge maths */}
        <section className="mb-16">
          <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
            How judge scores are combined
          </h2>
          <div className="text-text-muted space-y-4 leading-relaxed">
            <p>
              Each event runs a panel of independent judges — usually three or
              four. Every judge scores every band on every judged category,
              using whole numbers from zero up to that category&apos;s maximum.
              Judges score as you play and hand their sheets in after the final
              set.
            </p>
            <p>
              Your score in a category is the{' '}
              <strong className="text-white">average across all judges</strong>,
              not the total. Averaging means one judge scoring harder (or
              softer) than the rest cannot swing the result on their own, and
              the size of the panel never changes what a category is worth.
            </p>
          </div>
          <div className="mt-6 bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Worked example — Performance
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div>
                <p className="text-xl font-bold text-white">16</p>
                <p className="text-xs text-text-dim">Judge A</p>
              </div>
              <div>
                <p className="text-xl font-bold text-white">18</p>
                <p className="text-xs text-text-dim">Judge B</p>
              </div>
              <div>
                <p className="text-xl font-bold text-white">17</p>
                <p className="text-xs text-text-dim">Judge C</p>
              </div>
            </div>
            <p className="text-text-muted text-sm border-t border-white/5 pt-4">
              (16 + 18 + 17) ÷ 3 ={' '}
              <strong className="text-white">17.0 Performance points</strong>{' '}
              out of{' '}
              {getCategoryById(CURRENT_VERSION, 'performance')?.maxPoints ?? 20}
              . The same averaging runs for every judged category, and those
              category scores add up to your judge total out of {maxJudgePoints}
              .
            </p>
          </div>
        </section>

        {/* Crowd vote maths */}
        <section className="mb-16">
          <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
            How the crowd vote becomes points
          </h2>
          <div className="text-text-muted space-y-4 leading-relaxed">
            <p>
              The crowd vote is scored{' '}
              <strong className="text-white">relative to the leader</strong>.
              The band with the most votes takes the full {crowdVoteMax} points,
              and every other band is scored in proportion to that band:
            </p>
            <p className="bg-bg-surface rounded-lg p-4 border border-white/5 text-white text-center font-medium">
              (your votes ÷ leading band&apos;s votes) × {crowdVoteMax}
            </p>
            <p>
              Scoring against the leader rather than the total keeps the
              category worth a genuine {crowdVoteMax} points regardless of how
              many bands play or how many people vote on the night.
            </p>
          </div>
          <div className="mt-6 bg-bg-elevated rounded-xl overflow-x-auto border border-white/5">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Worked example converting crowd votes into points
              </caption>
              <thead>
                <tr className="text-left text-xs tracking-widest uppercase text-text-muted">
                  <th scope="col" className="p-4 font-normal">
                    Band
                  </th>
                  <th scope="col" className="p-4 font-normal text-right">
                    Votes
                  </th>
                  <th scope="col" className="p-4 font-normal text-right">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="text-text-muted">
                <tr className="border-t border-white/5">
                  <td className="p-4 text-white">Band A</td>
                  <td className="p-4 text-right">120</td>
                  <td className="p-4 text-right text-accent">
                    {crowdVoteMax.toFixed(1)}
                  </td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-4 text-white">Band B</td>
                  <td className="p-4 text-right">90</td>
                  <td className="p-4 text-right text-accent">
                    {((90 / 120) * crowdVoteMax).toFixed(1)}
                  </td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-4 text-white">Band C</td>
                  <td className="p-4 text-right">60</td>
                  <td className="p-4 text-right text-accent">
                    {((60 / 120) * crowdVoteMax).toFixed(1)}
                  </td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="p-4 text-white">Band D</td>
                  <td className="p-4 text-right">30</td>
                  <td className="p-4 text-right text-accent">
                    {((30 / 120) * crowdVoteMax).toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Winners, awards, ties */}
        <section className="mb-16">
          <h2 className="font-semibold text-xl sm:text-2xl mb-6 text-white">
            Winners, category awards and ties
          </h2>
          <div className="space-y-4">
            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <h3 className="font-semibold text-white mb-2">Overall winner</h3>
              <p className="text-text-muted leading-relaxed">
                The band with the highest combined total out of{' '}
                {config.totalPoints}. There is no separate final round and no
                organiser&apos;s discretion — the totals decide it.
              </p>
            </div>
            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <h3 className="font-semibold text-white mb-2">
                Category winners
              </h3>
              <p className="text-text-muted leading-relaxed">
                We also publish the best band in each individual category, so a
                band that doesn&apos;t take the trophy can still walk away with
                the night&apos;s best setlist, performance, crowd response,
                visuals, or the crowd favourite award.
              </p>
            </div>
            <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
              <h3 className="font-semibold text-white mb-2">Tie-breaks</h3>
              <p className="text-text-muted leading-relaxed mb-3">
                If two bands finish level on total points, we resolve it in this
                order:
              </p>
              <ol className="space-y-2 text-text-muted list-decimal list-inside">
                <li>The higher crowd vote wins</li>
                <li>Failing that, the higher Performance score wins</li>
                <li>If it is still level, the bands are declared co-winners</li>
              </ol>
            </div>
          </div>
        </section>

        {/* On the night */}
        <section className="mb-16">
          <h2 className="font-semibold text-xl sm:text-2xl mb-6 text-white">
            On the night
          </h2>
          <ol className="space-y-4">
            {[
              {
                title: 'Judges score live',
                body: 'Each judge fills in a score sheet during your set, with room for notes. Scores are not shared between judges.',
              },
              {
                title: 'Crowd voting opens',
                body: 'QR codes around the venue link to the voting page. Anyone in the room can vote once, and can change their vote while voting stays open.',
              },
              {
                title: 'Voting closes',
                body: 'Shortly after the last band finishes, so every band has been seen before the crowd vote is locked in.',
              },
              {
                title: 'Scores are combined',
                body: 'Judge scores are averaged per category and added to the crowd-vote points to produce each band’s total.',
              },
              {
                title: 'Results announced',
                body: 'The winner is announced live at the venue, and the full breakdown is published on this site with every band’s category scores.',
              },
            ].map((step, index) => (
              <li
                key={step.title}
                className="bg-bg-elevated rounded-xl p-6 border border-white/5 flex items-start gap-4"
              >
                <span className="shrink-0 w-9 h-9 rounded-full bg-bg-surface flex items-center justify-center text-accent font-bold">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-white mb-1">
                    {step.title}
                  </h3>
                  <p className="text-text-muted leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* What isn't scored */}
        <section className="mb-16">
          <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
            What isn&apos;t scored
          </h2>
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <ul className="space-y-3 text-text-muted">
              <li className="flex items-start gap-3">
                <span aria-hidden="true" className="text-text-dim">
                  ✕
                </span>
                <span>
                  Technical difficulty on its own. Playing something hard earns
                  nothing if it doesn&apos;t land with the room.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span aria-hidden="true" className="text-text-dim">
                  ✕
                </span>
                <span>
                  Gear and budget. Judges score what they hear and see, not what
                  it cost.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span aria-hidden="true" className="text-text-dim">
                  ✕
                </span>
                <span>
                  Company size or how many colleagues you bring — beyond the
                  votes those people actually cast.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span aria-hidden="true" className="text-text-dim">
                  ✕
                </span>
                <span>
                  Fundraising. Money raised for Youngcare is the point of the
                  night, but it carries no points.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Format history */}
        <section className="mb-16">
          <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
            How the format has changed
          </h2>
          <p className="text-text-muted mb-6 leading-relaxed">
            Results pages show the scoring version each event used, so older
            results may look different to the current rubric.
          </p>
          <div className="space-y-4">
            {FORMAT_HISTORY.map((entry) => {
              const isCurrent = entry.version === CURRENT_VERSION
              return (
                <div
                  key={entry.version}
                  className={`rounded-xl p-6 border ${
                    isCurrent
                      ? 'bg-bg-elevated border-accent/20'
                      : 'bg-bg-elevated border-white/5'
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                    <h3 className="font-semibold text-white">{entry.events}</h3>
                    <span className="text-xs text-text-dim">
                      v{entry.version}
                    </span>
                    {isCurrent && (
                      <span className="text-xs uppercase tracking-wider text-accent">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-text-muted leading-relaxed">
                    {entry.note}
                  </p>
                  {entry.version !== '2022.1' && (
                    <p className="text-sm text-text-dim mt-2">
                      {getScoringFormula(entry.version)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="font-semibold text-xl sm:text-2xl mb-4 text-white">
            Still have questions?
          </h2>
          <p className="text-text-muted mb-8 max-w-xl mx-auto">
            Have a look at past results to see how the scoring plays out, or ask
            us anything about the rubric before you plan your set.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/events">
              <Button variant="filled" size="lg">
                Past Results
              </Button>
            </Link>
            <Link href="/faq">
              <Button variant="outline-solid" size="lg">
                Read the FAQ
              </Button>
            </Link>
            <a href="mailto:info@bottb.com">
              <Button variant="outline-solid" size="lg">
                Email Us
              </Button>
            </a>
          </div>
        </section>
      </div>
    </PublicLayout>
  )
}
