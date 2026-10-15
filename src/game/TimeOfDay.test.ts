import { describe, expect, it } from 'vitest'
import { isNight, skyForLevel } from './TimeOfDay'

const brightness = (color: number) => ((color >> 16) & 0xff) + ((color >> 8) & 0xff) + (color & 0xff)

describe('skyForLevel', () => {
  it('gets lower and dimmer with every level until night', () => {
    for (let level = 1; level < 4; level++) {
      const now = skyForLevel(level)
      const next = skyForLevel(level + 1)
      expect(next.elevation).toBeLessThan(now.elevation)
      expect(next.sunIntensity).toBeLessThan(now.sunIntensity)
      expect(brightness(next.skyColor)).toBeLessThan(brightness(now.skyColor))
    }
  })

  it('leans harder on the fire as the light goes', () => {
    for (let level = 1; level < 5; level++) {
      expect(skyForLevel(level + 1).fireGlow).toBeGreaterThan(skyForLevel(level).fireGlow)
    }
  })

  it('is night from level five on, and stays night', () => {
    expect(isNight(4)).toBe(false)
    expect(isNight(5)).toBe(true)
    expect(skyForLevel(9)).toEqual(skyForLevel(5))
  })

  it('starts as the bright day the game has always had, and survives odd levels', () => {
    expect(skyForLevel(1).skyColor).toBe(0x8fd3ff)
    expect(skyForLevel(0)).toEqual(skyForLevel(1))
  })
})
