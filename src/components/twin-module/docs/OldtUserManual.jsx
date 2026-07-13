'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import classNames from 'classnames'
import { Badge, Button, Container, Form, Table } from 'react-bootstrap'
import SimpleBar from 'simplebar-react'
import {
  Activity,
  BookOpen,
  CheckCircle,
  ChevronRight,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  Grid,
  Layers,
  Search,
  Shield,
  Sliders,
  Users,
  X,
} from 'react-feather'
import DesktopFirstGate from '../DesktopFirstGate'
import TwinModuleHeader from '../TwinModuleHeader'
import {
  USER_MANUAL_LAST_REVIEWED,
  euLdtToolIntegrations,
  externalModelCatalog,
  manualGlossary,
  manualOverview,
  manualReferenceDocuments,
  manualSections,
  manualStatusDefinitions,
  nativeCapabilities,
  operatingGuides,
} from '@/data/digital-twin/userManualContent'

const sectionIcons = {
  start: BookOpen,
  native: Grid,
  procedures: Sliders,
  integrations: Layers,
  models: Cpu,
  city: Database,
  reference: FileText,
}

function normalizeSearch(value) {
  return String(value ?? '').trim().toLowerCase()
}

function matchesSearch(value, query) {
  if (!query) return true
  return JSON.stringify(value).toLowerCase().includes(query)
}

function statusDefinition(status) {
  return manualStatusDefinitions[status] ?? {
    label: status || 'Documented',
    tone: 'secondary',
    meaning: '',
  }
}

function ManualStatus({ status }) {
  const definition = statusDefinition(status)
  return <Badge bg={definition.tone}>{definition.label}</Badge>
}

function RouteLink({ href, children }) {
  if (!href) return null
  return (
    <Link className="dt-manual-route" href={href}>
      {children || href}
      <ChevronRight size={13} />
    </Link>
  )
}

function ExternalRoute({ href, children, className, title }) {
  if (!href) return null
  return (
    <a
      className={classNames('dt-manual-external', className)}
      href={href}
      rel="noreferrer"
      target="_blank"
      title={title}
    >
      {children || href}
      <ExternalLink size={13} />
    </a>
  )
}

function EmptyManualResult() {
  return (
    <div className="dt-manual-empty">
      <Search size={20} />
      <strong>No manual entries match this search.</strong>
      <span>Clear the search or choose another manual section.</span>
    </div>
  )
}

function ManualSidebar({ activeSection, onSelect, sectionCounts }) {
  return (
    <nav className="invoiceapp-sidebar dt-control-sidebar dt-manual-sidebar" aria-label="User manual sections">
      <SimpleBar className="nicescroll-bar">
        <div className="menu-content-wrap">
          <div className="nav-header">
            <span>OLDT user manual</span>
          </div>
          <div className="dt-sidebar-copy">
            <p>Native operation, external integrations, model evidence, and current-city references.</p>
            <small>Reviewed {USER_MANUAL_LAST_REVIEWED}</small>
          </div>
          <div className="menu-gap" />
          <div className="nav-header">
            <span>Contents</span>
          </div>
          <div className="dt-manual-sidebar__list">
            {manualSections.map((section) => {
              const Icon = sectionIcons[section.key] ?? FileText
              const active = activeSection === section.key
              return (
                <button
                  className={classNames('dt-manual-sidebar__item', { 'is-active': active })}
                  key={section.key}
                  onClick={() => onSelect(section.key)}
                  type="button"
                >
                  <Icon size={15} />
                  <span>{section.label}</span>
                  <em>{sectionCounts[section.key] ?? 0}</em>
                </button>
              )
            })}
          </div>
        </div>
      </SimpleBar>
    </nav>
  )
}

function SectionLead({ eyebrow, title, body, actions }) {
  return (
    <div className="dt-manual-section__lead">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        {body ? <p>{body}</p> : null}
      </div>
      {actions ? <div className="dt-manual-section__actions">{actions}</div> : null}
    </div>
  )
}

function StartSection() {
  return (
    <div className="dt-manual-section">
      <SectionLead
        body={manualOverview.summary}
        eyebrow="Operating model"
        title={manualOverview.title}
      />

      <div className="dt-manual-metrics">
        {manualOverview.inventory.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </div>
        ))}
      </div>

      <section className="dt-manual-band">
        <div className="dt-manual-band__head">
          <Shield size={18} />
          <div>
            <h3>Product rules</h3>
            <p>These rules apply to every native module and external workflow.</p>
          </div>
        </div>
        <div className="dt-manual-card-grid">
          {manualOverview.principles.map((principle) => (
            <article className="dt-manual-card" key={principle.title}>
              <CheckCircle size={16} />
              <h4>{principle.title}</h4>
              <p>{principle.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dt-manual-band">
        <div className="dt-manual-band__head">
          <Users size={18} />
          <div>
            <h3>Who does what</h3>
            <p>One person may hold several roles in a small municipal deployment.</p>
          </div>
        </div>
        <div className="dt-manual-card-grid">
          {manualOverview.roles.map((role) => (
            <article className="dt-manual-card" key={role.title}>
              <h4>{role.title}</h4>
              <p>{role.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dt-manual-band">
        <div className="dt-manual-band__head">
          <Activity size={18} />
          <div>
            <h3>Evidence language</h3>
            <p>Status labels describe what was actually proven.</p>
          </div>
        </div>
        <div className="dt-manual-status-grid">
          {Object.entries(manualStatusDefinitions).map(([key, definition]) => (
            <div key={key}>
              <ManualStatus status={key} />
              <p>{definition.meaning}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function NativeSection({ query }) {
  const rows = nativeCapabilities.filter((item) => matchesSearch(item, query))
  return (
    <div className="dt-manual-section">
      <SectionLead
        body="These functions remain part of OLDT whether or not an EU LDT Toolbox deployment is connected."
        eyebrow="Product surface"
        title="Native OLDT capabilities"
      />
      {!rows.length ? <EmptyManualResult /> : (
        <div className="dt-manual-table-wrap">
          <Table className="dt-manual-table" hover responsive>
            <thead>
              <tr>
                <th>Capability</th>
                <th>User operation</th>
                <th>Durable result</th>
                <th>Surface</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.key}>
                  <td>
                    <small>{item.area}</small>
                    <strong>{item.title}</strong>
                    <ManualStatus status={item.status} />
                  </td>
                  <td>{item.operation}</td>
                  <td>{item.output}</td>
                  <td><RouteLink href={item.route} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  )
}

function ProceduresSection({ query }) {
  const guides = operatingGuides.filter((guide) => matchesSearch(guide, query))
  return (
    <div className="dt-manual-section">
      <SectionLead
        body="Each procedure names the responsible role, the exact OLDT surface, the expected result, and the boundary that must remain visible."
        eyebrow="User workflows"
        title="Operating procedures"
      />
      {!guides.length ? <EmptyManualResult /> : (
        <div className="dt-manual-procedures">
          {guides.map((guide, guideIndex) => (
            <article className="dt-manual-procedure" key={guide.key}>
              <header>
                <span>{String(guideIndex + 1).padStart(2, '0')}</span>
                <div>
                  <small>{guide.audience}</small>
                  <h3>{guide.title}</h3>
                  <p>{guide.purpose}</p>
                </div>
                <RouteLink href={guide.route} />
              </header>
              <ol>
                {guide.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
              <footer>
                <div>
                  <strong>Expected result</strong>
                  <span>{guide.result}</span>
                </div>
                <div>
                  <strong>Do not hide</strong>
                  <span>{guide.caution}</span>
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function profileMatchesIntegration(profile, integration) {
  return integration.profileKinds.includes(profile.platformKind)
}

function IntegrationProfileState({ integration, profiles, profilesAvailable }) {
  if (!integration.profileKinds.length) return <span className="dt-manual-profile-state">No OLDT endpoint profile</span>
  if (!profilesAvailable) return <span className="dt-manual-profile-state">Live profile requires operator access</span>
  const matches = profiles.filter((profile) => profileMatchesIntegration(profile, integration))
  if (!matches.length) return <Badge bg="secondary">No live profile</Badge>
  const validated = matches.filter((profile) => profile.status === 'validated').length
  return (
    <Badge bg={validated === matches.length ? 'success' : 'warning'}>
      {validated}/{matches.length} live profiles validated
    </Badge>
  )
}

function IntegrationsSection({ profiles, profilesAvailable, query }) {
  const integrations = euLdtToolIntegrations.filter((item) => matchesSearch(item, query))
  return (
    <div className="dt-manual-section">
      <SectionLead
        body="The official inventory has 12 tools. AI Notebook is one tool with Kubeflow and GitLab entry points. Static acceptance status and current profile health are shown separately."
        eyebrow="External ecosystem"
        title="EU LDT Toolbox integrations"
        actions={<RouteLink href="/operations/eu-ldt">Open profile registry</RouteLink>}
      />
      {!integrations.length ? <EmptyManualResult /> : (
        <div className="dt-manual-integrations">
          {integrations.map((integration, index) => (
            <details className="dt-manual-integration" key={integration.key} open={index === 0 && !query}>
              <summary>
                <div className="dt-manual-integration__index">{String(index + 1).padStart(2, '0')}</div>
                <div className="dt-manual-integration__summary">
                  <strong>{integration.name}</strong>
                  <span>{integration.purpose}</span>
                </div>
                <div className="dt-manual-integration__status">
                  <ManualStatus status={integration.status} />
                  <IntegrationProfileState
                    integration={integration}
                    profiles={profiles}
                    profilesAvailable={profilesAvailable}
                  />
                </div>
              </summary>
              <div className="dt-manual-integration__body">
                <div className="dt-manual-integration__links">
                  <ExternalRoute href={integration.localUrl}>Open local surface</ExternalRoute>
                  <ExternalRoute href={integration.repoUrl}>Official repository</ExternalRoute>
                </div>
                <div className="dt-manual-flow-grid">
                  <div>
                    <span>OLDT role</span>
                    <p>{integration.oldtRole}</p>
                  </div>
                  <div>
                    <span>OLDT sends</span>
                    <p>{integration.sends}</p>
                  </div>
                  <div>
                    <span>OLDT receives</span>
                    <p>{integration.receives}</p>
                  </div>
                </div>
                <div className="dt-manual-integration__columns">
                  <div>
                    <h4>User flow</h4>
                    <ol>
                      {integration.userFlow.map((step) => <li key={step}>{step}</li>)}
                    </ol>
                  </div>
                  <div>
                    <h4>Accepted evidence</h4>
                    <p>{integration.evidence}</p>
                    <h4>Boundary</h4>
                    <p>{integration.boundary}</p>
                  </div>
                </div>
                {integration.docs.length ? (
                  <div className="dt-manual-doc-links">
                    {integration.docs.map((document) => <code key={document}>{document}</code>)}
                  </div>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

function ModelsSection({ query }) {
  const models = externalModelCatalog.filter((model) => matchesSearch(model, query))
  return (
    <div className="dt-manual-section">
      <SectionLead
        body="Models are not Toolbox applications. Their status describes execution and OLDT persistence separately, and none of the lab evidence is presented as municipal authority data."
        eyebrow="AI model catalogue"
        title="Seven external models reviewed"
      />
      {!models.length ? <EmptyManualResult /> : (
        <div className="dt-manual-model-grid">
          {models.map((model, index) => (
            <article className="dt-manual-model" key={model.key}>
              <header>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{model.name}</h3>
                  <p>{model.engine}</p>
                </div>
                <ManualStatus status={model.status} />
              </header>
              <dl>
                <div>
                  <dt>Observation subject</dt>
                  <dd>{model.subject}</dd>
                </div>
                <div>
                  <dt>Inputs</dt>
                  <dd>{model.inputs}</dd>
                </div>
                <div>
                  <dt>Outputs</dt>
                  <dd>{model.outputs}</dd>
                </div>
                <div>
                  <dt>OLDT fit</dt>
                  <dd>{model.oldtFit}</dd>
                </div>
                <div>
                  <dt>Evidence boundary</dt>
                  <dd>{model.evidence}</dd>
                </div>
              </dl>
              <ExternalRoute href={model.repoUrl}>Official repository</ExternalRoute>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function EvidenceTable({ columns, rows, title }) {
  if (!rows?.length) return null
  return (
    <section className="dt-manual-evidence-table">
      <h3>{title}</h3>
      <div className="dt-manual-table-wrap">
        <Table className="dt-manual-table" hover responsive>
          <thead>
            <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id || row.key || `${title}-${index}`}>
                {columns.map((column) => <td key={`${column}-${index}`}>{row[column] ?? 'Not declared'}</td>)}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </section>
  )
}

function CityEvidenceSection({ cityEvidence }) {
  return (
    <div className="dt-manual-section">
      <SectionLead
        body={`This section separates what is calculated from the active ${cityEvidence.workspaceLabel} payload from reusable OLDT reference material. It is an inventory and readiness view, not a KPI score.`}
        eyebrow="Active workspace"
        title={`Active city data: ${cityEvidence.cityLabel}`}
      />
      <div className="dt-manual-flow-grid">
        <div>
          <span>Live per city</span>
          <p>Territorial area, streets, road geometry, buildings, heights, semantic-seed counts, and available layer definitions are recalculated from <code>/api/live/current/base</code>.</p>
        </div>
        <div>
          <span>Contextualized per city</span>
          <p>City name, workspace label, source descriptions, and fallback layer descriptions use the active city registry entry when a live field is unavailable.</p>
        </div>
        <div>
          <span>Shared OLDT reference</span>
          <p>Viewer contracts, semantic categories, interoperability posture, future packs, and EU LDT alignment describe the product and remain common until a city-specific override exists.</p>
        </div>
      </div>
      <div className="dt-manual-city-summary">
        <strong>{cityEvidence.tagline}</strong>
        <span>{cityEvidence.summary}</span>
      </div>
      <div className="dt-manual-metrics dt-manual-metrics--city">
        {cityEvidence.stats.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </div>
        ))}
      </div>
      <EvidenceTable
        columns={['Source', 'Category', 'Scope', 'Status']}
        rows={cityEvidence.sources}
        title="Current source and derivation register"
      />
      <EvidenceTable
        columns={['Layer', 'Type', 'Count', 'Source', 'Status', 'Reading']}
        rows={cityEvidence.layers}
        title="Current layer taxonomy"
      />
      <EvidenceTable
        columns={['Surface', 'Base twin shown', 'Logical twin shown', 'Semantic seeds shown', 'Transport posture']}
        rows={cityEvidence.viewers}
        title="Viewer surface register"
      />
      <EvidenceTable
        columns={['Seed', 'Current basis', 'Current meaning', 'Future enrichment']}
        rows={cityEvidence.semanticSeeds}
        title="Current semantic seed register"
      />
      <EvidenceTable
        columns={['Topic', 'Current status', 'What exists now', 'Next step']}
        rows={cityEvidence.interoperability}
        title="Interoperability and transport register"
      />
      <EvidenceTable
        columns={['Pack', 'What it adds', 'Probable inputs']}
        rows={cityEvidence.futurePacks}
        title="Future semantic pack roadmap"
      />
      <EvidenceTable
        columns={['Requirement', 'Manual expectation', 'Current platform posture']}
        rows={cityEvidence.ws2}
        title="EU LDT pilot alignment"
      />
    </div>
  )
}

function ReferenceSection({ documentPack, query }) {
  const references = manualReferenceDocuments.filter((item) => matchesSearch(item, query))
  const glossary = manualGlossary.filter((item) => matchesSearch(item, query))
  const documents = (documentPack ?? []).filter((item) => matchesSearch(item, query))
  return (
    <div className="dt-manual-section">
      <SectionLead
        body="These paths are relative to the OLDT installation root. Use Open Markdown to read the exact allowlisted source in a protected browser tab; the files remain the detailed architecture and acceptance evidence layer."
        eyebrow="Maintainer map"
        title="Reference documents and glossary"
      />

      {references.length ? (
        <section className="dt-manual-reference-list">
          <h3>Technical references</h3>
          {references.map((reference) => (
            <div key={reference.key}>
              <code>{reference.path}</code>
              <span>{reference.purpose}</span>
              <ExternalRoute
                className="dt-manual-reference-open"
                href={`/docs/reference/${reference.key}`}
                title={`Open ${reference.path}`}
              >
                Open Markdown
              </ExternalRoute>
            </div>
          ))}
        </section>
      ) : null}

      {documents.length ? (
        <section className="dt-manual-reference-list">
          <h3>Institutional document pack</h3>
          {documents.map((document) => (
            <div key={document.title}>
              <strong>{document.title}</strong>
              <span>{document.type}: {document.description}</span>
            </div>
          ))}
        </section>
      ) : null}

      {glossary.length ? (
        <section className="dt-manual-glossary">
          <h3>Glossary</h3>
          <dl>
            {glossary.map((entry) => (
              <div key={entry.term}>
                <dt>{entry.term}</dt>
                <dd>{entry.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {!references.length && !documents.length && !glossary.length ? <EmptyManualResult /> : null}
    </div>
  )
}

export default function OldtUserManual({ config, cityEvidence, documentPack }) {
  const [activeSection, setActiveSection] = useState('start')
  const [showSidebar, setShowSidebar] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [profiles, setProfiles] = useState([])
  const [profilesAvailable, setProfilesAvailable] = useState(false)
  const query = useMemo(() => normalizeSearch(searchText), [searchText])

  useEffect(() => {
    let ignore = false
    fetch('/api/admin/eu-ldt/integrations', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP_${response.status}`)
        return response.json()
      })
      .then((body) => {
        if (ignore) return
        setProfiles(Array.isArray(body.profiles) ? body.profiles : [])
        setProfilesAvailable(true)
      })
      .catch(() => {
        if (!ignore) setProfilesAvailable(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  const sectionCounts = useMemo(() => ({
    start: manualOverview.principles.length + manualOverview.roles.length,
    native: nativeCapabilities.length,
    procedures: operatingGuides.length,
    integrations: euLdtToolIntegrations.length,
    models: externalModelCatalog.length,
    city:
      cityEvidence.sources.length +
      cityEvidence.layers.length +
      cityEvidence.semanticSeeds.length +
      cityEvidence.interoperability.length,
    reference: manualReferenceDocuments.length + manualGlossary.length,
  }), [
    cityEvidence.interoperability.length,
    cityEvidence.layers.length,
    cityEvidence.semanticSeeds.length,
    cityEvidence.sources.length,
  ])

  const section = (() => {
    if (activeSection === 'native') return <NativeSection query={query} />
    if (activeSection === 'procedures') return <ProceduresSection query={query} />
    if (activeSection === 'integrations') {
      return (
        <IntegrationsSection
          profiles={profiles}
          profilesAvailable={profilesAvailable}
          query={query}
        />
      )
    }
    if (activeSection === 'models') return <ModelsSection query={query} />
    if (activeSection === 'city') return <CityEvidenceSection cityEvidence={cityEvidence} />
    if (activeSection === 'reference') return <ReferenceSection documentPack={documentPack} query={query} />
    return <StartSection />
  })()

  return (
    <div className="hk-pg-body py-0">
      <DesktopFirstGate
        description="Use a desktop browser to navigate the complete OLDT user manual and its evidence tables."
        surfaceName={config.title}
      />
      <div className={classNames('invoiceapp-wrap', 'dt-module-wrap', 'dt-manual-wrap', { 'invoiceapp-sidebar-toggle': !showSidebar })}>
        <ManualSidebar
          activeSection={activeSection}
          onSelect={setActiveSection}
          sectionCounts={sectionCounts}
        />
        <div className="invoiceapp-content">
          <div className="invoiceapp-detail-wrap">
            <TwinModuleHeader
              eyebrow={config.eyebrow}
              onToggleSidebar={() => setShowSidebar((current) => !current)}
              sidebarOpen={showSidebar}
              statusLabel={`Reviewed ${USER_MANUAL_LAST_REVIEWED}`}
              summary={config.summary}
              title={config.title}
            />
            <Container fluid="xxl" className="dt-manual py-4">
              <div className="dt-manual-toolbar">
                <div className="dt-manual-toolbar__search">
                  <Search size={16} />
                  <Form.Control
                    aria-label="Search the OLDT user manual"
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search capabilities, workflows, tools, models, or references"
                    type="search"
                    value={searchText}
                  />
                  {searchText ? (
                    <Button
                      aria-label="Clear manual search"
                      className="btn-icon"
                      onClick={() => setSearchText('')}
                      title="Clear search"
                      variant="link"
                    >
                      <X size={15} />
                    </Button>
                  ) : null}
                </div>
                <div className="dt-manual-toolbar__section">
                  <span>Section</span>
                  <strong>{manualSections.find((item) => item.key === activeSection)?.label}</strong>
                </div>
              </div>
              {section}
            </Container>
          </div>
        </div>
      </div>
    </div>
  )
}
