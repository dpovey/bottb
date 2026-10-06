import { describe, it, expect } from 'vitest'
import {
  IDENTICAL_PHONES_ALLOWED,
  SHARED_NETWORK_DEVICE_KINDS,
  buildReviewQueue,
  countCrowdVotes,
  describeDevice,
  findSharedNetworks,
  reviewVote,
  type ReviewVote,
} from '../vote-review'

const HOME = '198.51.100.20'
const WIFI = '203.0.113.200'
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'

let seq = 0

/** A crowd vote cast `secondsIn` seconds after 8pm. */
function vote(
  secondsIn: number,
  overrides: Partial<ReviewVote> = {}
): ReviewVote {
  seq++
  return {
    id: `vote-${String(seq).padStart(3, '0')}`,
    band_id: 'band-1',
    status: 'approved',
    created_at: new Date(
      Date.UTC(2026, 9, 8, 9, 0, 0) + secondsIn * 1000
    ).toISOString(),
    ip_address: `10.0.0.${seq}`,
    user_agent: IPHONE_UA,
    browser_name: 'Safari',
    os_name: 'iOS',
    os_version: '18.6',
    device_type: 'Mobile',
    screen_resolution: '390x844',
    fingerprintjs_visitor_id: `device-${seq}`,
    email: null,
    reviewed_at: null,
    reviewed_by: null,
    ...overrides,
  }
}

describe('vote-review', () => {
  describe('reviewVote', () => {
    describe('email', () => {
      it('suggests rejecting a vote with the same email as an earlier vote', () => {
        const earlier = vote(0, { email: 'sam@example.com' })
        const held = vote(90, { email: 'sam@example.com', status: 'pending' })
        const item = reviewVote(held, [earlier, held])
        expect(item.suggestion).toBe('reject')
        expect(item.reason).toBe('Same email address as an earlier vote.')
        expect(item.matches).toHaveLength(1)
        expect(item.matches[0]).toMatchObject({
          voteId: earlier.id,
          matchedBy: ['email'],
          sameIp: false,
          secondsEarlier: 90,
        })
      })

      it('matches email regardless of case and surrounding whitespace', () => {
        const earlier = vote(0, { email: '  Sam.Smith@Example.COM ' })
        const held = vote(10, {
          email: 'sam.smith@example.com',
          status: 'pending',
        })
        expect(reviewVote(held, [earlier, held]).suggestion).toBe('reject')
      })

      it('rejects on email even on a busy shared network', () => {
        const others = [
          vote(0, { ip_address: WIFI, user_agent: 'UA-1' }),
          vote(1, { ip_address: WIFI, user_agent: 'UA-2' }),
          vote(2, { ip_address: WIFI, user_agent: 'UA-3' }),
        ]
        const earlier = vote(3, { ip_address: WIFI, email: 'a@b.c' })
        const held = vote(4, {
          ip_address: WIFI,
          email: 'A@B.C',
          status: 'pending',
        })
        const all = [...others, earlier, held]
        expect(findSharedNetworks(all).has(WIFI)).toBe(true)
        expect(reviewVote(held, all).suggestion).toBe('reject')
      })

      it('does not treat two blank emails as a match', () => {
        const earlier = vote(0, { email: '   ' })
        const held = vote(10, { email: '', status: 'pending' })
        const item = reviewVote(held, [earlier, held])
        expect(item.matches).toEqual([])
        expect(item.suggestion).toBe('approve')
      })
    })

    it('suggests approving when nothing earlier matches', () => {
      const other = vote(0)
      const held = vote(10, { status: 'pending' })
      const item = reviewVote(held, [other, held])
      expect(item.matches).toEqual([])
      expect(item.suggestion).toBe('approve')
      expect(item.reason).toBe(
        'The earlier vote it matched is no longer there.'
      )
    })

    describe('identical phone on a different network', () => {
      it('suggests approving one lookalike', () => {
        const earlier = vote(0, {
          fingerprintjs_visitor_id: 'iphone-x',
          ip_address: '203.0.113.7',
        })
        const held = vote(30, {
          fingerprintjs_visitor_id: 'iphone-x',
          ip_address: '198.51.100.4',
          status: 'pending',
        })
        const item = reviewVote(held, [earlier, held])
        expect(item.suggestion).toBe('approve')
        expect(item.reason).toBe(
          'Same model of phone as 1 earlier vote, on a different network. Usually a different person.'
        )
        expect(item.matches[0]).toMatchObject({
          matchedBy: ['device'],
          sameIp: false,
        })
      })

      it('suggests approving however many lookalikes there are', () => {
        const earlier = [0, 1, 2, 3].map((t) =>
          vote(t, { fingerprintjs_visitor_id: 'iphone-x' })
        )
        const held = vote(10, {
          fingerprintjs_visitor_id: 'iphone-x',
          status: 'pending',
        })
        const item = reviewVote(held, [...earlier, held])
        expect(item.suggestion).toBe('approve')
        expect(item.reason).toBe(
          'Same model of phone as 4 earlier votes, on different networks. Usually different people.'
        )
      })
    })

    describe('identical phone on the same, unshared connection', () => {
      /** `n` earlier votes from the same phone on HOME, then the held one. */
      function samePhone(n: number) {
        const earlier = Array.from({ length: n }, (_, i) =>
          vote(i, { fingerprintjs_visitor_id: 'iphone-x', ip_address: HOME })
        )
        const held = vote(100, {
          fingerprintjs_visitor_id: 'iphone-x',
          ip_address: HOME,
          status: 'pending',
        })
        return { all: [...earlier, held], held }
      }

      it('approves the second vote (1 earlier same-connection match)', () => {
        const { all, held } = samePhone(1)
        const item = reviewVote(held, all)
        expect(item.suggestion).toBe('approve')
        expect(item.reason).toBe(
          'A second identical phone on the same connection. Could well be two people.'
        )
        expect(item.matches[0]).toMatchObject({
          matchedBy: ['device', 'connection'],
          sameIp: true,
        })
      })

      it('rejects the third vote (2 earlier same-connection matches)', () => {
        const { all, held } = samePhone(2)
        const item = reviewVote(held, all)
        expect(item.suggestion).toBe('reject')
        expect(item.reason).toBe(
          'Vote number 3 from identical phones on one connection. Looks like the same phone voting again.'
        )
      })

      it('counts the vote number up from there', () => {
        const { all, held } = samePhone(4)
        expect(reviewVote(held, all).reason).toMatch(/^Vote number 5 /)
      })

      it('counts identical browsers on the same IP even when the fingerprint differs', () => {
        // Private browsing gives a new visitor id but the same browser string.
        const earlier = [0, 1].map((t) =>
          vote(t, { ip_address: HOME, user_agent: IPHONE_UA })
        )
        const held = vote(10, {
          ip_address: HOME,
          user_agent: IPHONE_UA,
          status: 'pending',
        })
        const all = [...earlier, held]
        const item = reviewVote(held, all)
        expect(item.matches.map((m) => m.matchedBy)).toEqual([
          ['connection'],
          ['connection'],
        ])
        expect(item.suggestion).toBe('reject')
      })

      it('one phone with a fresh visitor id per vote does not make its own IP "shared"', () => {
        const votes = ['tab-1', 'tab-2', 'tab-3'].map((visitor, i) =>
          vote(i, {
            ip_address: HOME,
            user_agent: IPHONE_UA,
            screen_resolution: '390x844',
            fingerprintjs_visitor_id: visitor,
            status: i === 2 ? 'pending' : 'approved',
          })
        )
        expect(findSharedNetworks(votes).size).toBe(0)
        const item = reviewVote(votes[2], votes)
        expect(item.suggestion).toBe('reject')
        expect(item.reason).toMatch(/^Vote number 3 /)
      })

      it('does not call a different browser on the same IP a connection match', () => {
        const earlier = vote(0, {
          ip_address: HOME,
          user_agent: 'Android Chrome',
        })
        const held = vote(10, {
          ip_address: HOME,
          user_agent: IPHONE_UA,
          status: 'pending',
        })
        expect(reviewVote(held, [earlier, held]).matches).toEqual([])
      })

      it('needs a browser string for a connection match', () => {
        const earlier = vote(0, { ip_address: HOME, user_agent: null })
        const held = vote(10, {
          ip_address: HOME,
          user_agent: null,
          status: 'pending',
        })
        expect(reviewVote(held, [earlier, held]).matches).toEqual([])
      })

      it('does not call a missing IP address on both votes "the same connection"', () => {
        const earlier = [0, 1].map((t) =>
          vote(t, { fingerprintjs_visitor_id: 'p', ip_address: null })
        )
        const held = vote(10, {
          fingerprintjs_visitor_id: 'p',
          ip_address: null,
          status: 'pending',
        })
        const item = reviewVote(held, [...earlier, held])
        expect(item.matches.every((m) => !m.sameIp)).toBe(true)
        expect(item.suggestion).toBe('approve')
      })

      it('only counts same-IP matches towards the tally', () => {
        // Two lookalikes elsewhere and one on the same connection: still the
        // "second identical phone" on this connection.
        const elsewhere = [0, 1].map((t) =>
          vote(t, { fingerprintjs_visitor_id: 'p' })
        )
        const same = vote(2, {
          fingerprintjs_visitor_id: 'p',
          ip_address: HOME,
        })
        const held = vote(10, {
          fingerprintjs_visitor_id: 'p',
          ip_address: HOME,
          status: 'pending',
        })
        const item = reviewVote(held, [...elsewhere, same, held])
        expect(item.matches).toHaveLength(3)
        expect(item.suggestion).toBe('approve')
        expect(item.reason).toMatch(/^A second identical phone/)
      })
    })

    describe('shared networks (venue Wi-Fi, carrier gateways)', () => {
      /**
       * The same phone voted twice before on WIFI (so a third vote would be
       * rejected on an unshared connection), plus `otherKinds` different
       * devices on WIFI.
       */
      function onWifi(otherKinds: number) {
        const others = Array.from({ length: otherKinds }, (_, i) =>
          vote(i, { ip_address: WIFI, user_agent: `Other-${i}` })
        )
        const earlier = [10, 11].map((t) =>
          vote(t, { fingerprintjs_visitor_id: 'iphone-x', ip_address: WIFI })
        )
        const held = vote(20, {
          fingerprintjs_visitor_id: 'iphone-x',
          ip_address: WIFI,
          status: 'pending',
        })
        return { all: [...others, ...earlier, held], held }
      }

      it('approves identical phones once 3 kinds of device share the IP', () => {
        // iphone-x plus two other kinds = 3.
        const { all, held } = onWifi(2)
        expect(findSharedNetworks(all)).toEqual(new Set([WIFI]))
        const item = reviewVote(held, all)
        expect(item.suggestion).toBe('approve')
        expect(item.reason).toBe(
          'Identical phone on a busy shared network (venue Wi-Fi or a mobile carrier). Usually a different person.'
        )
      })

      it('does not treat 2 kinds of device as a shared network', () => {
        const { all, held } = onWifi(1)
        expect(findSharedNetworks(all).size).toBe(0)
        expect(reviewVote(held, all).suggestion).toBe('reject')
      })

      it('uses the shared networks it is given', () => {
        const { all, held } = onWifi(0)
        expect(reviewVote(held, all, new Set([WIFI])).suggestion).toBe(
          'approve'
        )
        expect(reviewVote(held, all, new Set()).suggestion).toBe('reject')
      })
    })

    it('only matches against EARLIER votes, never later ones', () => {
      const held = vote(0, {
        email: 'sam@example.com',
        fingerprintjs_visitor_id: 'p',
        ip_address: HOME,
        status: 'pending',
      })
      const later = [60, 61].map((t) =>
        vote(t, {
          email: 'sam@example.com',
          fingerprintjs_visitor_id: 'p',
          ip_address: HOME,
        })
      )
      const item = reviewVote(held, [held, ...later])
      expect(item.matches).toEqual([])
      expect(item.suggestion).toBe('approve')
    })

    it('does not match a vote against itself', () => {
      const held = vote(0, { email: 'a@b.c', status: 'pending' })
      expect(reviewVote(held, [held]).matches).toEqual([])
    })

    it('breaks a same-millisecond tie by id, so only one of the pair is "earlier"', () => {
      const first = vote(0, {
        id: 'aaaa',
        email: 'same@example.com',
        status: 'pending',
      })
      const second = vote(0, {
        id: 'bbbb',
        email: 'same@example.com',
        status: 'pending',
      })
      expect(reviewVote(first, [first, second]).matches).toEqual([])
      expect(reviewVote(second, [first, second]).matches).toHaveLength(1)
    })

    it('records every reason, the band and the gap for each match, nearest first', () => {
      const far = vote(0, {
        email: 'x@y.z',
        fingerprintjs_visitor_id: 'p',
        band_id: 'band-2',
      })
      const near = vote(100, {
        fingerprintjs_visitor_id: 'p',
        ip_address: HOME,
      })
      const held = vote(130, {
        email: 'X@Y.Z',
        fingerprintjs_visitor_id: 'p',
        ip_address: HOME,
        status: 'pending',
      })
      const item = reviewVote(held, [far, near, held])
      expect(item.matches.map((m) => m.voteId)).toEqual([near.id, far.id])
      expect(item.matches[0]).toMatchObject({
        matchedBy: ['device', 'connection'],
        sameIp: true,
        sameBand: true,
        secondsEarlier: 30,
      })
      expect(item.matches[1]).toMatchObject({
        matchedBy: ['email', 'device'],
        sameBand: false,
        bandId: 'band-2',
        secondsEarlier: 130,
      })
      expect(item.suggestion).toBe('reject')
    })

    describe('an email match wins over everything else', () => {
      it('rejects even when it would otherwise be "a different network"', () => {
        const earlier = vote(0, { email: 'sam@example.com', ip_address: HOME })
        const held = vote(10, {
          email: 'sam@example.com',
          ip_address: WIFI,
          user_agent: 'Different phone',
          status: 'pending',
        })
        const item = reviewVote(held, [earlier, held])
        expect(item.matches[0].sameIp).toBe(false)
        expect(item.suggestion).toBe('reject')
        expect(item.reason).toBe('Same email address as an earlier vote.')
      })

      it('rejects even when it would otherwise be "a second identical phone"', () => {
        const earlier = vote(0, {
          email: 'sam@example.com',
          ip_address: HOME,
          fingerprintjs_visitor_id: 'p',
        })
        const held = vote(10, {
          email: 'sam@example.com',
          ip_address: HOME,
          fingerprintjs_visitor_id: 'p',
          status: 'pending',
        })
        expect(reviewVote(held, [earlier, held]).reason).toBe(
          'Same email address as an earlier vote.'
        )
      })

      it('rejects even on a shared network it is told about', () => {
        const earlier = vote(0, { email: 'a@b.c', ip_address: WIFI })
        const held = vote(10, {
          email: 'a@b.c',
          ip_address: WIFI,
          status: 'pending',
        })
        expect(
          reviewVote(held, [earlier, held], new Set([WIFI])).suggestion
        ).toBe('reject')
      })
    })
  })

  describe('findSharedNetworks', () => {
    it('needs 3 different kinds of device (browser string and screen) on one IP', () => {
      const two = [
        vote(0, { ip_address: WIFI, user_agent: 'A' }),
        vote(1, { ip_address: WIFI, user_agent: 'B' }),
      ]
      expect(findSharedNetworks(two).size).toBe(0)
      expect(
        findSharedNetworks([
          ...two,
          vote(2, { ip_address: WIFI, user_agent: 'C' }),
        ])
      ).toEqual(new Set([WIFI]))
      expect(SHARED_NETWORK_DEVICE_KINDS).toBe(3)
    })

    it('does not count the same device voting several times', () => {
      const same = [0, 1, 2, 3].map((t) =>
        vote(t, {
          ip_address: WIFI,
          user_agent: IPHONE_UA,
          fingerprintjs_visitor_id: 'p',
          screen_resolution: '390x844',
        })
      )
      expect(findSharedNetworks(same).size).toBe(0)
    })

    it('does not tell devices apart by visitor id', () => {
      const votes = ['a', 'b', 'c', 'd'].map((visitor, i) =>
        vote(i, {
          ip_address: WIFI,
          user_agent: IPHONE_UA,
          fingerprintjs_visitor_id: visitor,
          screen_resolution: '390x844',
        })
      )
      expect(findSharedNetworks(votes).size).toBe(0)
    })

    it('tells devices apart by screen size alone', () => {
      const votes = ['390x844', '430x932', '375x667'].map((res, i) =>
        vote(i, {
          ip_address: WIFI,
          user_agent: IPHONE_UA,
          fingerprintjs_visitor_id: 'p',
          screen_resolution: res,
        })
      )
      expect(findSharedNetworks(votes)).toEqual(new Set([WIFI]))
    })

    it('ignores votes with no IP address', () => {
      const votes = ['A', 'B', 'C'].map((ua, i) =>
        vote(i, { ip_address: null, user_agent: ua })
      )
      expect(findSharedNetworks(votes).size).toBe(0)
    })

    it('keeps networks apart', () => {
      const votes = [
        vote(0, { ip_address: WIFI, user_agent: 'A' }),
        vote(1, { ip_address: WIFI, user_agent: 'B' }),
        vote(2, { ip_address: HOME, user_agent: 'C' }),
      ]
      expect(findSharedNetworks(votes).size).toBe(0)
    })

    it('allows two identical phones per unshared connection', () => {
      expect(IDENTICAL_PHONES_ALLOWED).toBe(2)
    })
  })

  describe('buildReviewQueue', () => {
    it('contains only pending votes, oldest first', () => {
      const v1 = vote(0, { fingerprintjs_visitor_id: 'p' })
      const v2 = vote(50, { fingerprintjs_visitor_id: 'p', status: 'pending' })
      const v3 = vote(20, { fingerprintjs_visitor_id: 'p', status: 'pending' })
      const v4 = vote(30, { status: 'rejected' })
      const v5 = vote(40, { status: 'approved' })
      const queue = buildReviewQueue([v2, v5, v1, v4, v3])
      expect(queue.map((i) => i.vote.id)).toEqual([v3.id, v2.id])
    })

    it('matches each held vote against every vote, not just the queue', () => {
      const original = vote(0, { email: 'a@b.c' })
      const repeat = vote(10, { email: 'a@b.c', status: 'pending' })
      const [item] = buildReviewQueue([repeat, original])
      expect(item.matches[0].voteId).toBe(original.id)
      expect(item.suggestion).toBe('reject')
    })

    it('works out shared networks from every vote, including decided ones', () => {
      const others = ['A', 'B'].map((ua, i) =>
        vote(i, { ip_address: WIFI, user_agent: ua, status: 'rejected' })
      )
      const earlier = [10, 11].map((t) =>
        vote(t, { fingerprintjs_visitor_id: 'p', ip_address: WIFI })
      )
      const held = vote(20, {
        fingerprintjs_visitor_id: 'p',
        ip_address: WIFI,
        status: 'pending',
      })
      const [item] = buildReviewQueue([...others, ...earlier, held])
      expect(item.suggestion).toBe('approve')
      expect(item.reason).toMatch(/busy shared network/)
    })

    it('is empty when nothing is pending', () => {
      expect(
        buildReviewQueue([vote(0), vote(1, { status: 'rejected' })])
      ).toEqual([])
    })
  })

  describe('describeDevice', () => {
    it('joins OS, browser and screen', () => {
      expect(describeDevice(vote(0))).toBe('iOS 18.6 · Safari · 390x844')
    })

    it('leaves out Unknown and missing parts', () => {
      expect(
        describeDevice(
          vote(0, {
            os_name: 'Android',
            os_version: 'Unknown',
            browser_name: 'Unknown',
            screen_resolution: null,
          })
        )
      ).toBe('Android')
    })

    it('says "Unknown device" when nothing is known', () => {
      expect(
        describeDevice(
          vote(0, {
            os_name: null,
            os_version: null,
            browser_name: null,
            screen_resolution: null,
          })
        )
      ).toBe('Unknown device')
    })
  })

  describe('countCrowdVotes', () => {
    it('counts by status, overall and per band', () => {
      const votes = [
        vote(0, { band_id: 'a', status: 'approved' }),
        vote(1, { band_id: 'a', status: 'approved' }),
        vote(2, { band_id: 'a', status: 'pending' }),
        vote(3, { band_id: 'b', status: 'rejected' }),
        vote(4, { band_id: 'b', status: 'approved' }),
      ]
      expect(countCrowdVotes(votes)).toEqual({
        total: { approved: 3, pending: 1, rejected: 1 },
        byBand: {
          a: { approved: 2, pending: 1, rejected: 0 },
          b: { approved: 1, pending: 0, rejected: 1 },
        },
      })
    })

    it('returns zeros and no bands for no votes', () => {
      expect(countCrowdVotes([])).toEqual({
        total: { approved: 0, pending: 0, rejected: 0 },
        byBand: {},
      })
    })
  })
})
