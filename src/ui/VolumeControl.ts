import type { AudioEngine } from '../audio/AudioEngine'

/**
 * The mute button and volume slider. Binds the two controls to the engine,
 * remembers the setting between visits, and hands keyboard focus straight
 * back — otherwise Space would toggle mute and the arrows would nudge the
 * slider instead of flying the helicopter.
 */
export class VolumeControl {
  constructor(
    private readonly engine: AudioEngine,
    private readonly button: HTMLButtonElement,
    slider: HTMLInputElement,
  ) {
    const saved = loadSetting()
    engine.setVolume(saved.volume)
    engine.setMuted(saved.muted)
    slider.value = String(saved.volume)

    button.addEventListener('click', () => {
      engine.setMuted(!engine.muted)
      this.render()
      this.save()
      button.blur()
    })

    slider.addEventListener('input', () => {
      engine.setVolume(Number(slider.value))
      // Dragging the slider up is an unmistakable "I want sound".
      if (engine.muted && engine.volume > 0) engine.setMuted(false)
      this.render()
      this.save()
    })
    slider.addEventListener('change', () => slider.blur())
    slider.addEventListener('pointerup', () => slider.blur())

    this.render()
  }

  private render(): void {
    const silent = this.engine.muted || this.engine.volume === 0
    this.button.textContent = silent ? '🔇' : this.engine.volume < 0.5 ? '🔉' : '🔊'
    this.button.setAttribute('aria-label', silent ? 'Unmute' : 'Mute')
    this.button.classList.toggle('is-muted', silent)
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume: this.engine.volume, muted: this.engine.muted }))
    } catch {
      // Storage can be unavailable (private mode, blocked); the setting just will not persist.
    }
  }
}

function loadSetting(): { volume: number; muted: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { volume?: unknown; muted?: unknown }
      const volume = typeof parsed.volume === 'number' ? parsed.volume : 1
      const muted = typeof parsed.muted === 'boolean' ? parsed.muted : false
      return { volume: Math.min(1, Math.max(0, volume)), muted }
    }
  } catch {
    // Fall through to the default.
  }
  return { volume: 1, muted: false }
}

const STORAGE_KEY = 'animal-rescue.audio'
