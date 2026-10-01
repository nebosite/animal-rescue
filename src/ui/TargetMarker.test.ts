import { describe, expect, it } from 'vitest'
import { clearOfPanels, type Box } from './TargetMarker'

const WIDTH = 1600
const HEIGHT = 900
/** Roughly a marker's own half-size at the default text scale. */
const HALF_W = 90
const HALF_H = 30

const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom })

/** Do these two rectangles touch at all? */
function overlaps(place: { left: number; top: number }, panel: Box): boolean {
  return place.left + HALF_W > panel.left && place.left - HALF_W < panel.right
    && place.top + HALF_H > panel.top && place.top - HALF_H < panel.bottom
}

describe('clearOfPanels', () => {
  it('leaves a marker that is not on anything exactly where it was', () => {
    const panels = [box(0, 0, 400, 200)]
    expect(clearOfPanels(800, 500, HALF_W, HALF_H, panels, WIDTH, HEIGHT)).toEqual({ left: 800, top: 500 })
  })

  it('shoves a marker off a panel it has landed on', () => {
    const panel = box(1100, 240, 1590, 460)
    const place = clearOfPanels(1400, 350, HALF_W, HALF_H, [panel], WIDTH, HEIGHT)
    expect(overlaps(place, panel)).toBe(false)
  })

  it('takes the shortest way out', () => {
    // Just below the top edge of a tall panel: up is much nearer than sideways.
    const panel = box(600, 300, 1000, 800)
    const place = clearOfPanels(800, 320, HALF_W, HALF_H, [panel], WIDTH, HEIGHT)
    expect(place.top).toBe(300 - HALF_H)
    expect(place.left).toBe(800)
  })

  it('clears a whole HUD of panels at once, with a tall stack on each side', () => {
    // The layout that broke the first version: a tall bottom-left stack and a
    // tall top-right one left a fifteen-pixel band between them, and treating
    // the panels as full-width bands piled every marker into it — on top of
    // the very panels it was meant to be avoiding.
    const panels = [
      box(18, 18, 620, 290),      // objective, top left
      box(1118, 18, 1582, 460),   // score, compass, airframe, crew: top right
      box(18, 470, 402, 882),     // volume and key hints: bottom left
      box(405, 735, 1195, 870),   // radio
    ]
    for (let left = HALF_W; left <= WIDTH - HALF_W; left += 37) {
      for (let top = HALF_H; top <= HEIGHT - HALF_H; top += 29) {
        const place = clearOfPanels(left, top, HALF_W, HALF_H, panels, WIDTH, HEIGHT)
        for (const panel of panels) {
          expect(overlaps(place, panel), `from ${left},${top} onto ${JSON.stringify(panel)}`).toBe(false)
        }
      }
    }
  })

  it('keeps the marker on the screen while it is getting out of the way', () => {
    const panels = [box(0, 0, 500, 300), box(1200, 600, 1600, 900)]
    for (let left = HALF_W; left <= WIDTH - HALF_W; left += 53) {
      for (let top = HALF_H; top <= HEIGHT - HALF_H; top += 41) {
        const place = clearOfPanels(left, top, HALF_W, HALF_H, panels, WIDTH, HEIGHT)
        expect(place.left).toBeGreaterThanOrEqual(HALF_W)
        expect(place.left).toBeLessThanOrEqual(WIDTH - HALF_W)
        expect(place.top).toBeGreaterThanOrEqual(HALF_H)
        expect(place.top).toBeLessThanOrEqual(HEIGHT - HALF_H)
      }
    }
  })

  it('gives up rather than teleporting when a panel covers the whole screen', () => {
    // There is nowhere to go, so leaving it put is the least wrong answer.
    const everything = [box(0, 0, WIDTH, HEIGHT)]
    expect(clearOfPanels(700, 400, HALF_W, HALF_H, everything, WIDTH, HEIGHT)).toEqual({ left: 700, top: 400 })
  })

  it('does not oscillate between two panels stacked on each other', () => {
    // The status banner sits directly on top of the radio. Escaping the radio
    // upward lands on the banner and escaping the banner downward lands back
    // on the radio, so a one-panel-at-a-time push never settles and the marker
    // ends up drawn across both of them.
    const status = box(420, 548, 1200, 650)
    const radio = box(405, 680, 1200, 878)
    for (const from of [{ left: 600, top: 757 }, { left: 800, top: 600 }, { left: 700, top: 668 }]) {
      const place = clearOfPanels(from.left, from.top, HALF_W, HALF_H, [status, radio], WIDTH, HEIGHT)
      expect(overlaps(place, status), JSON.stringify(from)).toBe(false)
      expect(overlaps(place, radio), JSON.stringify(from)).toBe(false)
    }
  })

  it('never leaves a marker worse covered than where it started', () => {
    const panels = [box(300, 300, 900, 500), box(850, 450, 1300, 700)]
    const area = (place: { left: number; top: number }) => panels.reduce((sum, panel) => {
      const across = Math.min(place.left + HALF_W, panel.right) - Math.max(place.left - HALF_W, panel.left)
      const down = Math.min(place.top + HALF_H, panel.bottom) - Math.max(place.top - HALF_H, panel.top)
      return sum + (across > 0 && down > 0 ? across * down : 0)
    }, 0)
    for (let left = HALF_W; left <= WIDTH - HALF_W; left += 61) {
      for (let top = HALF_H; top <= HEIGHT - HALF_H; top += 47) {
        const place = clearOfPanels(left, top, HALF_W, HALF_H, panels, WIDTH, HEIGHT)
        expect(area(place)).toBeLessThanOrEqual(area({ left, top }))
      }
    }
  })
})
