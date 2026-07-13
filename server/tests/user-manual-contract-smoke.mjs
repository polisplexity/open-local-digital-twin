import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { loadUserManualContent } from '../tools/load-user-manual-content.mjs'

const repoUrl = new URL('../../', import.meta.url)
const content = await loadUserManualContent()
const {
  euLdtToolIntegrations,
  externalModelCatalog,
  manualGlossary,
  manualReferenceDocuments,
  manualSections,
  manualStatusDefinitions,
  nativeCapabilities,
  operatingGuides,
} = content

const expectedTools = new Set([
  'integrated-environment',
  'identity-management',
  'data-platform',
  'play-visualise',
  'marketplace',
  'data-modeller',
  'data-space-ready',
  'city-innovation-planner',
  'use-case-scenarios',
  'ai-notebook',
  'participate',
  'federated-learning',
])

const expectedModels = new Set([
  'building-environmental-footprint',
  'energy-demand-forecasting',
  'renovation-strategies',
  'nevula',
  'police-routing',
  'urban-mobility',
  'pollution-propagation',
])

function assertUnique(items, field, label) {
  const values = items.map((item) => item[field])
  assert.equal(new Set(values).size, values.length, `${label} ${field} values must be unique`)
}

assert.equal(manualSections.length, 7, 'manual navigation must expose seven sections')
assert.equal(nativeCapabilities.length, 18, 'all native OLDT capability families must remain documented')
assert.equal(operatingGuides.length, 9, 'all accepted user procedures must remain documented')
assert.equal(euLdtToolIntegrations.length, 12, 'the official Toolbox inventory must contain 12 tools')
assert.equal(externalModelCatalog.length, 7, 'the external model catalogue must contain seven models')
assert.ok(manualGlossary.length >= 14, 'the manual glossary must retain its core operating language')

assertUnique(nativeCapabilities, 'key', 'native capabilities')
assertUnique(operatingGuides, 'key', 'operating guides')
assertUnique(euLdtToolIntegrations, 'key', 'Toolbox integrations')
assertUnique(externalModelCatalog, 'key', 'external models')

assert.deepEqual(new Set(euLdtToolIntegrations.map((item) => item.key)), expectedTools)
assert.deepEqual(new Set(externalModelCatalog.map((item) => item.key)), expectedModels)

nativeCapabilities.forEach((item) => {
  assert.ok(item.route.startsWith('/'), `${item.key} must link to an OLDT route`)
  assert.equal(item.status, 'native', `${item.key} must use the native status`)
  assert.ok(item.operation && item.output, `${item.key} must document operation and durable output`)
})

operatingGuides.forEach((guide) => {
  assert.ok(guide.steps.length >= 4, `${guide.key} must contain an actionable user flow`)
  assert.ok(guide.result && guide.caution, `${guide.key} must document result and boundary`)
})

euLdtToolIntegrations.forEach((integration) => {
  assert.ok(integration.repoUrl.startsWith('https://code.europa.eu/ldt-toolbox/'), `${integration.key} must link to the official repository namespace`)
  assert.ok(manualStatusDefinitions[integration.status], `${integration.key} uses an unknown status`)
  assert.ok(integration.userFlow.length >= 3, `${integration.key} must document a user flow`)
  assert.ok(integration.evidence && integration.boundary, `${integration.key} must distinguish evidence from boundary`)
})

externalModelCatalog.forEach((model) => {
  assert.ok(model.repoUrl.startsWith('https://code.europa.eu/ldt-toolbox/ai_models/'), `${model.key} must link to the official AI model namespace`)
  assert.ok(manualStatusDefinitions[model.status], `${model.key} uses an unknown status`)
  assert.ok(model.inputs && model.outputs && model.oldtFit && model.evidence, `${model.key} must document its complete contract`)
})

for (const reference of manualReferenceDocuments) {
  await access(new URL(reference.path, repoUrl))
}

const generatedManual = await readFile(new URL('docs/USER_MANUAL.md', repoUrl), 'utf8')
assert.match(generatedManual, /# OLDT User Manual/)
assert.match(generatedManual, /## Native OLDT Capabilities/)
assert.match(generatedManual, /## EU LDT Toolbox Integrations/)
assert.match(generatedManual, /### 12\. Federated Learning/)
assert.match(generatedManual, /### 7\. Pollution Propagation/)
assert.match(generatedManual, /recalculated from `\/api\/live\/current\/base`/)
assert.match(generatedManual, /\/docs\/reference\/user-manual/)

const docsPage = await readFile(new URL('src/app/(workspace layout)/docs/page.jsx', repoUrl), 'utf8')
const manualComponent = await readFile(new URL('src/components/twin-module/docs/OldtUserManual.jsx', repoUrl), 'utf8')
const referencePage = await readFile(new URL('src/app/(workspace layout)/docs/reference/[key]/page.jsx', repoUrl), 'utf8')
const cityContent = await readFile(new URL('src/data/digital-twin/cityTwinContent.js', repoUrl), 'utf8')
assert.match(docsPage, /OldtUserManual/)
assert.match(manualComponent, /\/api\/admin\/eu-ldt\/integrations/)
assert.match(manualComponent, /Open Markdown/)
assert.match(referencePage, /manualReferenceDocuments/)
assert.match(referencePage, /path\.relative\(docsRoot, documentPath\)/)
assert.match(referencePage, /Back to manual/)
assert.match(referencePage, /<pre>\{resolved\.markdown\}<\/pre>/)
assert.doesNotMatch(cityContent, /No context broker in the current prototype/)
assert.doesNotMatch(cityContent, /Internal JSON only/)

console.log(JSON.stringify({
  ok: true,
  sections: manualSections.length,
  nativeCapabilities: nativeCapabilities.length,
  procedures: operatingGuides.length,
  euLdtTools: euLdtToolIntegrations.length,
  externalModels: externalModelCatalog.length,
  references: manualReferenceDocuments.length,
}))
