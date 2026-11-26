import fs from 'fs'
import { execSync } from 'child_process'

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
const rawArg = (process.argv[2] || '').trim()
const version = rawArg ? rawArg.replace(/^v/i, '') : String(pkg.version || '').trim()

if (!version) {
  console.error('Missing version/tag argument and package.json version')
  process.exit(1)
}

if (process.env.VERIFY_TAG_VERSION === 'true' && pkg.version !== version) {
  console.error(`Tag version (${version}) does not match package.json version (${pkg.version})`)
  process.exit(1)
}

const changelog = fs.readFileSync('CHANGELOG.md', 'utf-8')
const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const headingRegex = new RegExp(`^## \\[${escapedVersion}\\](?:\\s+-\\s+.*)?$`, 'm')
const match = headingRegex.exec(changelog)

let notes = ''
if (match) {
  const afterHeading = changelog.slice(match.index + match[0].length)
  // 截取到下一个版本标题或文末参考链接定义为止
  const stopMatch = /^(?:## \[|\[[^\]]+\]:\s+https?:\/\/)/m.exec(afterHeading)
  const section = stopMatch ? afterHeading.slice(0, stopMatch.index) : afterHeading
  notes = section.trim()
}

if (!notes) {
  console.warn(`No section found for [${version}] in CHANGELOG.md, falling back to git log`)
  notes = execSync('git log -n 20 --pretty=format:"- %s"', { encoding: 'utf-8' }).trim()
}

fs.writeFileSync('release-notes.md', `${notes}\n`, 'utf-8')
console.log(`Extracted release notes for v${version} (${notes.length} chars)`)
