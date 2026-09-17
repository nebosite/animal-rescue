import { CHIEF, type AnimalProfile, type VoiceProfile } from './AnimalProfile'
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

  /** Thanks — or something grudging if the trip cost the animal some patience. */
  delivered(animal: AnimalProfile, credited: number): RadioLine {
    const lines = credited < animal.value ? animal.lines.grudging : animal.lines.thanks
    const key = credited < animal.value ? `${animal.id}.grudging` : `${animal.id}.thanks`
    return this.animal(animal, this.pick(key, lines))
  }

  /** The Chief on the paint job. He has nothing to say about banking. */
  chiefOnRoughFlying(rough: RoughHandling): RadioLine | null {
    if (rough === 'hard-landing') return this.chief(this.pick('chief.hard', CHIEF.lines.hardLanding))
    if (rough === 'bump') return this.chief(this.pick('chief.bump', CHIEF.lines.bump))
    return null
  }

  /** The Chief listening to his helicopter mow the forest. */
  treetops(): RadioLine {
    return this.chief(this.pick('chief.treetops', CHIEF.lines.treetops))
  }

  /** The Chief watching his paint blister. */
  scorched(): RadioLine {
    return this.chief(this.pick('chief.scorched', CHIEF.lines.scorched))
  }

  /** The Chief taking the controls off you. */
  grounded(): RadioLine {
    return this.chief(this.pick('chief.grounded', CHIEF.lines.grounded))
  }

  /** The Chief handing a mended helicopter back. */
  repaired(): RadioLine {
    return this.chief(this.pick('chief.repaired', CHIEF.lines.repaired))
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
