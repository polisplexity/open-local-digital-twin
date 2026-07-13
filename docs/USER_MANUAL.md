# OLDT User Manual

> Generated from `src/data/digital-twin/userManualContent.js`. Edit the structured source and regenerate this file; do not maintain two competing manuals.

Reviewed: 2026-07-13

The interactive version is available inside OLDT at `/docs`.

## Operating Model

**Operate OLDT as the city system of record, then add external capabilities deliberately.**

OLDT keeps canonical city entities, governed indicators, saved analytical selections, simulation worlds, provenance, and visual surfaces in one PostGIS-backed product. EU LDT tools are optional profiles and workflows around that core.

### Product Rules

- **Standalone by default:** Local authentication, PostGIS, queries, viewers, standards, and controlled workflows remain usable when an external integration is disabled or unreachable.
- **One canonical city truth:** External model output is evidence until it is mapped, validated, and promoted. Simulations never silently overwrite current city geometry or official observations.
- **Profiles select the target:** Data Platform, Play, Marketplace, Data Modeller, Data Space Ready, CIP, and UCS targets are selected by profile key. URLs and credentials are instance configuration, not hardcoded product behavior.
- **Every exchange leaves evidence:** Workflow runs, approvals, artifacts, external IDs, checksums, source records, model versions, timestamps, and authority status are retained for audit and replay.

### User Roles

- **City analyst:** Queries physical or contextual subjects, saves selections, inspects maps, and compares current and simulated worlds.
- **Operator:** Configures profiles, tests connectivity, creates workflow runs, approves checkpoints, and reviews trace evidence.
- **Data or model engineer:** Prepares source packages, schemas, model inputs, inference services, Data Factory jobs, and result contracts.
- **Reviewer:** Checks provenance, validation state, authority posture, standards publication, and known limitations before reuse.

### Evidence Language

- **Native:** Delivered by OLDT without requiring an external Toolbox service.
- **End-to-end verified:** A real operation crossed the integration boundary, returned, and left durable evidence.
- **Integrated in lab:** The OLDT adapter and a bounded laboratory cycle passed; the output is not municipal authority data.
- **Model execution verified:** The model executed with a direct or KServe smoke payload, but it is not a production OLDT service.
- **Evaluated:** Code, runtime, or installation contract was reviewed without claiming an OLDT round trip.
- **Future integration:** The fit is documented, but no direct OLDT operating cycle is accepted yet.

## Native OLDT Capabilities

These capabilities remain available without an EU LDT Toolbox deployment.

| Area | Capability | User operation | Durable result | Surface |
| --- | --- | --- | --- | --- |
| Access | Standalone and organization login | Choose the workspace city and sign in with a local account or a configured OIDC provider. | A city-scoped authenticated session. External identity is optional. | `/auth/login` |
| Workspace | City cockpit | Review city readiness, inventory counts, gaps, recent controlled runs, and direct links to specialist surfaces. | A compact operational baseline for the active city. | `/cockpit` |
| Workspace | Inventory and source evidence | Inspect canonical entities, source records, authority posture, analysis models, and semantic packs. | A traceable view of what exists, where it came from, and what remains inferred or incomplete. | `/workspace` |
| Visual analysis | Analytical Map | Run a city-object or contextual query and inspect the result in MapLibre with query-scoped geometry. | Map result, selected-object context, query event, and optional saved selection. | `/analytical-map` |
| Visual analysis | City 3D | Inspect the same query selection in Cesium, including footprints, heights, attached provider assets, and generated 3D Tiles packages. | A spatial inspection surface that preserves the query and entity identity. | `/city-3d` |
| Visual analysis | Civic XR | Present the active query and public-realm context in a lightweight browser XR scene. | An explainable civic scene over the same source entities and semantic context. | `/civic-xr` |
| Queries | TwinQL visual builder | Combine semantic classes, physical properties, model outputs, indicators, spatial scopes, unions, ordering, and limits. | Parameterized PostGIS execution over the allowlisted city-object view. | `/analytical-map` |
| Queries | Read-only expert SQL | Run advanced read-only SQL when the Builder cannot express the required joins or calculations. | A governed map or table result without write privileges or arbitrary database access. | `/analytical-map` |
| Queries | Contextual subject query | Query city, area, cohort, organization, policy, flow, or physical subjects at the observation grain that actually owns the data. | A result manifest selecting map, chart, relationship summary, or table transport. | `/analytical-map` |
| Queries | Saved selections and portable questions | Save a query snapshot, replay it later, publish a viewer passport, or store a portable subject-query blueprint. | Versioned selection members, query hash, style, counts, semantic context, and city binding. | `/analytical-map` |
| Scenarios | Canvas world comparison | Open saved reality snapshots and simulation worlds, then compare, overlay, filter, color, mask, or calculate baseline/intervention deltas. | A full-screen analytical composition without promoting simulated values into current reality. | `/fragment-visualizer` |
| Indicators | Provider-neutral indicator framework | Review catalogs, formulas, evidence requirements, observation grain, thresholds, validation results, and current values. | Queryable indicator observations in ldt_science with explicit validation and authority status. | `/standards` |
| Interoperability | Standards and exports | Publish or inspect NGSI-LD, OGC API Features, DCAT, OpenAPI, model-output CSV, provenance, and indicator contracts. | Machine-readable city data and evidence without coupling consumers to the OLDT database. | `/standards` |
| Models | External model output persistence | Import model results with entity IDs, model/version, source artifact, generated time, confidence, and authority posture. | Append-only model evidence plus governed indicator materialization when an approved mapping exists. | `/standards` |
| Operations | API, telemetry, jobs, and compliance | Inspect the API catalog, usage events, metrics, ingestion jobs, provider readiness, workflow state, and LDT compliance. | An operator view of what is active, failing, controlled, or awaiting approval. | `/operations` |
| Operations | Approval-gated workflows | Create a run from a versioned contract, review resolved inputs, approve checkpoints, execute steps, and inspect artifacts. | A durable workflow run with trace, approvals, external IDs, artifacts, and failure isolation. | `/operations/workflows` |
| Operations | Provider-neutral Data Factory | Register local, remote, offline, HPC, or cloud processing nodes; dispatch bounded city packages; import and promote checked results. | Checksummed artifacts, processing-node evidence, result validation, and explicit promotion decisions. | `/operations/ingestion` |
| Operations | Configurable external targets | Register multiple instances, city mappings, auth modes, private runtime URLs, public UI URLs, capabilities, and connectivity checks. | A selected target profile for each exchange; no external endpoint is fixed in product code. | `/operations/eu-ldt` |

## Operating Procedures

### 1. Enter a city workspace

**Responsible role:** All users

**OLDT surface:** `/auth/login`

Open the correct municipal context without making external identity a startup dependency.

1. Select the workspace city shown in the login form.
2. Use the local sign-in form, or choose the configured organization identity provider.
3. After redirect, verify the active city name in the application header.
4. Open Cockpit and confirm that the expected inventory and readiness baseline is visible.

**Expected result:** The session is scoped to one city and carries the roles required by its routes.

**Do not hide:** An external OIDC failure must not remove the local standalone login path.

### 2. Read the current city truth

**Responsible role:** City analyst or reviewer

**OLDT surface:** `/workspace`

Distinguish canonical physical entities, source evidence, inferred semantics, indicators, and external outputs.

1. Start in Cockpit for the compact city baseline and open gaps.
2. Open Workspace and review Inventory before using any analysis result.
3. Review Sources to confirm provider, license, update time, and authority posture.
4. Review Analysis and Semantic Packs to see formulas, caveats, rules, and missing source requirements.
5. Use Standards when a downstream consumer needs a machine-readable contract.

**Expected result:** The analyst knows which records are current city evidence and which are inferred, simulated, or pending review.

**Do not hide:** Visible geometry is not automatically official geometry, and a calculated value is not automatically an approved KPI.

### 3. Build and save a complex city query

**Responsible role:** City analyst

**OLDT surface:** `/analytical-map`

Select physical objects or contextual subjects using the least complex query mode that expresses the question honestly.

1. Choose Builder for normal class, property, indicator, and spatial filters.
2. Choose SQL for read-only joins or calculations that are not expressible in Builder.
3. Choose Subject when the result belongs to an area, cohort, organization, policy, flow account, or other non-building subject.
4. Run the query and inspect result count, truncation, grain, validation state, and returned properties.
5. Save the result as an analysis selection or save the question as a portable blueprint.
6. Choose a destination passport when the same query should open in 2D, 3D, XR, or Canvas.

**Expected result:** A reproducible query, optional frozen membership snapshot, and viewer-compatible result manifest.

**Do not hide:** Do not force population, election, or survey indicators onto buildings when their real observation grain is an area or cohort.

### 4. Compare reality and simulation worlds

**Responsible role:** City analyst or scenario reviewer

**OLDT surface:** `/fragment-visualizer`

Compare multiple saved query snapshots or model scenarios without confusing them with current reality.

1. Save the relevant current query selection before launching a scenario.
2. Open Canvas from the query destination control or from a completed scenario workflow.
3. Select any number of saved worlds and choose Compare, Overlay, or Delta.
4. Use the reality selection as a mask when a scenario should be limited to the original objects.
5. Color by a shared property or model output and apply a world threshold when required.
6. Inspect the baseline/intervention provenance and generated timestamps before interpreting the delta.

**Expected result:** A visual comparison across current snapshots and timestamped simulated worlds.

**Do not hide:** Simulation geometry and values remain in the simulation store until a separate governed process promotes approved evidence.

### 5. Use indicators in queries

**Responsible role:** Analyst, domain expert, or reviewer

**OLDT surface:** `/standards`

Use U4SSC or any future catalog without binding OLDT to one indicator provider.

1. Open the indicator catalog and inspect definition, unit, formula, numerator, denominator, grain, and evidence requirements.
2. Check the active-city readiness result and identify missing sources or mappings.
3. Use only observations whose validation and authority status match the decision being made.
4. Create a reusable threshold when the same comparison will be used repeatedly.
5. Reference the indicator from Builder, SQL, or Subject query according to its observation grain.
6. Preserve the CIP or model receipt as source evidence when the value came from an external calculation.

**Expected result:** A governed indicator condition that can participate in complex spatial and semantic queries.

**Do not hide:** The 91/91 U4SSC acceptance dataset proves software coverage with development data; it does not certify 91 official Guanajuato values.

### 6. Run a controlled workflow

**Responsible role:** Operator

**OLDT surface:** `/operations/workflows`

Execute imports, publications, models, scenarios, or external exchanges with an auditable contract.

1. Select the workflow definition and read its required inputs, outputs, authority boundary, and failure behavior.
2. Create a run for the active city and target profile.
3. Review resolved input counts and external target before approving the run.
4. Approve or reject each required checkpoint with a reason.
5. Execute the run and inspect every step, artifact, receipt, and external identifier.
6. Confirm the final state in the destination tool and in the OLDT persistence surface.

**Expected result:** A succeeded or failed run with durable trace instead of an unrecorded API call.

**Do not hide:** Connectivity validation is only a preflight; acceptance requires creation, readback, persistence, and expected failure isolation.

### 7. Configure another EU LDT deployment

**Responsible role:** Platform administrator

**OLDT surface:** `/operations/eu-ldt`

Point OLDT to another local, cloud, national, or municipal Toolbox instance without changing code.

1. Create a unique profile key, platform kind, display name, and city mapping.
2. Set server-reachable URLs separately from browser-facing public URLs.
3. Choose the authentication mode and store secrets only in protected runtime configuration.
4. Declare the capabilities and endpoint map required by the intended workflow.
5. Run Test and inspect every check rather than relying on a green profile label alone.
6. Select the profile key explicitly when creating the exchange workflow run.

**Expected result:** Multiple independent targets can coexist and each workflow records which one it used.

**Do not hide:** For local Docker, localhost inside the OLDT container is not the Windows host; use a reachable runtime URL such as host.docker.internal.

### 8. Process heavy city data outside the web application

**Responsible role:** Data operator

**OLDT surface:** `/operations/ingestion`

Run heavy extraction, enrichment, tiling, or packaging on the same server, another server, offline, HPC, or cloud.

1. Choose the stage and its approved execution mode.
2. Register or select a processing node and verify its heartbeat and capabilities.
3. Create a bounded city input package and record its checksum.
4. Dispatch or export the run, execute the approved runtime, and return the result manifest.
5. Validate dispatch identity, checksums, artifact classes, and declared outputs.
6. Promote accepted results explicitly; leave rejected artifacts outside canonical city truth.

**Expected result:** Portable processing with traceable artifacts and no requirement to install every heavy model inside OLDT.

**Do not hide:** A prepared package or successful process exit is not enough; promotion requires a valid result contract.

### 9. Execute an OLDT, Data Platform, UCS, and AI Notebook scenario

**Responsible role:** Analyst, operator, and model engineer

**OLDT surface:** `/operations/workflows`

Run a real baseline/intervention cycle and return entity-level simulated worlds to OLDT.

1. Save the OLDT source selection and verify the model input fields.
2. Publish baseline and intervention entities to the selected Data Platform profile.
3. Create the UCS case, scenarios, parameters, experiment, and executions.
4. Let Airflow invoke the named AI Notebook KServe model for both scenarios.
5. Synchronize every external ID, entity output, warning, model version, and timestamp into OLDT.
6. Open Canvas and compare current selection, baseline, intervention, and calculated delta.

**Expected result:** Two timestamped simulation worlds attached to stable OLDT entity IDs and a complete workflow trace.

**Do not hide:** A reachable Kubeflow dashboard is not acceptance. Both model calls and entity-level readback must succeed.

## EU LDT Toolbox Integrations

The official inventory contains 12 tools. AI Notebook is one tool with Kubeflow and GitLab surfaces. Profile health, laboratory acceptance, and production authority approval are separate states.

### 1. Integrated Environment

**Status:** Evaluated

**Purpose:** Central catalog and launcher for Toolbox applications, assets, and revision views.

**OLDT role:** No runtime dependency. OLDT can be linked as an application only when the portal exposes a supported external registration mechanism.

**OLDT sends:** Nothing automatically from OLDT.

**OLDT receives:** Application links and launcher metadata only.

**Local laboratory surface:** http://localhost:4310/

**Official repository:** https://code.europa.eu/ldt-toolbox/eu_ldt_integrated_environment

**User flow:**

1. Open the portal to see the Toolbox application catalog.
2. Launch installed tools from their configured URLs.
3. Do not interpret a working launcher link as a data integration.

**Accepted evidence:** The complete 12-tool local bundle reached a healthy state on 2026-07-10. Code review did not find a supported no-code API for registering an arbitrary external OLDT application.

**Boundary:** Evaluated as an ecosystem shell. Direct OLDT registration remains an upstream extension request, not a hidden local patch.

**Evidence documents:** `docs/EU_LDT_TOOLBOX_INTEGRATION.md`

### 2. Identity Management

**Status:** End-to-end verified

**Purpose:** Keycloak-based OIDC identity, roles, SSO, tokens, and federation.

**OLDT role:** Optional standards-based identity provider. OLDT remains compatible with other OIDC providers and retains standalone login.

**OLDT sends:** OIDC authorization request, PKCE challenge, state, nonce, and configured callback URL.

**OLDT receives:** Signed tokens, identity claims, roles, city mapping, and logout redirect.

**Local laboratory surface:** http://localhost:9080/

**Official repository:** https://code.europa.eu/ldt-toolbox/eu_ldt_identity_management

**User flow:**

1. The administrator registers an OLDT OIDC client and valid redirect URI.
2. The user chooses organization login on the OLDT sign-in page.
3. OLDT validates discovery, issuer, JWKS signature, audience or azp, state, and nonce before creating a session.

**Accepted evidence:** Identity acceptance suite passed 7/7 cases against the real local EU Keycloak, including standalone regression and deployed login/callback/logout routes.

**Boundary:** Identity profiles are separate from EU LDT endpoint profiles so another conforming provider can replace Keycloak without changing OLDT code.

**Evidence documents:** `docs/IDENTITY_PROVIDER_PROFILES.md`, `docs/EU_LDT_TOOL_ACCEPTANCE_MATRICES.md`

### 3. Data Platform

**Status:** End-to-end verified

**Purpose:** NGSI-LD context broker, ingestion, subscriptions, data query, history, and supporting data services.

**OLDT role:** Configurable provider and consumer through NGSI-LD projections and workflow-selected profile keys.

**OLDT sends:** Canonical entity projections, bounded saved selections, model inputs, indicator sources, and scenario inputs.

**OLDT receives:** Entity readback, enriched properties, model or KPI receipts, and external IDs with provenance.

**Local laboratory surface:** http://localhost/

**Official repository:** https://code.europa.eu/ldt-toolbox/eu_ldt_data_platform

**User flow:**

1. Choose the Data Platform profile in the workflow.
2. Publish a bounded OLDT selection as NGSI-LD.
3. Verify the entity in the broker or Data Platform API.
4. Synchronize the returned value or entity into the correct OLDT evidence and indicator stores.

**Accepted evidence:** Bidirectional NGSI-LD publish and readback were exercised from OLDT. The same profile is reused by CIP and UCS cycles.

**Boundary:** Data Platform is the horizontal data backbone; OLDT remains the city runtime, query system, provenance store, and visual decision surface.

**Evidence documents:** `docs/EU_LDT_TOOLBOX_INTEGRATION.md`

### 4. Play & Visualise

**Status:** End-to-end verified

**Purpose:** Compose external 2D and 3D maps, layers, plots, and reports from registered data sources.

**OLDT role:** OLDT exposes OGC API Features and GeoJSON, then registers data sources and layers in a selected Play instance.

**OLDT sends:** OLDT OGC collection URLs, GeoJSON features, layer definitions, styles, plot, and report metadata.

**OLDT receives:** Play map, data-source, data-layer, plot, and report identifiers for traceability.

**Local laboratory surface:** http://localhost:4300/

**Official repository:** https://code.europa.eu/ldt-toolbox/eu_ldt_play_and_visualise

**User flow:**

1. Run the Play registration workflow for a saved OLDT selection or canonical collection.
2. Open Play and inspect the created map, sources, layers, plot, and report.
3. Return to OLDT to inspect the workflow trace and external identifiers.

**Accepted evidence:** Acceptance run 75de9f3d-b355-4e53-b547-50de2685cbc4 passed 6/6 cases, including a 500-object full-power composition and failure isolation.

**Boundary:** Play is an external composition surface. OLDT keeps its own analytical 2D, Cesium 3D, Civic XR, and Canvas capabilities.

**Evidence documents:** `docs/EU_LDT_TOOL_ACCEPTANCE_MATRICES.md`, `docs/EU_LDT_TOOLBOX_INTEGRATION.md`

### 5. Marketplace

**Status:** End-to-end verified

**Purpose:** Package, describe, publish, discover, negotiate, and download digital assets and services through participant agents and a hub.

**OLDT role:** OLDT connects to one or more municipality or provider agents; it does not embed one fixed agent in the product.

**OLDT sends:** Payload, metadata, license, categories, compatibility targets, product/resource specifications, and publication request.

**OLDT receives:** Agent asset ID, offering ID, publication state, searchable metadata, and downloaded artifact evidence.

**Local laboratory surface:** http://marketplace.127.0.0.1.nip.io:4314/

**Official repository:** https://code.europa.eu/ldt-toolbox/EU_LDT_Marketplace

**User flow:**

1. Register each Marketplace Agent as a separate OLDT profile.
2. Select one or more agents and publish a governed OLDT package.
3. Use the returned offering ID to inspect the hub after its own launch/moderation process.
4. Use another agent to discover and consume the offering when testing provider-consumer behavior.

**Accepted evidence:** Acceptance run 295ac5cc-6ee3-4d40-bdec-3665ca586921 passed 8/8 cases with two independent agents, OAuth2 credentials, upload, publication, discovery, download, and failure isolation.

**Boundary:** The Marketplace controls launch or moderation. OLDT proves agent publication and evidence; it does not bypass marketplace governance.

**Evidence documents:** `docs/EU_LDT_TOOL_ACCEPTANCE_MATRICES.md`, `docs/EU_LDT_TOOLBOX_INTEGRATION.md`

### 6. Data Modeller

**Status:** End-to-end verified

**Purpose:** Govern schemas, data-source generators, fixtures, generated files, and synthetic data-source lifecycle.

**OLDT role:** OLDT exports a schema or fixture contract, runs a generator through the selected profile, and imports generated rows as simulated model evidence.

**OLDT sends:** Schema, fixture, generator configuration, stable entity references, and generation request.

**OLDT receives:** Generated file, execution state, row-level outputs, generator IDs, and validation evidence.

**Local laboratory surface:** http://localhost:4320/

**Official repository:** https://code.europa.eu/ldt-toolbox/eu_ldt_data_modeller

**User flow:**

1. Create or select the Data Modeller profile.
2. Run the schema workflow to register the OLDT contract.
3. Run the fixture workflow and wait for completed generation.
4. Import the output and inspect model-output and standards surfaces in OLDT.

**Accepted evidence:** The governed round trip imported eight generated rows. Workflow ff71edaa-fff7-42cb-a2b6-0d1719bf4576 registered the schema and c0e0df88-4570-4dc2-a72f-b8f0a9edec46 completed the fixture cycle.

**Boundary:** Generated values are marked simulated and synthetic; Data Modeller remains an optional add-on and cannot promote authority data by itself.

**Evidence documents:** `docs/EU_LDT_DATA_MODELLER_SCENARIO.md`

### 7. Data Space Ready

**Status:** End-to-end verified

**Purpose:** Publish and consume governed data-space offers through EDC, DSP, policies, contracts, and transfers.

**OLDT role:** OLDT prepares the data package and receipt endpoint; selected provider and consumer EDC profiles perform catalog, negotiation, and transfer.

**OLDT sends:** Checksummed query package, DCAT-style manifest, ODRL policy, asset/offer metadata, and callback URL.

**OLDT receives:** Catalog result, contract negotiation IDs, transfer process, receipt, byte count, and SHA-256 verification.

**Local laboratory surface:** http://localhost:4330/

**Official repository:** https://code.europa.eu/ldt-toolbox/eu_ldt_data_space_ready

**User flow:**

1. Configure provider and consumer profiles with Management API, API key, participant ID, and DSP endpoint.
2. Create the bounded OLDT package and publish the provider offer.
3. From the consumer, discover the provider catalog, negotiate, and start transfer.
4. Verify the OLDT receipt byte count and checksum before accepting the result.

**Accepted evidence:** Workflow dbbb6830-6b59-449e-930a-b035c41ecceb transferred 25 roads and verified 83,296 bytes; the missing-provider failure test left 157,535 canonical entities operational.

**Boundary:** EDC exchange is optional. A missing profile fails only the selected workflow and does not alter OLDT startup, queries, viewers, or standards.

**Evidence documents:** `docs/EU_LDT_DATA_SPACE_READY_LAB.md`

### 8. City Innovation Planner

**Status:** End-to-end verified

**Purpose:** Manage KPI catalogs, sources, measurements, initiatives, and city-planning evidence.

**OLDT role:** OLDT publishes governed metric sources through Data Platform, asks CIP to calculate or retain measurements, then synchronizes measurements and initiative links.

**OLDT sends:** Saved selection metric or attribute, NGSI-LD source entity, KPI metadata, unit, aggregation, and optional calculation request.

**OLDT receives:** KPI ID, datasource ID, measurement value/status, initiative ID, and links back to saved OLDT selections.

**Local laboratory surface:** http://localhost:4350/

**Official repository:** https://code.europa.eu/ldt-toolbox/eu_ldt_city_innovation_planner

**User flow:**

1. Select the OLDT selection and Data Platform/CIP profiles.
2. Choose an existing CIP KPI or create a compatible one.
3. Publish the metric source and request calculation when required.
4. Synchronize the measurement and initiative links into OLDT.
5. Use the returned governed observation in Builder, SQL, or Subject query at the correct grain.

**Accepted evidence:** A real KPI Consumer measurement returned 20,174 selected objects. The U4SSC development matrix passed 91/91 Data Platform, CIP, roundtrip, Builder, and SQL cases.

**Boundary:** CIP calculates and organizes planning evidence; OLDT owns the provider-neutral catalog compatibility, queryability, provenance, and authority boundary.

**Evidence documents:** `docs/EU_LDT_CITY_INNOVATION_PLANNER_INTEGRATION.md`, `docs/INDICATOR_KPI_CATALOG.md`, `docs/U4SSC_INDICATOR_QUERY_ACCEPTANCE.md`

### 9. Use Case & Scenarios

**Status:** End-to-end verified

**Purpose:** Define cases, problems, scopes, scenarios, parameters, experiments, and baseline/intervention executions.

**OLDT role:** OLDT provides saved selections and Data Platform inputs, creates the scenario structure, and stores returned execution resources as explicit simulation worlds.

**OLDT sends:** Selection binding, baseline/intervention values or entities, city/scope metadata, model namespace/name, and scenario parameters.

**OLDT receives:** Case, scenario, experiment, execution, workflow, and model identifiers plus scalar or entity-level outputs.

**Local laboratory surface:** http://localhost:5002/

**Official repository:** https://code.europa.eu/ldt-toolbox/eu_ldt_use_cases_and_scenarios

**User flow:**

1. Save the source OLDT selection.
2. Create a UCS workflow run with target profiles and baseline/intervention settings.
3. Approve the run and inspect both executions in UCS.
4. Return to OLDT Canvas to compare the resulting worlds.

**Accepted evidence:** Acceptance run b8bc4ce2-d4fa-4a6d-be18-286364363702 passed 5/5 orchestration cases. The entity-level AI model cycle passed 7/7 in run 05612221-4d58-40aa-9aed-f94d0f644fd6.

**Boundary:** UCS orchestrates experiments. It is not the city source of truth, model registry, or final decision viewer.

**Evidence documents:** `docs/EU_LDT_USE_CASE_SCENARIOS_INTEGRATION.md`, `docs/EU_LDT_AI_NOTEBOOK_UCS_INTEGRATION.md`, `docs/EU_LDT_TOOL_ACCEPTANCE_MATRICES.md`

### 10. AI Notebook

**Status:** End-to-end verified

**Purpose:** Kubeflow notebooks, pipelines, experiments, Katib, KServe inference, GitLab model registry, artifacts, and identity integration.

**OLDT role:** AI Notebook remains model engineering infrastructure. OLDT reaches a named inference service through a controlled UCS workflow and persists the returned simulation world.

**OLDT sends:** Versioned inference payload with stable entity IDs, physical properties, parameters, and model contract metadata.

**OLDT receives:** Entity-level prediction, model/version, warnings, generated time, and inference-service provenance.

**Local laboratory surface:** https://kubeflow.127.0.0.1.nip.io:4381/

**Official repository:** https://code.europa.eu/ldt-toolbox/eu_ldt_ai_notebook

**User flow:**

1. The model engineer versions and deploys the model through GitLab/Kubeflow/KServe.
2. The operator verifies the named inference service and UCS adapter.
3. The analyst launches the approved OLDT/UCS scenario workflow.
4. OLDT stores the returned baseline and intervention worlds and opens Canvas for review.

**Accepted evidence:** Full acceptance run 05612221-4d58-40aa-9aed-f94d0f644fd6 passed 7/7 cases with two real KServe inferences and entity-level OLDT readback.

**Boundary:** The accepted scenario path is integrated. A complete usability and administration evaluation of every Kubeflow and GitLab surface remains future work.

**Evidence documents:** `docs/EU_LDT_AI_NOTEBOOK_UCS_INTEGRATION.md`

### 11. Participate

**Status:** Future integration

**Purpose:** Decidim participation processes, proposals, debates, meetings, surveys, initiatives, assemblies, maps, and scenario references.

**OLDT role:** The natural future path is OLDT to Play or UCS to Participate, with governed participation assets optionally synchronized back to OLDT.

**OLDT sends:** No accepted direct OLDT payload yet. Upstream modules can reference Play maps and completed UCS experiments.

**OLDT receives:** Future candidates include aggregate proposals, survey results, meeting evidence, process IDs, and participation provenance.

**Local laboratory surface:** http://localhost:4360/

**Official repository:** https://code.europa.eu/ldt-toolbox/eu_ldt_Participate

**User flow:**

1. Create a participation process in Participate.
2. Attach a registered Play map or completed UCS scenario where relevant.
3. Collect proposals, debates, meetings, surveys, or initiatives.
4. Define an aggregate privacy-safe synchronization contract before importing results into OLDT.

**Accepted evidence:** Source code and the full local deployment were evaluated. No direct OLDT acceptance workflow has been implemented.

**Boundary:** Do not call Participate integrated with OLDT until a real participatory asset is created, consumed, synchronized, and persisted with privacy rules.

**Evidence documents:** No dedicated OLDT evidence document yet.

### 12. Federated Learning

**Status:** Future integration

**Purpose:** Coordinate Flower SuperLink and SuperNode training tasks across multiple participants.

**OLDT role:** The natural future boundary is AI Notebook to Flower. OLDT should consume a versioned resulting model or inference contract, not orchestrate node training directly.

**OLDT sends:** Today, nothing directly. AI Notebook can prepare a Flower project, metadata, node mapping, and participant data package.

**OLDT receives:** Future OLDT use would receive a registered model version, evaluation evidence, and predictions through AI Notebook/KServe.

**Local laboratory surface:** http://localhost:4370/docs

**Official repository:** https://code.europa.eu/ldt-toolbox/eu_ldt_federated_learning

**User flow:**

1. Prepare a Flower-compatible project and participant mapping in AI Notebook.
2. Launch the federated task against registered nodes.
3. Monitor task status and retrieve model weights or evaluation output.
4. Register the accepted model in AI Notebook before exposing inference to OLDT.

**Accepted evidence:** The local server and two client APIs were installed and inspected. No OLDT training or inference round trip has been accepted.

**Boundary:** Federated does not automatically mean that no participant data package moves. The exact data-transfer and privacy contract must be reviewed per deployment.

**Evidence documents:** No dedicated OLDT evidence document yet.

## External AI Models

Models are tracked separately from Toolbox applications. A model execution smoke test is not presented as a production OLDT integration or as municipal authority data.

### 1. Building Environmental Footprint

**Status:** Integrated in lab

**Engine:** XGBoost and LightGBM

**Observation subject:** Building

**Inputs:** Annual energy consumption, annual CO2 emissions, surface area, and stable building identity.

**Outputs:** SAP score and energy label A-G.

**OLDT fit:** Model outputs can be attached to canonical buildings, materialized as governed indicators, queried by Builder/SQL, and exported through Standards.

**Evidence boundary:** The eu-ldt-ecobuild contract and SAP/energy-label query presets are present in OLDT. Current laboratory values remain simulated, not authority-approved.

**Official repository:** https://code.europa.eu/ldt-toolbox/ai_models/eu_ldt_building_environmental_energy_footpring

### 2. Neighbourhood Energy Demand Forecasting

**Status:** Evaluated

**Engine:** PyTorch LSTM

**Observation subject:** Energy zone or time series

**Inputs:** At least 30 daily historical demand observations for inference, country/model selection, and forecast horizon.

**Outputs:** Future daily energy-load sequence.

**OLDT fit:** Requires a real municipal energy-zone or network time series. The supplied baseline is country or bidding-zone scale and cannot be presented honestly as neighbourhood-ready without local fine-tuning.

**Evidence boundary:** Repository, model contract, packaged weights, and sample input were inspected. No durable OLDT model-output round trip is claimed.

**Official repository:** https://code.europa.eu/ldt-toolbox/ai_models/eu_ldt_energy_demand_forecasting

### 3. Renovation Strategies

**Status:** Model execution verified

**Engine:** MILP and genetic optimization

**Observation subject:** Building portfolio

**Inputs:** Building archetype, current and potential performance, geometry, refurbishment cost assumptions, budget, and objective.

**Outputs:** Prioritized interventions, cost, and estimated energy or emissions reduction.

**OLDT fit:** Strong fit for saved building selections and Canvas scenario comparison once local archetype and cost sources are governed.

**Evidence boundary:** Direct and KServe smoke outputs were produced. The OLDT readiness workflow remains draft/inactive and no output is authority-approved.

**Official repository:** https://code.europa.eu/ldt-toolbox/ai_models/eu_ldt_sustainable_urban_development

### 4. Urban Planning Vulnerability / NEVULA

**Status:** Model execution verified

**Engine:** Neural encoder and K-Means clustering

**Observation subject:** Census or statistical area

**Inputs:** Area geometry, ISV reference, and vulnerability indicators following the iXX feature convention.

**Outputs:** Vulnerability score, cluster, and cluster signature.

**OLDT fit:** Belongs to contextual statistical-area subjects, not individual buildings. It becomes queryable when authentic census areas and governed observations are loaded.

**Evidence boundary:** Direct and KServe smoke responses were produced from census-like polygons. The result is a model execution test, not a Guanajuato vulnerability claim.

**Official repository:** https://code.europa.eu/ldt-toolbox/ai_models/eu_ldt_vulnerability_mitigation

### 5. Police Routing Tool

**Status:** Model execution verified

**Engine:** SimFleet and SPADE multi-agent simulation

**Observation subject:** Patrol route and emergency event

**Inputs:** Route coordinate sequences, patrol definitions, emergency coordinates, and emergency timing.

**Outputs:** Patrol trajectories, response/coverage metrics, and simulation evidence.

**OLDT fit:** Could consume road-network selections and return a simulation world, but needs an operational emergency and patrol contract before city use.

**Evidence boundary:** Direct and KServe smoke responses plus patrol metrics were produced. No OLDT workflow or canonical persistence is claimed.

**Official repository:** https://code.europa.eu/ldt-toolbox/ai_models/eu_ldt_sustainable_urban_planning_police_routing

### 6. Urban Mobility

**Status:** Integrated in lab

**Engine:** SUMO through KServe

**Observation subject:** Road edge and mobility flow

**Inputs:** SUMO network, detector/flow inputs, simulation parameters, and road-edge mapping.

**Outputs:** Speed, density, occupancy, flow, waiting time, time loss, and travel time.

**OLDT fit:** Outputs can attach to canonical road entities and return through Data Platform for map, query, and indicator use.

**Evidence boundary:** KServe, NGSI-LD, Data Platform, and OLDT road roundtrip were exercised. Detector/flow inputs were synthetic and edge-to-road matching used a laboratory nearest-road mapping.

**Official repository:** https://code.europa.eu/ldt-toolbox/ai_models/eu_ldt_urban_mobility

### 7. Pollution Propagation

**Status:** Evaluated

**Engine:** CHIMERE, MPI, Kafka, Redis, and MinIO

**Observation subject:** Atmospheric grid and time window

**Inputs:** Domain grid, emissions, meteorology, chemical boundaries, model databases, dates, and execution resources.

**Outputs:** Time-varying pollutant concentration fields and NetCDF/CSV result artifacts.

**OLDT fit:** Requires raster/grid phenomenon layers and time-series storage, not only buildings or roads. OLDT can receive the postprocessed layer after a real CHIMERE execution.

**Evidence boundary:** Architecture and installation were evaluated. A full model run is not claimed: upstream documentation requires roughly 400 GB of model databases and a multi-hour MPI-capable build.

**Official repository:** https://code.europa.eu/ldt-toolbox/ai_models/eu_ldt_pollution_propagation

## Active City Evidence

The in-product `/docs` page separates three kinds of evidence. Territorial metrics, geometry counts, semantic-seed counts, and live layer definitions are recalculated from `/api/live/current/base` for the active city. Names, source descriptions, and fallback layer descriptions are contextualized from the active city registry. Viewer contracts, semantic categories, interoperability posture, future packs, and EU pilot alignment are shared OLDT references until a city-specific override exists. This section is an inventory and readiness view, not a KPI score.

## Reference Documents

Paths are relative to the OLDT installation root. In the product, each allowlisted file can be opened through `/docs/reference/<key>` after authentication.

| Document | Purpose | In-product reader |
| --- | --- | --- |
| `docs/USER_MANUAL.md` | Generated durable copy of this in-product manual. | `/docs/reference/user-manual` |
| `docs/ARCHITECTURE_INDEX.md` | Canonical product architecture and documentation map. | `/docs/reference/architecture-index` |
| `docs/OPEN_SOURCE_INSTALLATION_GUIDE.md` | Install and bootstrap an OLDT city runtime. | `/docs/reference/installation` |
| `docs/TWIN_QUERY_ENGINE.md` | TwinQL, CQL2, read-only SQL, selection, and transport contracts. | `/docs/reference/twin-query` |
| `docs/CONTEXT_SUBJECT_QUERY_ARCHITECTURE.md` | Contextual subjects, relations, portable questions, and result manifests. | `/docs/reference/subjects` |
| `docs/INDICATOR_KPI_CATALOG.md` | Provider-neutral catalogs, governed observations, and readiness validation. | `/docs/reference/indicators` |
| `docs/U4SSC_INDICATOR_QUERY_ACCEPTANCE.md` | All 91 U4SSC Builder, SQL, Data Platform, and CIP development cases. | `/docs/reference/u4ssc` |
| `docs/EU_LDT_TOOLBOX_INTEGRATION.md` | Profile registry and Toolbox integration boundary. | `/docs/reference/toolbox` |
| `docs/EU_LDT_TOOL_ACCEPTANCE_MATRICES.md` | Executable case-level acceptance evidence. | `/docs/reference/acceptance` |
| `docs/IDENTITY_PROVIDER_PROFILES.md` | Generic OIDC configuration and EU Keycloak acceptance. | `/docs/reference/identity` |
| `docs/EU_LDT_DATA_MODELLER_SCENARIO.md` | Schema, fixture, generator, and OLDT import cycle. | `/docs/reference/modeller` |
| `docs/EU_LDT_DATA_SPACE_READY_LAB.md` | EDC provider-consumer transfer and OLDT receipt verification. | `/docs/reference/data-space` |
| `docs/EU_LDT_CITY_INNOVATION_PLANNER_INTEGRATION.md` | KPI source, measurement, initiative, and indicator roundtrip. | `/docs/reference/cip` |
| `docs/EU_LDT_USE_CASE_SCENARIOS_INTEGRATION.md` | Case/scenario/experiment orchestration and world persistence. | `/docs/reference/ucs` |
| `docs/EU_LDT_AI_NOTEBOOK_UCS_INTEGRATION.md` | Real KServe baseline/intervention inference and Canvas comparison. | `/docs/reference/ai-notebook` |
| `docs/DATA_FACTORY_REMOTE_SERVER_CONFIGURATION.md` | Configure remote, HPC, cloud, and offline processing nodes. | `/docs/reference/data-factory` |
| `docs/DEPENDENCY_SECURITY_AUDIT_2026-07-12.md` | Current npm remediation evidence and required audit gate. | `/docs/reference/security` |

## Glossary

- **Canonical entity:** The stable OLDT city record used as current physical or institutional truth.
- **Contextual subject:** A city, area, cohort, organization, policy, election, service zone, or flow account that owns observations at a non-building grain.
- **Indicator observation:** A value linked to a catalog definition, subject, time, source, validation state, and authority posture.
- **KPI:** An indicator selected for a target or management objective; not every city indicator is automatically a KPI.
- **Model output:** External or local calculated evidence attached to a subject or entity with model/version provenance.
- **Simulation world:** A timestamped baseline, intervention, forecast, or other hypothetical state kept separate from current reality.
- **Saved selection:** A frozen set of query members, metrics, style, and source query for replay and comparison.
- **Portable question:** A reusable subject-query blueprint stored separately from city-specific bindings and execution runs.
- **Integration profile:** One configured external instance with platform kind, URLs, city mapping, auth, capabilities, and last checks.
- **Acceptance:** Evidence that a real operation was created, consumed, read back, persisted, and isolated correctly on failure.
- **NGSI-LD:** Linked-data context entity exchange used by OLDT and the EU LDT Data Platform boundary.
- **EDC:** Eclipse Dataspace Components protocol stack used for policy, catalog, contract negotiation, and controlled transfer.
- **KServe:** Kubernetes inference serving layer used by AI Notebook models through the Open Inference protocol.
- **Flower:** Open-source federated learning framework used by the EU LDT Federated Learning tool.
