import { readFile } from 'node:fs/promises'

const manualSourceUrl = new URL('../../src/data/digital-twin/userManualContent.js', import.meta.url)

export async function loadUserManualContent() {
  const source = await readFile(manualSourceUrl, 'utf8')
  const encodedSource = Buffer.from(source).toString('base64')
  return import(`data:text/javascript;base64,${encodedSource}`)
}
