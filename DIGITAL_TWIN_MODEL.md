# Twin Base Studio Digital Twin Model

## Purpose

This note separates:

- `base twin`
- `logical twin`
- `semantic layers`
- `data transport / interoperability`
- `services and scenarios`

The separation is necessary for product clarity and for alignment with `LDT4SSC WS2`.

## 1. Base Twin

The base twin is the minimum shared territorial canvas.

It contains:

- geometry
- identifiers
- coordinates
- basic observable attributes
- source provenance

For the current one-city Kharkiv demo, and for the preserved Ādaži
small-city validation case, the base twin includes:

- boundary
- roads
- buildings
- green-blue geometries
- place markers

These are mostly derived from public sources and normalized into a consistent city payload.

The base twin answers:

- what exists
- where it is
- how much of it we currently see

It does not yet answer:

- what it means operationally for a domain
- what service logic applies
- what policy, optimization, or intervention should happen

## 2. Logical Twin

The logical twin is the structured model that makes the base twin usable across systems.

It adds:

- stable entity grouping
- layer definitions
- shared identifiers
- relationships between entities
- inventory structure
- lifecycle and provenance logic
- visibility, bundles, and management logic

In practice, the current platform already has a logical layer because it organizes the city into reusable entities and layers instead of showing raw map data only.

Examples in the current implementation:

- `layerDefinitions`
- `inventory.totals`
- bundle/group logic
- scene payloads for map, 3D, and immersive
- layer counts and viewer state

This is the part that turns raw spatial data into a manageable LDT instance.

## 3. Semantic Layers

Semantic layers are not just more data. They assign domain meaning to the base/logical twin.

A semantic layer says:

- what a thing represents in a domain
- how it relates to operations
- how it should be interpreted by services and analytics

Current semantic or semi-semantic elements already present:

- `civic anchors`
- `mobility anchors`
- `daily economy`
- `waste and street seeds`
- access-seed corridors when generated from public/open data

These are already semantics because they classify and frame urban elements for a domain reading.

Important distinction:

- `base`: road geometry
- `semantic`: this road belongs to a collection corridor, service area, restricted zone, or priority route

- `base`: a point from OSM
- `semantic`: this point is a civic asset, waste hotspot, mobility node, WEO-derived water signal, or SAMI-derived operational entity

## 4. Data Transport / Interoperability Layer

This is different from the semantic layer.

Data transport / interoperability is the mechanism that lets data move, federate, and be reused across pilot members and systems.

For `LDT4SSC WS2`, this includes:

- semantic interoperability of exchanged data
- common data descriptions
- open standards such as `NGSI-LD`, `LDES`, `JSON-LD`, `RDF`
- data cataloguing with `DCAT`
- data management / context handling, for example a `context broker`
- federation / reuse / exchange across pilot members

In the production product this becomes a concrete `Interconnection and
Interoperability` module. It is responsible for catalog records, common-model
mappings, provider exchange contracts, context-broker adapters, and export
formats. It is not part of the internal command center and must not depend on
private proposal evidence, emails, transcripts, or AI-agent notes.

This layer answers:

- how data is described for exchange
- how the same meaning is preserved across systems
- how instances can federate or reuse each other’s outputs

It does not by itself define the domain meaning. It carries and preserves the meaning.

## 5. Services and Scenario Layer

On top of base + logical + semantics + interoperability, we build services.

Examples:

- municipal prioritisation service
- citizen information service
- route optimization
- hotspot prediction
- scenario comparison

This is where the twin becomes operational.

## 6. Current Public-Data City Twin Status

Current status should be described as:

- `base twin`: yes
- `logical twin`: yes, now backed by a standards-oriented PostGIS model
- `semantic layers`: partial and inferred from public/open data
- `data transport / interoperability`: partially implemented through standards
  projections and API contracts, not yet a full federation stack
- `services`: seed level only

So the honest framing is:

The current Twin Base Studio platform is a `public-data base twin with a
standards-oriented logical layer, early inferred semantic seeds, and first
interoperability/API projections`.

It is not yet a full domain-semantic operational twin.

## 6.1 Reality Check 2026-05-23

The implementation and documentation mostly agree on the product posture:

- the app exposes a `/cockpit` Workspace plus separate `/map`, `/municipal`,
  and `/public` visual surfaces
- PostGIS/Postgres is the runtime source of truth for application state and
  LDT city inventory; legacy JSON files are seed, mirror, cache, or export
  artifacts, not the production database
- the live payloads and viewer controls separate base geometry, provider
  evidence, inferred semantic seeds, semantic packs, and interoperability
  outputs
- the registry can still keep multiple cities for lab/demo comparison, but the
  product posture is one primary city per open-source installation
- auth protects cockpit, live viewers, live payloads, and admin routes
- the Kharkiv demo is the current primary city, and the Ādaži work is preserved
  as a reconstructable small-city validation dump

The implementation is still short of several documented ambitions:

- DCAT JSON-LD, NGSI-LD, OGC API Features, OpenAPI, and FIWARE adapter
  scaffolds exist, but RDF graph export, LDES, a real deployed context broker,
  and federation workflows are still pending
- semantic-pack scaffolding exists, including the first
  `reconstruction-service-core` pack, but no pack is authority-approved as an
  operational city service yet
- operational services are still seed-level and viewer-level, not complete
  production workflows
- predictive, prospective, or prescriptive scenario capability is not yet
  delivered as a service
- app-native API usage and operations metrics exist, but mature observability,
  route-family SLOs, and optional Prometheus/Grafana packaging remain pending
- inherited template app surfaces remain in the codebase and should not be
  confused with delivered Twin Base Studio product capability

The production-grade data backbone has moved past the old SQLite/JSON posture.
The runtime source of truth is PostgreSQL/PostGIS for auth, registry, city
inventory, provider layers, provenance, catalog records, standards projections,
semantic packs, viewer aggregates, query events, and share manifests. Viewer
payloads can still be JSON because that is the transport shape sent to
browsers, but those payloads should be generated from PostGIS when a usable
city record exists.

The correct external claim remains:

`Twin Base Studio currently demonstrates a PostGIS-backed public-data base
twin, consolidated city inventory, first semantic-query and TwinQL/CQL2
selection, standards/API projections, and inferred semantic-seed posture. It
does not yet deliver the full WS2 operational, brokered federation, authority
semantic-pack, or scenario-service stack.`

## 7. Product Rule

From now on, the UI and docs should separate information into:

### A. Base

- boundary
- roads
- buildings
- green-blue
- places

### B. Inferred semantic seeds

- civic anchors
- mobility anchors
- commerce anchors
- waste seeds
- route as service access seed

### C. Future semantic packs

- municipal waste semantics
- WEO semantics
- SAMI semantics
- satellite / EO semantics
- authority operational semantics

### D. Interoperability / transport

- shared model
- exchange standard
- catalog
- context broker / API
- federation path

### E. Provider layers

- flood, fire, satellite, IoT, BIM, mobility, waste, and public-works layers
- owner, source, license, access level, update method, and authority status
- validation and provenance before a layer becomes operational

## 8. Why This Matters for WS2

The pilot should not pretend that full semantics already exist.

The correct story is:

1. build a clean base and logical twin
2. add domain semantics during the pilot
3. connect those semantics to interoperable transport and common models
4. expose two services on top

This is consistent with the `WS2` direction:

- `Rq2`: technical and functional architecture plus the data lifecycle `from collection to use and sharing`
- `Rq13`: management and control across all seven LDT layers
- `Rq17`: semantic interoperability of exchanged data
- `Rc7`: a `DCAT` catalog and a data-management layer such as a context broker

The current local reference for those requirements is:

- `/home/hadox/cmd-center/orgs/polisplexity-ldt4ssc/workspace/open-call-2/official/text/ws2/cpmws2.pdf.txt`
- see around lines `1445-1446`, `1616-1619`, `1634`, and `1711-1715`

## 9. Immediate UI Consequence

The platform should explicitly mark:

- `Base layer`
- `Semantic seed`
- `Future semantic pack`
- `Interoperability / transport status`

This prevents confusion when later adding:

- WEO semantics
- SAMI semantics
- municipal operational data
- remote-sensing derived layers
