import { afterEach, describe, expect, it, vi } from 'vitest'
import { Analytics } from './Analytics'

describe('Analytics', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends an event through the tag with its parameters', () => {
    const sent: unknown[][] = []
    new Analytics((...args) => sent.push(args)).event('animal_rescued', { animal: 'Gus', credit: 4 })
    expect(sent).toEqual([['event', 'animal_rescued', { animal: 'Gus', credit: 4 }]])
  })

  it('sends nothing at all when it is off', () => {
    // Must not throw either: every call site is unconditional.
    expect(() => Analytics.off().event('game_start')).not.toThrow()
  })

  describe('loading the tag', () => {
    function stubBrowser() {
      const scripts: Array<{ async?: boolean; src?: string }> = []
      const window: { dataLayer?: unknown[] } = {}
      vi.stubGlobal('window', window)
      vi.stubGlobal('document', {
        createElement: () => ({}),
        head: { appendChild: (node: { async?: boolean; src?: string }) => scripts.push(node) },
      })
      return { scripts, window }
    }

    it('adds the tag script for this measurement id, loaded without blocking the page', () => {
      const { scripts } = stubBrowser()
      Analytics.load('G-TEST123')
      expect(scripts).toHaveLength(1)
      expect(scripts[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-TEST123')
      expect(scripts[0].async).toBe(true)
    })

    it('configures the property, so page views are counted', () => {
      const { window } = stubBrowser()
      Analytics.load('G-TEST123')
      const calls = (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>))
      expect(calls[0][0]).toBe('js')
      expect(calls[1]).toEqual(['config', 'G-TEST123'])
    })

    it('pushes `arguments` objects, which is the only form the tag understands', () => {
      // An array of the same values is silently ignored by gtag.js, and nothing
      // is ever recorded: this is the dead wire that is invisible from the page.
      const { window } = stubBrowser()
      const analytics = Analytics.load('G-TEST123')
      analytics.event('game_start')
      const last = window.dataLayer!.at(-1)
      expect(Array.isArray(last)).toBe(false)
      expect(Object.prototype.toString.call(last)).toBe('[object Arguments]')
      expect(Array.from(last as ArrayLike<unknown>)).toEqual(['event', 'game_start', {}])
    })

    it('keeps an existing data layer rather than replacing it', () => {
      const { window } = stubBrowser()
      const earlier = ['already here']
      window.dataLayer = earlier
      Analytics.load('G-TEST123')
      expect(window.dataLayer).toBe(earlier)
      expect(earlier[0]).toBe('already here')
    })
  })
})
