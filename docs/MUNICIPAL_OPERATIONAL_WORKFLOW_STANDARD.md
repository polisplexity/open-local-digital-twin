# Municipal Operational Workflow Standard

Updated: 2026-06-26

This note defines the product boundary between Twin Base Studio as a Local
Digital Twin platform and the official municipal systems where administrative
decisions are made.

## Core Restriction

Twin Base Studio may support, accelerate, explain, and evidence a municipal
workflow. It must not claim to replace the city's official permitting,
planning-registry, emergency-management, or authority-decision system unless a
city explicitly contracts and validates that role.

The platform should therefore keep two layers separate:

1. Twin and evidence layer: city inventory, semantic classes, BIM/GIS intake,
   rule checks, scenario outputs, viewer artifacts, evidence briefs, exports,
   and interoperability payloads.
2. Municipal operating process: the city's real review, approval, registry,
   dispatch, emergency-planning, permitting, or administrative workflow where
   official responsibility remains with the public authority.

The first layer can reduce municipal workload only when it produces artifacts
that the second layer can actually use.

## WS2 Shared Service Boundary

For WS2 and similar multi-city work, semantic capabilities should not be
described as city-named tools. They also should not be forced into one
mega-service that hides each real municipal workflow.

Shared does not mean every city uses identical datasets or identical municipal
workflows. Shared means operational packs use the same semantic model, pack
runtime, evidence artifact shape, quality gates, workflow handoff model, and
harmonised indicator contracts.

The product shape should be modular, like ERP modules:

- `municipal-planning-compliance-pack` for planning, permitting, digital
  construction, model evidence, and rule/check workflows;
- `urban-risk-preparedness-pack` for hazard, exposure, emergency resources,
  shelters, assembly areas, access, and preparedness workflows;
- `federation-interoperability-pack` to connect pack outputs into shared
  reporting, standards, replication, and cross-city learning.

## Evidence Patterns From Current LDT4SSC Material

The planning/digital-construction pattern is about BIM-based urban planning, 3D
planning, planning-registry context, model intake, automated checks, and public
procurement or formal municipal workflows that remain separate from Polisplexity
unless formally contracted.

The urban-risk/preparedness pattern is about GIS/BIM-based resilience,
geotechnical or hazard evidence, emergency resources, shelter/assembly-area
coverage, access gaps, and planning-risk review.

The shared route is one technical architecture with reusable module families,
not one pack per city name.

The WS2 guidance notes are aligned with this restriction: each service must name
the real municipal user, the workflow, the scenarios or data compared, and the
decision being supported.

## Required Workflow Contract

Before a city pilot or semantic pack is treated as operational, it must define:

1. City workflow name.
2. Responsible municipal office or role.
3. Current process baseline.
4. Input data and owning authority.
5. Output artifacts produced by Twin Base Studio.
6. Where those outputs enter the municipal process.
7. Decision supported, without implying automatic approval.
8. Quality gate before use.
9. Authority review state.
10. Metrics used to measure workload reduction.

## Metrics That Are Safe To Claim

Safe metrics:

- time to prepare evidence package;
- number of manual data lookups avoided;
- number of automatic checks run before human review;
- data re-entry reduction;
- incomplete-submission detection;
- scenario-comparison time;
- missing-data gap closure;
- review handoff completeness.

Risky metrics unless the city validates them:

- legal permit approval time;
- statutory review duration;
- official inspection time;
- emergency response time;
- final authority decision time.

The product may target these outcomes, but should not present them as achieved
until the municipal process owner validates baseline and post-pilot values.

## Planning / Digital Construction Review Minimum Standard

The planning module should be standardized as a Planning / Digital Construction
Review track.

Minimum workflow contract:

- workflow: BIM/GIS planning submission review or planning-registry support;
- owner: municipal planning, permitting, digital construction, digital twin, or
  planning-registry route;
- inputs: planning case, IFC/BIM model, base city context, master-plan or zoning
  rules, constraints, greenery/public-space requirements, protected areas,
  utility/spatial restrictions, fire-safety or proximity rules where available;
- outputs: machine-readable planning data, extracted model metadata, automated
  rule-check results, 3D/public-explanation scene, evidence package for human
  review;
- process insertion point: before or during municipal review, not as final
  approval;
- quality gates: model format validation, rule-source provenance, city-reviewed
  rule mapping, reproducible check results, export accepted by the planning
  registry or review team;
- safe metrics: reduced manual data re-entry, faster completeness checks,
  faster evidence preparation, clearer scenario comparison.

## Urban Risk / Preparedness Minimum Standard

The risk module should be standardized as an Urban Risk / Preparedness Planning
track.

Minimum workflow contract:

- workflow: earthquake-disaster preparedness planning, shelter/assembly-area
  coverage review, emergency-access analysis, or planning-risk review;
- owner: municipal IT, zoning/planning, risk-management, civil-protection, or
  emergency-preparedness office, with formal executive route when needed;
- inputs: buildings, roads, districts, neighborhoods, cadastral/planning layers,
  fault lines, fault zones, micro-zoning, geological maps, drilling and ground
  investigation evidence, disaster-prone areas, shelters, assembly areas, public
  institutions, earthquake observation stations;
- outputs: exposure indicators, risk summaries, shelter/assembly coverage,
  emergency-access gaps, district reports, missing-data gaps, and evidence
  exports;
- process insertion point: municipal preparedness/planning review, not emergency
  dispatch or official risk certification unless separately validated;
- quality gates: layer provenance, authority status, coordinate/reference
  validation, data freshness, pack input completeness, reviewed risk semantics;
- safe metrics: faster preparedness evidence assembly, clearer shelter/access
  gap review, reduced manual layer reconciliation, faster scenario generation.

## Implementation Implications

PostGIS remains the source of truth for objects, geometry, provenance, semantic
tags, rule outputs, artifacts, and authority review state.

The backend should expose workflow contracts and pack outputs as registered,
versioned artifacts. Viewer surfaces should consume those artifacts instead of
inventing process claims in UI code.

Semantic packs must therefore be installable operational modules with:

- required inputs;
- accepted semantic classes and tags;
- rule manifests;
- validation gates;
- output artifact definitions;
- evidence export shape;
- review and authority-state transitions.

## Product Rule

No city pilot is operational just because the data exists in PostGIS or renders
in MapLibre/Cesium/Babylon.

A city pilot becomes operational only when the platform can show:

- which municipal workflow it supports;
- what data it reads;
- what artifact it creates;
- who reviews it;
- where it enters the real city process;
- which measured task it reduces.
