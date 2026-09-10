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

  constructor(
    private readonly statusElement: HTMLElement,
    private readonly scoreElement: HTMLElement,
  ) {}

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
      this.scoreElement.textContent = `RESCUED ${score}`
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
