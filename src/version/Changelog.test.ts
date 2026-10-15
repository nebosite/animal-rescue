import { describe, expect, it } from 'vitest'
import packageJson from '../../package.json?raw'
import { CHANGELOG, VERSION } from './Changelog'

describe('Changelog', () => {
  it('has the version in package.json on top, so a publish cannot forget to bump one of them', () => {
    const pkg = JSON.parse(packageJson) as { version: string }
    expect(VERSION).toBe(pkg.version)
  })

  it('lists every version once, newest first, each with something to say', () => {
    const versions = CHANGELOG.map((r) => r.version)
    expect(new Set(versions).size).toBe(versions.length)
    const asNumbers = (v: string) => v.split('.').map(Number)
    for (let i = 1; i < versions.length; i++) {
      const [a, b, c] = asNumbers(versions[i - 1])
      const [x, y, z] = asNumbers(versions[i])
      expect(a * 1e6 + b * 1e3 + c).toBeGreaterThan(x * 1e6 + y * 1e3 + z)
    }
    for (const release of CHANGELOG) expect(release.notes.length).toBeGreaterThan(0)
  })
})
