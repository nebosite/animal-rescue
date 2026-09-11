import type { RadioLine } from '../game/Announcer'

/**
 * The radio: who is talking and what they said, one line at a time. Lines
 * queue up briefly rather than trampling each other, and each stays up long
 * enough to read. Announces each line as it appears, so the voice can play.
 */
export class RadioPanel {
  private current: RadioLine | null = null
  private remaining = 0
  private readonly queue: RadioLine[] = []

  constructor(
    private readonly panel: HTMLElement,
    private readonly speakerElement: HTMLElement,
    private readonly textElement: HTMLElement,
    private readonly onSpeak: (line: RadioLine) => void = () => {},
  ) {}

  say(line: RadioLine): void {
    if (!this.current) {
      this.show(line)
      return
    }
    this.queue.push(line)
    // Keep the backlog short: nobody wants to hear the third-oldest complaint.
    if (this.queue.length > MAX_QUEUED) this.queue.shift()
  }

  /** Call every frame. */
  update(dt: number): void {
    if (!this.current) return
    this.remaining -= dt
    if (this.remaining > 0) return
    const next = this.queue.shift()
    if (next) this.show(next)
    else this.hide()
  }

  private show(line: RadioLine): void {
    this.current = line
    this.remaining = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, BASE_SECONDS + line.text.length * SECONDS_PER_CHAR))
    this.speakerElement.textContent = line.speaker
    this.textElement.textContent = line.text
    this.panel.dataset.speaker = line.speaker.toLowerCase()
    this.panel.classList.add('is-visible')
    this.onSpeak(line)
  }

  private hide(): void {
    this.current = null
    this.panel.classList.remove('is-visible')
  }
}

const MAX_QUEUED = 2
const BASE_SECONDS = 1.6
const SECONDS_PER_CHAR = 0.045
const MIN_SECONDS = 2.4
const MAX_SECONDS = 4.5
