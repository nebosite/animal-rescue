/**
 * The on-screen status line. Thin on purpose: it renders a message and owns no
 * game rules about when one should appear.
 */
export class Hud {
  private readonly element: HTMLElement
  private current = ''

  constructor(element: HTMLElement) {
    this.element = element
  }

  /** Show a message, or hide the line entirely when given nothing. */
  show(message: string): void {
    if (message === this.current) return
    this.current = message
    this.element.textContent = message
    this.element.classList.toggle('is-visible', message !== '')
  }
}
