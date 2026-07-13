import { writeFile } from 'node:fs/promises'
import { loadUserManualContent } from './load-user-manual-content.mjs'

const outputUrl = new URL('../../docs/USER_MANUAL.md', import.meta.url)

function cleanCell(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim()
}

function markdownTable(headers, rows) {
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
  ]
  rows.forEach((row) => {
    lines.push(`| ${row.map(cleanCell).join(' | ')} |`)
  })
  return lines.join('\n')
}

function orderedSteps(steps) {
  return steps.map((step, index) => `${index + 1}. ${step}`).join('\n')
}

function documentLinks(paths) {
  if (!paths.length) return 'No dedicated OLDT evidence document yet.'
  return paths.map((path) => `\`${path}\``).join(', ')
}

const content = await loadUserManualContent()
const {
  USER_MANUAL_LAST_REVIEWED,
  euLdtToolIntegrations,
  externalModelCatalog,
  manualGlossary,
  manualOverview,
  manualReferenceDocuments,
  manualStatusDefinitions,
  nativeCapabilities,
  operatingGuides,
} = content

const lines = [
  '# OLDT User Manual',
  '',
  '> Generated from `src/data/digital-twin/userManualContent.js`. Edit the structured source and regenerate this file; do not maintain two competing manuals.',
  '',
  `Reviewed: ${USER_MANUAL_LAST_REVIEWED}`,
  '',
  'The interactive version is available inside OLDT at `/docs`.',
  '',
  '## Operating Model',
  '',
  `**${manualOverview.title}**`,
  '',
  manualOverview.summary,
  '',
  '### Product Rules',
  '',
]

manualOverview.principles.forEach((principle) => {
  lines.push(`- **${principle.title}:** ${principle.body}`)
})

lines.push('', '### User Roles', '')
manualOverview.roles.forEach((role) => {
  lines.push(`- **${role.title}:** ${role.body}`)
})

lines.push('', '### Evidence Language', '')
Object.values(manualStatusDefinitions).forEach((definition) => {
  lines.push(`- **${definition.label}:** ${definition.meaning}`)
})

lines.push(
  '',
  '## Native OLDT Capabilities',
  '',
  'These capabilities remain available without an EU LDT Toolbox deployment.',
  '',
  markdownTable(
    ['Area', 'Capability', 'User operation', 'Durable result', 'Surface'],
    nativeCapabilities.map((item) => [item.area, item.title, item.operation, item.output, `\`${item.route}\``]),
  ),
  '',
  '## Operating Procedures',
  '',
)

operatingGuides.forEach((guide, index) => {
  lines.push(
    `### ${index + 1}. ${guide.title}`,
    '',
    `**Responsible role:** ${guide.audience}`,
    '',
    `**OLDT surface:** \`${guide.route}\``,
    '',
    guide.purpose,
    '',
    orderedSteps(guide.steps),
    '',
    `**Expected result:** ${guide.result}`,
    '',
    `**Do not hide:** ${guide.caution}`,
    '',
  )
})

lines.push(
  '## EU LDT Toolbox Integrations',
  '',
  'The official inventory contains 12 tools. AI Notebook is one tool with Kubeflow and GitLab surfaces. Profile health, laboratory acceptance, and production authority approval are separate states.',
  '',
)

euLdtToolIntegrations.forEach((integration, index) => {
  const status = manualStatusDefinitions[integration.status]
  lines.push(
    `### ${index + 1}. ${integration.name}`,
    '',
    `**Status:** ${status?.label ?? integration.status}`,
    '',
    `**Purpose:** ${integration.purpose}`,
    '',
    `**OLDT role:** ${integration.oldtRole}`,
    '',
    `**OLDT sends:** ${integration.sends}`,
    '',
    `**OLDT receives:** ${integration.receives}`,
    '',
    `**Local laboratory surface:** ${integration.localUrl}`,
    '',
    `**Official repository:** ${integration.repoUrl}`,
    '',
    '**User flow:**',
    '',
    orderedSteps(integration.userFlow),
    '',
    `**Accepted evidence:** ${integration.evidence}`,
    '',
    `**Boundary:** ${integration.boundary}`,
    '',
    `**Evidence documents:** ${documentLinks(integration.docs)}`,
    '',
  )
})

lines.push(
  '## External AI Models',
  '',
  'Models are tracked separately from Toolbox applications. A model execution smoke test is not presented as a production OLDT integration or as municipal authority data.',
  '',
)

externalModelCatalog.forEach((model, index) => {
  const status = manualStatusDefinitions[model.status]
  lines.push(
    `### ${index + 1}. ${model.name}`,
    '',
    `**Status:** ${status?.label ?? model.status}`,
    '',
    `**Engine:** ${model.engine}`,
    '',
    `**Observation subject:** ${model.subject}`,
    '',
    `**Inputs:** ${model.inputs}`,
    '',
    `**Outputs:** ${model.outputs}`,
    '',
    `**OLDT fit:** ${model.oldtFit}`,
    '',
    `**Evidence boundary:** ${model.evidence}`,
    '',
    `**Official repository:** ${model.repoUrl}`,
    '',
  )
})

lines.push(
  '## Active City Evidence',
  '',
  'The in-product `/docs` page separates three kinds of evidence. Territorial metrics, geometry counts, semantic-seed counts, and live layer definitions are recalculated from `/api/live/current/base` for the active city. Names, source descriptions, and fallback layer descriptions are contextualized from the active city registry. Viewer contracts, semantic categories, interoperability posture, future packs, and EU pilot alignment are shared OLDT references until a city-specific override exists. This section is an inventory and readiness view, not a KPI score.',
  '',
  '## Reference Documents',
  '',
  'Paths are relative to the OLDT installation root. In the product, each allowlisted file can be opened through `/docs/reference/<key>` after authentication.',
  '',
  markdownTable(
    ['Document', 'Purpose', 'In-product reader'],
    manualReferenceDocuments.map((item) => [`\`${item.path}\``, item.purpose, `\`/docs/reference/${item.key}\``]),
  ),
  '',
  '## Glossary',
  '',
)

manualGlossary.forEach((entry) => {
  lines.push(`- **${entry.term}:** ${entry.meaning}`)
})

await writeFile(outputUrl, `${lines.join('\n')}\n`, 'utf8')
console.log(`Generated ${outputUrl.pathname}`)
