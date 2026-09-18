import { act, render } from '@testing-library/react'
import { vi } from 'vitest'
import { BorderGlow } from '../border-glow'

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void

/** Captures the observer so a test can drive the intersection itself. */
function stubIntersectionObserver() {
  const state: {
    callback?: ObserverCallback
    observed: number
    disconnected: number
  } = { observed: 0, disconnected: 0 }

  class FakeObserver {
    constructor(callback: ObserverCallback) {
      state.callback = callback
    }
    observe() {
      state.observed += 1
    }
    disconnect() {
      state.disconnected += 1
    }
    unobserve() {}
  }

  vi.stubGlobal('IntersectionObserver', FakeObserver)
  return state
}

describe('BorderGlow', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is hidden from assistive technology', () => {
    stubIntersectionObserver()

    const { container } = render(<BorderGlow />)

    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
  })

  it('stays unlit until the card comes into view', () => {
    stubIntersectionObserver()

    const { container } = render(<BorderGlow />)

    const rect = container.querySelector('rect')
    expect(rect).toHaveClass('opacity-0')
    expect(rect).not.toHaveClass('animate-border-glow')
  })

  it('runs one lap when the card intersects, then stops observing', () => {
    const state = stubIntersectionObserver()

    const { container } = render(<BorderGlow duration={900} />)
    expect(state.observed).toBe(1)

    // The observer fires outside React's knowledge, so the resulting state
    // update has to be flushed explicitly.
    act(() => {
      state.callback?.([{ isIntersecting: true }])
    })

    const rect = container.querySelector('rect')
    expect(rect).toHaveClass('animate-border-glow')
    expect(rect).toHaveStyle({ animationDuration: '900ms' })
    // Disconnecting is what keeps it a one-off rather than replaying on every
    // scroll past.
    expect(state.disconnected).toBeGreaterThan(0)
  })

  it('normalises the dash to the requested arc of the perimeter', () => {
    stubIntersectionObserver()

    const { container } = render(<BorderGlow arc={0.25} />)

    const rect = container.querySelector('rect')
    expect(rect).toHaveAttribute('pathLength', '100')
    expect(rect).toHaveAttribute('stroke-dasharray', '25 75')
  })

  it('renders without an IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined)

    const { container } = render(<BorderGlow />)

    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
