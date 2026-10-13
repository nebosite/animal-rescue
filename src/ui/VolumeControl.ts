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
    private readonly slider: HTMLInputElement,
  ) {
    const start = startingSetting(loadSetting())
    engine.setVolume(start.volume)
    engine.setMuted(start.muted)
    slider.value = String(start.volume)

    button.addEventListener('click', () => {
      const next = afterButton({ volume: engine.volume, muted: engine.muted })
      this.setVolume(next.volume)
      engine.setMuted(next.muted)
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

  /** Move the slider and the engine together. */
  private setVolume(volume: number): void {
    this.engine.setVolume(volume)
    this.slider.value = String(this.engine.volume)
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

/** What the player has the audio set to. */
export interface AudioSetting {
  volume: number
  muted: boolean
}

/**
 * What the game starts with. Never silent: a game that opens with its speaker
 * showing off, and nothing to hear until the button has been pressed twice, reads
 * as broken. The volume is remembered between visits, but a mute is not — and a
 * volume remembered as zero (a stray click on the left of the slider) starts at
 * a sensible level instead of trapping the player in silence.
 */
export function startingSetting(saved: AudioSetting): AudioSetting {
  return { volume: saved.volume > 0 ? saved.volume : RECOVERED_VOLUME, muted: false }
}

/**
 * What one press of the speaker button does. If the game is silent, in either
 * way — muted, or the slider at zero — the press turns the sound on, and it
 * always works the first time. Otherwise it mutes.
 */
export function afterButton(current: AudioSetting): AudioSetting {
  const silent = current.muted || current.volume <= 0
  if (!silent) return { volume: current.volume, muted: true }
  return { volume: current.volume > 0 ? current.volume : RECOVERED_VOLUME, muted: false }
}

function loadSetting(): AudioSetting {
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
/** Where the volume lands when unmuting finds it at zero. */
const RECOVERED_VOLUME = 0.7
