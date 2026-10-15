import type { WaterTank } from './WaterTank'

/** What the gauge needs from the world each frame. */
export interface HeatInput {
  /** Fire heat at the helicopter, 0..1, as `Fire.heatAt` reports it. */
  flameHeat: number
  /** A person has the copilot's seat, so the water is theirs to work. */
  manual: boolean
  /** Their hand on the water control. Ignored unless `manual`. */
  manualSpray: boolean
}

/**
 * How hot the machine is, and the water that keeps it from burning.
 *
 * Flame heats the airframe; open air and, much faster, a spray of water cool it.
 * With nobody in the second seat the spray works itself: it comes on when the
 * temperature climbs past a threshold and goes off again once it has been beaten
 * back, so a pilot can set down in the flames and sit there for as long as the
 * tank holds out. With a person in the seat the spray is theirs, on their say.
 *
 * The airframe only suffers when the temperature is all the way up — which is to
 * say when the water has run out — so water is what a landing in the fire costs,
 * and the tank is the whole budget. Pure: the tank is passed in so it can drain.
 */
export class HeatGauge {
  /** 0 is cool, 1 is the point where the paint starts to go. */
  temperature = 0
  spraying = false
  /** How fast flame heats the machine, as a multiple of stock; fire resistance brings it down. */
  riseScale = 1

  /**
   * Time passes. Returns the heat that actually reaches the airframe, 0..1:
   * nothing while there is any margin, the full flame heat once there is none.
   */
  advance(dt: number, input: HeatInput, tank: WaterTank): number {
    this.spraying = this.wantsSpray(input) && tank.hasSpray
    if (this.spraying) tank.spray(SPRAY_LOADS_PER_SECOND * dt)

    const rise = input.flameHeat * HEAT_RISE * this.riseScale
    const fall = AIR_COOLING + (this.spraying ? SPRAY_COOLING : 0)
    this.temperature = Math.min(1, Math.max(0, this.temperature + (rise - fall) * dt))

    return this.temperature >= 1 ? input.flameHeat : 0
  }

  /** Back to cold, for another level. */
  reset(): void {
    this.temperature = 0
    this.spraying = false
  }

  private wantsSpray(input: HeatInput): boolean {
    if (input.manual) return input.manualSpray
    // Hysteresis: once it is on it keeps going until the temperature is well
    // down, so the valve does not chatter at the threshold.
    return this.spraying ? this.temperature > SPRAY_OFF : this.temperature >= SPRAY_ON
  }
}

/** Temperature gained per second in the thickest flame. A dry machine is cooked in about three seconds. */
const HEAT_RISE = 0.35
const AIR_COOLING = 0.1
const SPRAY_COOLING = 1.2
const SPRAY_ON = 0.5
const SPRAY_OFF = 0.2
/**
 * Half a load a second while the valve is open. Held at the threshold in the
 * heaviest flame it is open about a third of the time: a full tank is about
 * half a minute sitting in the fire.
 */
const SPRAY_LOADS_PER_SECOND = 0.5
