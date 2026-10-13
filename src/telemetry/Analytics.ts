/** What Google's tag calls to record something: `gtag('event', name, params)`. */
export type Send = (...args: unknown[]) => void

export type EventParams = Record<string, string | number | boolean>

/**
 * Anonymous usage counts through Google Analytics 4: how many people play, how
 * far they get, how a shift ends. Nothing identifies a player, and nothing is
 * sent from a dev build or a test.
 *
 * The game talks to this class and never to `gtag` directly, so what is
 * recorded can be tested with a stand-in sender, and a page that blocks the
 * script (an ad blocker, an offline machine) simply sends nothing.
 */
export class Analytics {
  constructor(private readonly send: Send | null) {}

  /** Records nothing; for development, tests, and any place analytics is off. */
  static off(): Analytics {
    return new Analytics(null)
  }

  /**
   * Load Google's tag for this measurement id and send through it. Page views
   * come for free with the `config` call; everything else is `event`.
   */
  static load(measurementId: string): Analytics {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
    document.head.appendChild(script)

    const layer = ((window as unknown as { dataLayer?: unknown[] }).dataLayer ??= [])
    // The tag only understands an `arguments` object pushed onto the data layer,
    // not an array of the same values — so this has to be a plain function.
    function gtag(..._args: unknown[]): void {
      // eslint-disable-next-line prefer-rest-params
      layer.push(arguments)
    }
    gtag('js', new Date())
    gtag('config', measurementId)
    return new Analytics(gtag)
  }

  event(name: string, params: EventParams = {}): void {
    this.send?.('event', name, params)
  }
}
