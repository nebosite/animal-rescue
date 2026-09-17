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
  private renderedTask = ''
  private renderedHint = ''

  constructor(
    private readonly statusElement: HTMLElement,
    private readonly scoreElement: HTMLElement,
    private readonly hintElement: HTMLElement,
    private readonly compassElement?: HTMLElement,
    private readonly rangeElement?: HTMLElement,
    private readonly integrityBar?: HTMLElement,
    private readonly integrityPanel?: HTMLElement,
    private readonly objectivePanel?: HTMLElement,
    private readonly taskElement?: HTMLElement,
    private readonly objectiveHint?: HTMLElement,
  ) {}

  private renderedClock = ''

  /** The shift clock, blinking when it is nearly over. */
  setClock(text: string, closing: boolean, clockElement?: HTMLElement): void {
    const element = clockElement ?? document.getElementById('clock')
    if (!element) return
    if (text !== this.renderedClock) {
      this.renderedClock = text
      element.textContent = text
    }
    const flag = closing ? 'true' : 'false'
    if (element.dataset.closing !== flag) element.dataset.closing = flag
  }

  /** The end-of-shift card: score, what was brought home, how to go again. */
  showShiftEnd(score: number, rescued: number, detail: string): void {
    const overlay = document.getElementById('shift-end')
    if (!overlay) return
    document.getElementById('shift-end-score')!.textContent = String(score)
    document.getElementById('shift-end-detail')!.textContent = `${rescued} rescued · ${detail}`
    overlay.hidden = false
  }

  /** Say what the player should be doing, and which beacon it concerns. */
  setObjective(task: string, hint: string, target: string): void {
    if (this.taskElement && task !== this.renderedTask) {
      this.renderedTask = task
      this.taskElement.textContent = task
    }
    if (this.objectiveHint && hint !== this.renderedHint) {
      this.renderedHint = hint
      this.objectiveHint.textContent = hint
    }
    if (this.objectivePanel && this.objectivePanel.dataset.target !== target) {
      this.objectivePanel.dataset.target = target
    }
  }

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
