import type { Release } from '../version/Changelog'

/**
 * The version in the corner, and the window of changes it opens.
 *
 * A click opens or closes the window; so does Escape, and a click anywhere
 * else closes it. Focus is handed straight back, as with the volume control,
 * so the keys that fly the helicopter never land on the button.
 */
export class VersionLabel {
  constructor(
    button: HTMLButtonElement,
    private readonly panel: HTMLElement,
    releases: readonly Release[],
  ) {
    button.textContent = `v${releases[0].version}`
    this.fill(releases)

    button.addEventListener('click', (event) => {
      event.stopPropagation()
      this.panel.hidden = !this.panel.hidden
      button.blur()
    })
    panel.addEventListener('click', (event) => event.stopPropagation())
    window.addEventListener('click', () => { this.panel.hidden = true })
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape') this.panel.hidden = true
    })
  }

  private fill(releases: readonly Release[]): void {
    const title = document.createElement('div')
    title.className = 'changelog-title'
    title.textContent = 'What changed'
    this.panel.append(title)

    for (const release of releases) {
      const heading = document.createElement('div')
      heading.className = 'changelog-version'
      heading.textContent = `v${release.version}  ·  ${release.date}`
      const list = document.createElement('ul')
      for (const note of release.notes) {
        const item = document.createElement('li')
        item.textContent = note
        list.append(item)
      }
      this.panel.append(heading, list)
    }
  }
}
