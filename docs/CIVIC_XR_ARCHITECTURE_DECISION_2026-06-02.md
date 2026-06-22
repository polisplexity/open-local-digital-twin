# Civic XR Architecture Decision

Date: 2026-06-02

## Decision

The public/stakeholder surface is now **Civic XR**. The canonical product route
is `/civic-xr`. The older `/civic-view`, `/public`, and `/live/current/immersive`
names remain compatibility aliases while the codebase migrates.

Civic XR uses **Babylon.js + WebXR** as the open-source browser runtime.

## Why

- It keeps the baseline product open-source and installable by any city.
- It supports desktop 3D first, then WebXR sessions on browsers/devices that
  expose `navigator.xr`.
- It does not require Cesium ion, Unreal, Unity, proprietary stores, or hosted
  asset accounts.
- It can consume the same TwinQL/selection contract as Analytical Map and City
  3D.

## Surface Split

- **Analytical Map**: MapLibre + PostGIS/MVT for city-object querying, filtering,
  and operational map embeds.
- **City 3D**: CesiumJS for spatial inspection, terrain/phenomena screening, and
  future 3D Tiles packages.
- **Civic XR**: Babylon/WebXR for browser XR storytelling, public-safe civic
  review, and future headset/tabletop sessions.

## Data Contract

Civic XR must not create a hidden dataset. It reads the same city inventory and
selection abstractions as the other visualizers. The current first cut consumes
the local scene/base payload while preserving:

- surface manifest publication,
- `twin:set-visible-layers`,
- `twin:set-fidelity`,
- `twin:set-semantic-query`,
- `twin:clear-semantic-query`,
- viewer ready/error postMessage events.

The next step is to switch Civic XR query results from the base scene payload to
the same selection-scoped manifest used by the visual query contract.

## Non-Core Adapters

Unreal, Unity, Gaussian splats, and photorealistic walkthrough runtimes are not
the open-core Civic XR baseline. They can become optional downstream adapters
for a later Simulation Lab or high-fidelity partner pack, but they should not be
required for a city to install the open-source twin.

