/**
 * The on-screen status line and score.
 *
 * Thin on purpose: it renders what it is given and owns no game rules. The one
 * thing it does own is how long a flashed message stays up, which is a display
 * concern rather than a rule of the rescue.
 */
export class Hud {
  private flashMessage = ''
  private flashUntil = 0
  private renderedStatus = ''
  private renderedScore = -1

  private renderedRange = -1
  private renderedIntegrity = -1

  constructor(
    private readonly statusElement: HTMLElement,
    private readonly scoreElement: HTMLElement,
    private readonly hintElement: HTMLElement,
    private readonly compassElement?: HTMLElement,
    private readonly rangeElement?: HTMLElement,
    private readonly integrityBar?: HTMLElement,
    private readonly integrityPanel?: HTMLElement,
  ) {}

  /** Show how much helicopter is left, 1 down to 0. */
  setIntegrity(integrity: number): void {
    const percent = Math.round(integrity * 100)
    if (percent === this.renderedIntegrity) return
    this.renderedIntegrity = percent

    if (this.integrityBar) this.integrityBar.style.width = `${percent}%`
    if (this.integrityPanel) {
      // Three bands, so the state is readable at a glance rather than by degree.
      this.integrityPanel.dataset.state = percent <= 25 ? 'critical' : percent < 60 ? 'hurt' : 'fine'
    }
  }

  /**
   * Point the compass at wherever the pilot should be heading and show the
   * range. On a map this size the target is usually past the fog, so without
   * this you are searching rather than flying.
   *
   * `relativeBearing` is in radians, positive to the left of the nose.
   */
  setCourse(relativeBearing: number, range: number): void {
    if (this.compassElement) {
      // CSS rotation runs clockwise, so a target to the left is negative.
      this.compassElement.style.transform = `rotate(${(-relativeBearing * 180) / Math.PI}deg)`
    }
    const rounded = Math.round(range)
    if (this.rangeElement && rounded !== this.renderedRange) {
      this.renderedRange = rounded
      this.rangeElement.textContent = `${rounded} m`
    }
  }

  /** Show the controller hints instead of the keyboard ones while a pad is connected. */
  showGamepad(connected: boolean): void {
    const device = connected ? 'gamepad' : 'keyboard'
    if (this.hintElement.dataset.device !== device) this.hintElement.dataset.device = device
  }

  /** Show a message that takes over the banner briefly, then falls back. */
  flash(message: string, seconds = 2.2): void {
    this.flashMessage = message
    this.flashUntil = performance.now() + seconds * 1000
  }

  /** Called every frame with the current standing status and score. */
  update(status: string, score: number): void {
    const flashing = performance.now() < this.flashUntil
    this.render(flashing ? this.flashMessage : status, flashing)

    if (score !== this.renderedScore) {
      this.renderedScore = score
      this.scoreElement.textContent = `SCORE ${score}`
    }
  }

  private render(message: string, flashing: boolean): void {
    if (message !== this.renderedStatus) {
      this.renderedStatus = message
      this.statusElement.textContent = message
      this.statusElement.classList.toggle('is-visible', message !== '')
    }
    this.statusElement.classList.toggle('is-flash', flashing)
  }
}
