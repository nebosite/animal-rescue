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

  private renderedCourseLabel = ''
  private renderedCourseTarget = ''
  private renderedClock = ''
  private renderedLoads = -1
  private renderedSeat: boolean | null = null

  /**
   * The copilot's two gauges — line out and water left — and who is working
   * them. Read from live elements rather than stored, so the panel can be
   * absent (in a test page) without this caring.
   */
  setCrew(winchExtended: number, tankFraction: number, loads: number, takenOver: boolean): void {
    const winchBar = document.getElementById('winch-bar')
    if (winchBar) winchBar.style.width = `${Math.round(winchExtended * 100)}%`

    const waterBar = document.getElementById('water-bar')
    if (waterBar) waterBar.style.width = `${Math.round(tankFraction * 100)}%`

    if (loads !== this.renderedLoads) {
      this.renderedLoads = loads
      const label = document.getElementById('water-loads')
      if (label) label.textContent = `${loads}`
    }

    if (takenOver !== this.renderedSeat) {
      this.renderedSeat = takenOver
      const who = document.getElementById('crew-who')
      if (who) who.textContent = takenOver ? 'PLAYER 2' : 'BRAM'
      const panel = document.getElementById('crew')
      if (panel) panel.dataset.seat = takenOver ? 'player' : 'ferret'
    }
  }

  private renderedTemperature = -1
  private renderedSpraying: boolean | null = null

  /** The temperature gauge: how close the machine is to burning, and whether the spray is on. */
  setTemperature(temperature: number, spraying: boolean): void {
    const bar = document.getElementById('temp-bar')
    if (!bar) return
    const percent = Math.round(temperature * 100)
    if (percent !== this.renderedTemperature) {
      this.renderedTemperature = percent
      bar.style.width = `${percent}%`
      bar.dataset.level = temperature >= 0.8 ? 'critical' : temperature >= 0.5 ? 'hot' : 'ok'
    }
    if (spraying !== this.renderedSpraying) {
      this.renderedSpraying = spraying
      const label = document.getElementById('temp-state')
      if (label) label.textContent = spraying ? 'SPRAY' : ' '
    }
  }

  private renderedRoster = ''

  /**
   * The roster strip: a chip per animal met so far, in the roster's order, with
   * what has become of them. Rebuilt only when something changes.
   */
  setRoster(entries: readonly { animal: { name: string; look: { coat: number } }; status: string }[]): void {
    const strip = document.getElementById('roster')
    if (!strip) return
    const key = entries.map((e) => `${e.animal.name}:${e.status}`).join('|')
    if (key === this.renderedRoster) return
    this.renderedRoster = key
    strip.replaceChildren(
      ...entries.filter((e) => e.status !== 'unmet').map((e) => {
        const chip = document.createElement('span')
        chip.className = 'chip'
        chip.dataset.status = e.status
        const dot = document.createElement('i')
        dot.style.background = `#${e.animal.look.coat.toString(16).padStart(6, '0')}`
        chip.append(dot, e.animal.name)
        return chip
      }),
    )
  }

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
  showShiftEnd(score: number, rescued: number, detail: string, title = 'Shift over', prompt?: string): void {
    const overlay = document.getElementById('shift-end')
    if (!overlay) return
    document.getElementById('shift-end-title')!.textContent = title
    if (prompt) document.getElementById('shift-end-prompt')!.innerHTML = prompt
    document.getElementById('shift-end-score')!.textContent = String(score)
    document.getElementById('shift-end-detail')!.textContent = `${rescued} rescued · ${detail}`
    overlay.hidden = false
  }

  /**
   * The upgrade shop on the level card: one button per upgrade, numbered to
   * match the keys 1-4, with what it costs and whether the score covers it.
   * `onBuy` is told which was chosen; the caller re-renders with the new state.
   */
  showShop(items: readonly ShopItem[], balance: number, note: string, onBuy: (index: number) => void): void {
    const shop = document.getElementById('shop')
    if (!shop) return
    document.getElementById('shop-note')!.textContent = note
    document.getElementById('shop-balance')!.textContent = `${balance} to spend`
    document.getElementById('shop-items')!.replaceChildren(
      ...items.map((item, index) => {
        const button = document.createElement('button')
        button.className = 'shop-item'
        button.disabled = !item.affordable
        button.dataset.maxed = String(item.price === null)
        const level = '●'.repeat(item.level) + '○'.repeat(Math.max(0, item.maxLevel - item.level))
        const price = item.price === null ? 'MAX' : `${item.price}`
        button.innerHTML = `<b>${index + 1}</b><span class="shop-title"></span><span class="shop-level">${level}</span><span class="shop-price">${price}</span>`
        button.querySelector('.shop-title')!.textContent = `${item.title} — ${item.blurb}`
        button.addEventListener('click', () => { onBuy(index); button.blur() })
        return button
      }),
    )
    shop.hidden = false
  }

  /** Shop only: a line for why it is closed, when it is. */
  showShopClosed(note: string): void {
    const shop = document.getElementById('shop')
    if (!shop) return
    document.getElementById('shop-note')!.textContent = note
    document.getElementById('shop-balance')!.textContent = ''
    document.getElementById('shop-items')!.replaceChildren()
    shop.hidden = false
  }

  hideShop(): void {
    const shop = document.getElementById('shop')
    if (shop) shop.hidden = true
  }

  /** Put the card away, because another shift is starting in place. */
  hideShiftEnd(): void {
    this.hideShop()
    const overlay = document.getElementById('shift-end')
    if (overlay) overlay.hidden = true
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
   * Swing the needle to wherever the pilot should be heading, and say what is
   * over there and how far. On a map this size the target is usually past the
   * fog, so without this you are searching rather than flying.
   *
   * The name matters as much as the angle. A bare rotating arrow answers
   * neither of the questions a player actually has — which way, and toward
   * what — because nothing on it says which end is the nose or what it has
   * picked out. The dial has a fixed mark for the nose and this has a label.
   *
   * `relativeBearing` is in radians, positive to the left of the nose.
   */
  setCourse(relativeBearing: number, range: number, target: 'pickup' | 'base', label: string): void {
    if (this.compassElement) {
      // Rotation runs clockwise, so a target to the left of the nose is negative.
      const degrees = (-relativeBearing * 180) / Math.PI
      // Set as an SVG attribute, not a CSS transform: this rotates about the
      // user-space origin, which is the middle of the dial. A CSS transform
      // would pivot about the needle's own bounding box instead, swinging it
      // round its waist rather than round the helicopter.
      this.compassElement.setAttribute('transform', `rotate(${degrees.toFixed(1)})`)
    }

    const rounded = Math.round(range)
    if (this.rangeElement && rounded !== this.renderedRange) {
      this.renderedRange = rounded
      this.rangeElement.textContent = `${rounded} m`
    }

    if (label !== this.renderedCourseLabel) {
      this.renderedCourseLabel = label
      const name = document.getElementById('course-target')
      if (name) name.textContent = label
    }
    if (target !== this.renderedCourseTarget) {
      this.renderedCourseTarget = target
      const course = document.getElementById('course')
      if (course) course.dataset.target = target
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

/** One row of the shop. */
export interface ShopItem {
  title: string
  blurb: string
  level: number
  maxLevel: number
  /** Null once it is at the top level. */
  price: number | null
  affordable: boolean
}
