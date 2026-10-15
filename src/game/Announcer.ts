import { CHIEF, FERRET, type AnimalProfile, type VoiceProfile } from './AnimalProfile'
import type { RoughHandling } from './Handling'

/** One thing said over the radio. */
export interface RadioLine {
  speaker: string
  text: string
  voice: VoiceProfile
}

/**
 * Decides what gets said and by whom. Lines come from the character profiles;
 * this class only picks which one, cycling through the variants so a repeat
 * customer hears something new.
 */
export class Announcer {
  private readonly turns = new Map<string, number>()

  welcome(): RadioLine {
    return this.chief(this.pick('chief.welcome', CHIEF.lines.welcome))
  }

  pickedUp(animal: AnimalProfile): RadioLine {
    return this.animal(animal, this.pick(`${animal.id}.greeting`, animal.lines.greeting))
  }

  scolded(animal: AnimalProfile): RadioLine {
    return this.animal(animal, this.pick(`${animal.id}.scold`, animal.lines.scold))
  }

  /**
   * Thanks — grudging if the trip cost the animal some patience, warm if the
   * touchdown was feather-soft, and plain otherwise.
   */
  delivered(animal: AnimalProfile, scolded: boolean, gentle = false): RadioLine {
    const kind = scolded ? 'grudging' : gentle ? 'gentle' : 'thanks'
    return this.animal(animal, this.pick(`${animal.id}.${kind}`, animal.lines[kind]))
  }

  /** The Chief on the paint job. He has nothing to say about banking. */
  chiefOnRoughFlying(rough: RoughHandling): RadioLine | null {
    if (rough === 'hard-landing') return this.chief(this.pick('chief.hard', CHIEF.lines.hardLanding))
    if (rough === 'bump') return this.chief(this.pick('chief.bump', CHIEF.lines.bump))
    return null
  }

  /** An animal running from the fire to somewhere new. */
  bolted(animal: AnimalProfile): RadioLine {
    return this.animal(animal, this.pick(`${animal.id}.bolt`, animal.lines.bolt))
  }

  /** The Chief pointing at whoever the fire is about to reach. */
  fireClosingOn(animal: AnimalProfile): RadioLine {
    return this.chief(this.pick('chief.closing', CHIEF.lines.fireClosing).replace('{name}', animal.name))
  }

  /** The Chief calling time. */
  shiftOver(rescued: number): RadioLine {
    return this.chief(this.pick('chief.over', CHIEF.lines.shiftOver).replace('{count}', String(rescued)))
  }

  /** The Chief listening to his helicopter mow the forest. */
  treetops(): RadioLine {
    return this.chief(this.pick('chief.treetops', CHIEF.lines.treetops))
  }

  /** The Chief watching his paint blister. */
  scorched(): RadioLine {
    return this.chief(this.pick('chief.scorched', CHIEF.lines.scorched))
  }

  /** The Chief, while there is still a helicopter left to save. */
  failing(): RadioLine {
    return this.chief(this.pick('chief.failing', CHIEF.lines.failing))
  }

  /** And once there is not. He never takes the controls; he just wants it home. */
  wrecked(): RadioLine {
    return this.chief(this.pick('chief.wrecked', CHIEF.lines.wrecked))
  }

  /** The copilot. `about` fills in {name} where a line wants one. */
  ferret(kind: keyof typeof FERRET.lines, about?: string): RadioLine {
    const text = this.pick(`ferret.${kind}`, FERRET.lines[kind]).replace('{name}', about ?? 'them')
    return { speaker: FERRET.name, text, voice: FERRET.voice }
  }

  private animal(animal: AnimalProfile, text: string): RadioLine {
    return { speaker: animal.name, text, voice: animal.voice }
  }

  private chief(text: string): RadioLine {
    return { speaker: CHIEF.name, text, voice: CHIEF.voice }
  }

  private pick(key: string, lines: readonly string[]): string {
    const turn = this.turns.get(key) ?? 0
    this.turns.set(key, turn + 1)
    return lines[turn % lines.length]
  }
}
