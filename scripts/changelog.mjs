#!/usr/bin/env node
// Regenerates CHANGELOG.md from the annotated git tags, so the changelog can
// never drift from what was actually released. Write the release notes once,
// in the tag; this renders them.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

const RELEASES = 'https://github.com/Maggot-ciso/garage/releases'

// Newest first, sorted by version rather than creation order.
const tags = git('tag', '--sort=-v:refname').split('\n').filter((t) => /^v\d/.test(t))

const sections = tags.map((tag) => {
  const body = git('tag', '-l', '--format=%(contents)', tag)
  const [first, ...rest] = body.split('\n')
  const headline = first.includes('—') ? first.split('—').slice(1).join('—').trim() : first.trim()
  const date = git('log', '-1', '--format=%ad', '--date=short', tag)
  const notes = rest.join('\n').trim()
  return `## ${tag}${headline ? ` — ${headline}` : ''}\n_${date}_\n\n${notes}\n`
})

writeFileSync(
  'CHANGELOG.md',
  `# Changelog

Every release of GarageBook. Versions follow [semantic versioning](https://semver.org):
the middle number changes when a feature lands, the last when something is fixed.

Downloads are on the [releases page](${RELEASES}).

${sections.join('\n')}`,
)
console.log(`CHANGELOG.md — ${tags.length} releases`)
