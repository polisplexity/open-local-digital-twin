'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Alert, Badge, Button, Card, Col, Container, Form, Row, Spinner, Table } from 'react-bootstrap'
import TwinModuleHeader from '@/components/twin-module/TwinModuleHeader'
import DesktopFirstGate from '@/components/twin-module/DesktopFirstGate'
import { usePlatformContext } from '@/context/PlatformContext'
import { adminToolLinks } from '@/data/digital-twin/moduleConfig'
import { getCityWorkspaceLabel } from '@/data/digital-twin/platformBrand'
import { ws2MunicipalityCatalog } from '@/data/digital-twin/ws2MunicipalityCatalog'
import { getAdminActivity, getAdminMetrics } from '@/data/digital-twin/workspaceContent'

function buildCityCards(registry = {}) {
  const cities = Array.isArray(registry.cities) ? registry.cities : []
  const activeCityId = registry.activeCityId
  return cities.map((city) => ({
    ...city,
    isActive: city.id === activeCityId,
  }))
}

const emptyDraft = {
  name: '',
  country: '',
  countryCode: '',
  region: '',
  nominatimQuery: '',
  lat: '',
  lon: '',
  municipalityTitle: '',
  municipalityDescription: '',
}

const emptyProviderDraft = {
  id: '',
  name: '',
  providerType: 'data-provider',
  connectorKey: '',
  connectorType: 'upload',
  supportedFormats: 'geojson,csv,ogc-api-features',
  endpointUrl: '',
}

const emptyLayerDraft = {
  key: '',
  name: '',
  providerId: '',
  layerFamily: 'provider-layer',
  geometryType: 'Geometry',
  accessLevel: 'city-private',
}

const emptyIngestionDraft = {
  layerKey: '',
  mode: 'csv',
  packageFormat: 'raster-cog',
  sourceUri: '',
  csvText: '',
  latitudeField: 'lat',
  longitudeField: 'lon',
}

function slugifyCityId(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function ensureUniqueCityId(sourceId, cities = []) {
  const existingIds = new Set(cities.map((city) => city.id))
  let nextId = sourceId || 'draft-city'
  let counter = 2
  while (existingIds.has(nextId)) {
    nextId = `${sourceId || 'draft-city'}-${counter}`
    counter += 1
  }
  return nextId
}

function buildRegistryCityFromCatalogEntry(entry, cities = []) {
  const baseId = String(entry.registryId ?? entry.cityName ?? entry.id ?? '')
  const nextId = ensureUniqueCityId(slugifyCityId(baseId), cities)

  return {
    id: nextId,
    name: entry.cityName,
    country: entry.country,
    countryCode: '',
    region: entry.region ?? '',
    lat: 0,
    lon: 0,
    enabled: false,
    preloaded: false,
    spotlight: false,
    twinLabel: `${entry.cityName} Digital Twin`,
    nominatimQuery: entry.nominatimQuery ?? `${entry.cityName}, ${entry.country}`,
    municipalityTitle: entry.municipalityTitle ?? entry.cityName,
    municipalityDescription: entry.municipalityDescription ?? entry.organisation ?? 'Municipal authority territory',
  }
}

export default function AdminRegistryPageClient({ initialRegistry }) {
  const { activeCity: currentCity, refreshPlatformContext, setSelectedCityId } = usePlatformContext()
  const [registry, setRegistry] = useState(initialRegistry ?? null)
  const [cacheStatus, setCacheStatus] = useState([])
  const [loading, setLoading] = useState(!initialRegistry)
  const [saving, setSaving] = useState(false)
  const [preloadingCityId, setPreloadingCityId] = useState('')
  const [providerRegistry, setProviderRegistry] = useState({ providers: [] })
  const [cityLayers, setCityLayers] = useState([])
  const [layerJobs, setLayerJobs] = useState([])
  const [providerDraft, setProviderDraft] = useState(emptyProviderDraft)
  const [layerDraft, setLayerDraft] = useState(emptyLayerDraft)
  const [ingestionDraft, setIngestionDraft] = useState(emptyIngestionDraft)
  const [providerSaving, setProviderSaving] = useState(false)
  const [layerSaving, setLayerSaving] = useState(false)
  const [ingestingLayer, setIngestingLayer] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [draftCity, setDraftCity] = useState(emptyDraft)

  const loadCacheStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/city-caches', { credentials: 'same-origin' })
      if (!response.ok) {
        throw new Error(`CITY_CACHE_LOAD_FAILED:${response.status}`)
      }
      const payload = await response.json()
      setCacheStatus(Array.isArray(payload.caches) ? payload.caches : [])
    } catch (loadError) {
      setError(String(loadError?.message ?? 'CITY_CACHE_LOAD_FAILED'))
    }
  }, [])

  const loadRegistry = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/admin/cities', { credentials: 'same-origin' })
      if (!response.ok) {
        throw new Error(`CITY_REGISTRY_LOAD_FAILED:${response.status}`)
      }
      const payload = await response.json()
      setRegistry(payload)
      await loadCacheStatus()
    } catch (loadError) {
      setError(String(loadError?.message ?? 'CITY_REGISTRY_LOAD_FAILED'))
    } finally {
      setLoading(false)
    }
  }, [loadCacheStatus])

  useEffect(() => {
    loadCacheStatus()
  }, [loadCacheStatus])

  const cities = useMemo(() => buildCityCards(registry ?? {}), [registry])
  const registryCityIndex = useMemo(
    () =>
      new Map(
        cities.map((city) => [city.id, city]),
      ),
    [cities],
  )
  const ws2CatalogRows = useMemo(
    () =>
      ws2MunicipalityCatalog.map((entry) => {
        const registryMatch =
          registryCityIndex.get(entry.registryId) ??
          cities.find((city) => city.name.toLowerCase() === String(entry.cityName).toLowerCase()) ??
          null

        return {
          ...entry,
          registryMatch,
        }
      }),
    [cities, registryCityIndex],
  )
  const cacheIndex = useMemo(
    () =>
      cacheStatus.reduce((accumulator, item) => {
        accumulator[item.cityId] = item
        return accumulator
      }, {}),
    [cacheStatus],
  )
  const enabledCount = cities.filter((city) => city.enabled).length
  const preloadedCount = cities.filter((city) => city.preloaded).length
  const activeCity = cities.find((city) => city.isActive) ?? currentCity ?? null
  const adminMetrics = useMemo(() => getAdminMetrics(activeCity), [activeCity])
  const adminActivity = useMemo(() => getAdminActivity(activeCity), [activeCity])
  const providerOptions = useMemo(() => providerRegistry.providers ?? [], [providerRegistry])

  const loadProviderOps = useCallback(async (cityId) => {
    if (!cityId) return
    try {
      const [providersResponse, layersResponse, jobsResponse] = await Promise.all([
        fetch('/api/admin/providers', { credentials: 'same-origin' }),
        fetch(`/api/admin/cities/${cityId}/layers`, { credentials: 'same-origin' }),
        fetch(`/api/admin/cities/${cityId}/layer-ingestion-jobs?limit=8`, { credentials: 'same-origin' }),
      ])
      if (!providersResponse.ok) throw new Error(`PROVIDER_REGISTRY_LOAD_FAILED:${providersResponse.status}`)
      if (!layersResponse.ok) throw new Error(`CITY_LAYER_REGISTRY_LOAD_FAILED:${layersResponse.status}`)
      if (!jobsResponse.ok) throw new Error(`CITY_LAYER_JOBS_LOAD_FAILED:${jobsResponse.status}`)
      const [providersPayload, layersPayload, jobsPayload] = await Promise.all([
        providersResponse.json(),
        layersResponse.json(),
        jobsResponse.json(),
      ])
      setProviderRegistry(providersPayload)
      setCityLayers(Array.isArray(layersPayload.layers) ? layersPayload.layers : [])
      setLayerJobs(Array.isArray(jobsPayload.jobs) ? jobsPayload.jobs : [])
    } catch (loadError) {
      setError(String(loadError?.message ?? 'PROVIDER_LAYER_OPS_LOAD_FAILED'))
    }
  }, [])

  useEffect(() => {
    if (activeCity?.id) {
      loadProviderOps(activeCity.id)
    }
  }, [activeCity?.id, loadProviderOps])

  const updateCity = (cityId, patch = {}) => {
    setRegistry((current) => {
      if (!current) return current
      return {
        ...current,
        cities: current.cities.map((city) => (city.id === cityId ? { ...city, ...patch } : city)),
      }
    })
    setSuccess('')
  }

  const setActiveCity = (cityId) => {
    setRegistry((current) => {
      if (!current) return current
      return {
        ...current,
        activeCityId: cityId,
        cities: current.cities.map((city) => (city.id === cityId ? { ...city, enabled: true } : city)),
      }
    })
    setSelectedCityId(cityId)
    setSuccess('')
  }

  const updateDraft = (field, value) => {
    setDraftCity((current) => ({
      ...current,
      [field]: value,
    }))
    setSuccess('')
  }

  const updateProviderDraft = (field, value) => {
    setProviderDraft((current) => ({ ...current, [field]: value }))
    setSuccess('')
  }

  const updateLayerDraft = (field, value) => {
    setLayerDraft((current) => ({ ...current, [field]: value }))
    setSuccess('')
  }

  const updateIngestionDraft = (field, value) => {
    setIngestionDraft((current) => ({ ...current, [field]: value }))
    setSuccess('')
  }

  const saveProvider = async () => {
    try {
      setProviderSaving(true)
      setError('')
      setSuccess('')
      const providerId = slugifyCityId(providerDraft.id || providerDraft.name)
      if (!providerId || !providerDraft.name.trim()) {
        throw new Error('PROVIDER_DRAFT_INVALID')
      }
      const connectorKey = slugifyCityId(providerDraft.connectorKey || providerDraft.name)
      const response = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          id: providerId,
          name: providerDraft.name.trim(),
          providerType: providerDraft.providerType,
          connectors: connectorKey ? [{
            connectorKey,
            displayName: providerDraft.connectorKey || `${providerDraft.name} connector`,
            connectorType: providerDraft.connectorType,
            supportedFormats: providerDraft.supportedFormats.split(',').map((item) => item.trim()).filter(Boolean),
            endpointUrl: providerDraft.endpointUrl || null,
            status: 'draft',
          }] : [],
        }),
      })
      if (!response.ok) throw new Error(`PROVIDER_SAVE_FAILED:${response.status}`)
      setProviderDraft(emptyProviderDraft)
      await loadProviderOps(activeCity?.id)
      setSuccess(`Provider ${providerDraft.name} registered.`)
    } catch (saveError) {
      setError(String(saveError?.message ?? 'PROVIDER_SAVE_FAILED'))
    } finally {
      setProviderSaving(false)
    }
  }

  const saveProviderLayer = async () => {
    try {
      setLayerSaving(true)
      setError('')
      setSuccess('')
      if (!activeCity?.id) throw new Error('ACTIVE_CITY_REQUIRED')
      const layerKey = slugifyCityId(layerDraft.key || layerDraft.name)
      if (!layerKey || !layerDraft.name.trim()) throw new Error('LAYER_DRAFT_INVALID')
      const response = await fetch(`/api/admin/cities/${activeCity.id}/layers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          key: layerKey,
          name: layerDraft.name.trim(),
          providerId: layerDraft.providerId || null,
          layerFamily: layerDraft.layerFamily,
          geometryType: layerDraft.geometryType,
          accessLevel: layerDraft.accessLevel,
          authorityStatus: 'provider-supplied',
          semanticStatus: 'source-layer',
          updateFrequency: 'provider-managed',
        }),
      })
      if (!response.ok) throw new Error(`LAYER_SAVE_FAILED:${response.status}`)
      setLayerDraft(emptyLayerDraft)
      await loadProviderOps(activeCity.id)
      setSuccess(`Layer ${layerDraft.name} registered for ${activeCity.name}.`)
    } catch (saveError) {
      setError(String(saveError?.message ?? 'LAYER_SAVE_FAILED'))
    } finally {
      setLayerSaving(false)
    }
  }

  const ingestProviderLayer = async () => {
    try {
      setIngestingLayer(true)
      setError('')
      setSuccess('')
      if (!activeCity?.id) throw new Error('ACTIVE_CITY_REQUIRED')
      const layerKey = slugifyCityId(ingestionDraft.layerKey)
      if (!layerKey) throw new Error('INGESTION_LAYER_REQUIRED')
      const endpointByMode = {
        csv: 'ingest-csv',
        geojson: 'ingest-geojson',
        ogc: 'ingest-ogc-features',
        cityjson: 'ingest-cityjson',
        stac: 'ingest-stac',
        package: 'register-package',
      }
      const endpoint = endpointByMode[ingestionDraft.mode] ?? 'ingest-csv'
      const body =
        ingestionDraft.mode === 'csv'
          ? {
              sourceUri: ingestionDraft.sourceUri || null,
              csvText: ingestionDraft.csvText || undefined,
              latitudeField: ingestionDraft.latitudeField || undefined,
              longitudeField: ingestionDraft.longitudeField || undefined,
              replaceExisting: true,
              submittedBy: 'admin-ui',
            }
          : {
              sourceUri: ingestionDraft.sourceUri,
              sourceFormat: ingestionDraft.mode === 'package' ? ingestionDraft.packageFormat : undefined,
              metadata: ingestionDraft.mode === 'package' ? { registeredFrom: 'admin-ui' } : undefined,
              replaceExisting: true,
              submittedBy: 'admin-ui',
            }
      const response = await fetch(`/api/admin/cities/${activeCity.id}/layers/${layerKey}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(`LAYER_INGEST_FAILED:${response.status}`)
      const payload = await response.json()
      await loadProviderOps(activeCity.id)
      setSuccess(`Ingested ${payload.stats?.featuresInserted ?? 0} features into ${layerKey}.`)
    } catch (ingestError) {
      setError(String(ingestError?.message ?? 'LAYER_INGEST_FAILED'))
    } finally {
      setIngestingLayer(false)
    }
  }

  const queueProviderLayerJob = async () => {
    try {
      setIngestingLayer(true)
      setError('')
      setSuccess('')
      if (!activeCity?.id) throw new Error('ACTIVE_CITY_REQUIRED')
      const layerKey = slugifyCityId(ingestionDraft.layerKey)
      if (!layerKey) throw new Error('INGESTION_LAYER_REQUIRED')
      const actionByMode = {
        csv: 'csv',
        geojson: 'geojson',
        ogc: 'ogc-features',
        stac: 'stac',
        cityjson: 'cityjson',
        package: 'package',
      }
      const body =
        ingestionDraft.mode === 'csv'
          ? {
              action: 'csv',
              sourceUri: ingestionDraft.sourceUri || null,
              csvText: ingestionDraft.csvText || undefined,
              latitudeField: ingestionDraft.latitudeField || undefined,
              longitudeField: ingestionDraft.longitudeField || undefined,
              replaceExisting: true,
              submittedBy: 'admin-ui',
            }
          : {
              action: actionByMode[ingestionDraft.mode] ?? 'geojson',
              sourceUri: ingestionDraft.sourceUri,
              sourceFormat: ingestionDraft.mode === 'package' ? ingestionDraft.packageFormat : undefined,
              metadata: ingestionDraft.mode === 'package' ? { registeredFrom: 'admin-ui' } : undefined,
              replaceExisting: true,
              submittedBy: 'admin-ui',
            }
      const response = await fetch(`/api/admin/cities/${activeCity.id}/layers/${layerKey}/ingestion-jobs/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error(`INGESTION_JOB_QUEUE_FAILED:${response.status}`)
      const payload = await response.json()
      await loadProviderOps(activeCity.id)
      setSuccess(`Queued ingestion job ${payload.jobId}.`)
    } catch (queueError) {
      setError(String(queueError?.message ?? 'INGESTION_JOB_QUEUE_FAILED'))
    } finally {
      setIngestingLayer(false)
    }
  }

  const addCatalogCity = (entry) => {
    const nextCity = buildRegistryCityFromCatalogEntry(entry, registry?.cities ?? [])

    setRegistry((current) => {
      if (!current) return current
      return {
        ...current,
        cities: [...current.cities, nextCity],
      }
    })
    setSuccess(`Added ${entry.cityName} from the WS2 municipality catalog as a draft city. Save the city registry to make it live.`)
    setError('')
  }

  const addDraftCity = () => {
    const name = draftCity.name.trim()
    const country = draftCity.country.trim()

    if (!name || !country) {
      setError('CITY_REGISTRY_DRAFT_INVALID: name and country are required.')
      return
    }

    const nextId = ensureUniqueCityId(slugifyCityId(name), registry?.cities ?? [])
    const nextCity = {
      ...draftCity,
      id: nextId,
      name,
      country,
      countryCode: draftCity.countryCode.trim().toLowerCase(),
      region: draftCity.region.trim(),
      nominatimQuery: draftCity.nominatimQuery.trim() || `${name}, ${country}`,
      municipalityTitle: draftCity.municipalityTitle.trim() || name,
      municipalityDescription: draftCity.municipalityDescription.trim() || 'Municipal authority territory',
      lat: Number(draftCity.lat || 0),
      lon: Number(draftCity.lon || 0),
      enabled: false,
      preloaded: false,
      spotlight: false,
    }

    setRegistry((current) => {
      if (!current) return current
      return {
        ...current,
        cities: [...current.cities, nextCity],
      }
    })
    setDraftCity(emptyDraft)
    setError('')
    setSuccess(`Draft city ${name} added to the registry. Save the city registry to make it live.`)
  }

  const cloneCity = (city) => {
    const copyBaseName = `${city.name} Copy`
    const existingNames = new Set((registry?.cities ?? []).map((item) => item.name))
    let nextName = copyBaseName
    let counter = 2
    while (existingNames.has(nextName)) {
      nextName = `${copyBaseName} ${counter}`
      counter += 1
    }

    const nextCity = {
      ...city,
      id: ensureUniqueCityId(slugifyCityId(nextName), registry?.cities ?? []),
      name: nextName,
      twinLabel: `${nextName} Digital Twin`,
      enabled: false,
      preloaded: false,
      spotlight: false,
    }

    setRegistry((current) => {
      if (!current) return current
      return {
        ...current,
        cities: [...current.cities, nextCity],
      }
    })
    setSuccess(`Draft clone created from ${city.name}. Save the city registry to make it persistent.`)
    setError('')
  }

  const deleteDraftCity = (cityId) => {
    setRegistry((current) => {
      if (!current) return current
      const nextCities = current.cities.filter((city) => city.id !== cityId)
      const nextActiveCityId =
        current.activeCityId === cityId ? nextCities.find((city) => city.enabled)?.id ?? nextCities[0]?.id ?? '' : current.activeCityId
      return {
        ...current,
        activeCityId: nextActiveCityId,
        cities: nextCities,
      }
    })
    setSuccess('Draft city removed from the registry. Save the city registry to persist the change.')
    setError('')
  }

  const preloadCity = async (cityId, refresh = false) => {
    try {
      setPreloadingCityId(cityId)
      setError('')
      setSuccess('')
      const response = await fetch(`/api/admin/cities/${cityId}/preload${refresh ? '?refresh=1' : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ refresh }),
      })
      if (!response.ok) {
        throw new Error(`CITY_PRELOAD_FAILED:${response.status}`)
      }
      const payload = await response.json()
      await loadCacheStatus()
      setSuccess(`${refresh ? 'Refreshed' : 'Preloaded'} live cache for ${cityId}. Latest payload: ${payload.fetchedAt ?? 'unknown time'}.`)
    } catch (preloadError) {
      setError(String(preloadError?.message ?? 'CITY_PRELOAD_FAILED'))
    } finally {
      setPreloadingCityId('')
    }
  }

  const saveRegistry = async () => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')
      const response = await fetch('/api/admin/cities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(registry),
      })
      if (!response.ok) {
        throw new Error(`CITY_REGISTRY_SAVE_FAILED:${response.status}`)
      }
      const payload = await response.json()
      setRegistry(payload)
      setSelectedCityId(payload.activeCityId)
      await refreshPlatformContext()
      await loadCacheStatus()
      setSuccess('City registry saved. The active city and enabled workspace list are now updated.')
    } catch (saveError) {
      setError(String(saveError?.message ?? 'CITY_REGISTRY_SAVE_FAILED'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="hk-pg-body py-0">
      <DesktopFirstGate
        description="City registry, cache controls, and platform administration work best on desktop."
        surfaceName="Platform administration"
      />
      <Container fluid="xxl" className="py-4">
        <TwinModuleHeader
          eyebrow="Platform administration"
          sidebarOpen
          statusLabel={activeCity ? `${activeCity.name} active` : 'Registry review'}
          summary="Choose which preloaded cities are available in the platform, set the active city, and keep the platformita light with a file-backed registry backed by a runtime cache."
          title="City registry and platform control"
        />

        <Row className="g-3 mb-4">
          <Col xl={3} md={6}>
            <Card className="card-border h-100">
              <Card.Body>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Active city</div>
                <h3 className="mb-2">{activeCity?.name ?? 'Pending'}</h3>
                <p className="mb-0">{activeCity ? `${activeCity.region}, ${activeCity.country}` : 'No city selected yet.'}</p>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={3} md={6}>
            <Card className="card-border h-100">
              <Card.Body>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Enabled cities</div>
                <h3 className="mb-2">{enabledCount}</h3>
                <p className="mb-0">Only enabled cities can become the active workspace.</p>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={3} md={6}>
            <Card className="card-border h-100">
              <Card.Body>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Preloaded cities</div>
                <h3 className="mb-2">{preloadedCount}</h3>
                <p className="mb-0">Starter city set kept locally for lightweight operations.</p>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={3} md={6}>
            <Card className="card-border h-100">
              <Card.Body>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Registry mode</div>
                <h3 className="mb-2">File + cache</h3>
                <p className="mb-0">No database required yet. The live platform reads a light registry and keeps the active-city state hot in runtime.</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {error ? <Alert variant="danger">{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        <Row className="g-3 mb-4">
          <Col xl={8}>
            <Card className="card-border">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">City registry</div>
                  <h5 className="mb-0">Preloaded workspace cities</h5>
                </div>
                <div className="d-flex gap-2">
                  <Button onClick={loadRegistry} variant="outline-light">
                    Reload
                  </Button>
                  <Button disabled={!registry || loading || saving} onClick={saveRegistry} variant="primary">
                    {saving ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Saving
                      </>
                    ) : (
                      'Save city registry'
                    )}
                  </Button>
                </div>
              </Card.Header>
              <Card.Body>
                {loading ? (
                  <div className="py-5 text-center text-muted">Loading city registry…</div>
                ) : (
                  <Row className="g-3">
                    {cities.map((city) => {
                      const cache = cacheIndex[city.id]
                      return (
                      <Col lg={6} key={city.id}>
                        <Card className="card-border h-100">
                          <Card.Body>
                            <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
                              <div>
                                <h5 className="mb-1">{city.name}</h5>
                                <p className="mb-0">{city.region}, {city.country}</p>
                              </div>
                              <div className="d-flex flex-wrap gap-2">
                                {city.isActive ? <Badge bg="primary">Active</Badge> : null}
                                {city.enabled ? <Badge bg="success">Enabled</Badge> : <Badge bg="secondary">Hidden</Badge>}
                                {city.preloaded ? <Badge bg="dark">Preloaded</Badge> : null}
                                {cache?.exists ? (
                                  <Badge bg={cache.stale ? 'warning' : 'info'} text={cache.stale ? 'dark' : undefined}>
                                    {cache.stale ? 'Cache stale' : 'Cache ready'}
                                  </Badge>
                                ) : (
                                  <Badge bg="secondary">No cache</Badge>
                                )}
                              </div>
                            </div>

                            <div className="dt-bullet-stack mb-3">
                              <div className="dt-bullet"><strong>Twin label.</strong> {getCityWorkspaceLabel(city)}</div>
                              <div className="dt-bullet"><strong>Query.</strong> {city.nominatimQuery}</div>
                              <div className="dt-bullet"><strong>Coordinates.</strong> {city.lat}, {city.lon}</div>
                              <div className="dt-bullet"><strong>Cache.</strong> {cache?.exists ? `${cache.stale ? 'Stale' : 'Ready'} · ${cache.rendered} rendered / ${cache.discovered} discovered` : 'Not preloaded yet'}</div>
                              <div className="dt-bullet"><strong>Latest payload.</strong> {cache?.fetchedAt ? new Date(cache.fetchedAt).toLocaleString() : 'No cache file yet'}</div>
                            </div>

                            <div className="d-flex flex-column gap-3">
                              <Form.Check
                                checked={Boolean(city.enabled)}
                                id={`city-enabled-${city.id}`}
                                label="Available in the platform"
                                onChange={(event) => updateCity(city.id, { enabled: event.target.checked })}
                                type="switch"
                              />
                              <div className="d-flex flex-wrap gap-2">
                                <Button
                                  disabled={!city.enabled}
                                  onClick={() => setActiveCity(city.id)}
                                  variant={city.isActive ? 'primary' : 'outline-light'}
                                >
                                  {city.isActive ? 'Current active city' : 'Set as active city'}
                                </Button>
                                <Button
                                  disabled={preloadingCityId === city.id}
                                  onClick={() => preloadCity(city.id, false)}
                                  variant="outline-light"
                                >
                                  {preloadingCityId === city.id ? 'Preloading…' : 'Preload cache'}
                                </Button>
                                <Button
                                  disabled={preloadingCityId === city.id}
                                  onClick={() => preloadCity(city.id, true)}
                                  variant="outline-light"
                                >
                                  {preloadingCityId === city.id ? 'Refreshing…' : 'Refresh cache'}
                                </Button>
                                <Button onClick={() => cloneCity(city)} variant="outline-light">
                                  Clone config
                                </Button>
                                {!city.preloaded ? (
                                  <Button onClick={() => deleteDraftCity(city.id)} variant="outline-danger">
                                    Delete draft
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                      )
                    })}
                  </Row>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col xl={4}>
            <Card className="card-border mb-3">
              <Card.Header>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Operational posture</div>
                <h5 className="mb-0">Platform administration notes</h5>
              </Card.Header>
              <Card.Body className="dt-bullet-stack">
                <div className="dt-bullet">The registry active city defines the default workspace, but users can still choose among enabled cities at login and signup.</div>
                <div className="dt-bullet">Disabled cities stay preloaded but do not appear in the auth city selector.</div>
                <div className="dt-bullet">This registry is intentionally light. It can later be synchronized from Polisplexity proper.</div>
              </Card.Body>
            </Card>

            <Card className="card-border mb-3">
              <Card.Header>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Add city</div>
                <h5 className="mb-0">Light registry onboarding</h5>
              </Card.Header>
              <Card.Body>
                <Form className="d-grid gap-3">
                  <Row className="g-2">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>City name</Form.Label>
                        <Form.Control
                          onChange={(event) => updateDraft('name', event.target.value)}
                          placeholder="Tallinn"
                          value={draftCity.name}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Country</Form.Label>
                        <Form.Control
                          onChange={(event) => updateDraft('country', event.target.value)}
                          placeholder="Estonia"
                          value={draftCity.country}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Country code</Form.Label>
                        <Form.Control
                          maxLength={3}
                          onChange={(event) => updateDraft('countryCode', event.target.value)}
                          placeholder="ee"
                          value={draftCity.countryCode}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={8}>
                      <Form.Group>
                        <Form.Label>Region</Form.Label>
                        <Form.Control
                          onChange={(event) => updateDraft('region', event.target.value)}
                          placeholder="Harju County"
                          value={draftCity.region}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Latitude</Form.Label>
                        <Form.Control
                          onChange={(event) => updateDraft('lat', event.target.value)}
                          placeholder="59.437"
                          value={draftCity.lat}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Longitude</Form.Label>
                        <Form.Control
                          onChange={(event) => updateDraft('lon', event.target.value)}
                          placeholder="24.7536"
                          value={draftCity.lon}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label>Nominatim query</Form.Label>
                        <Form.Control
                          onChange={(event) => updateDraft('nominatimQuery', event.target.value)}
                          placeholder="Tallinn, Estonia"
                          value={draftCity.nominatimQuery}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label>Municipality title</Form.Label>
                        <Form.Control
                          onChange={(event) => updateDraft('municipalityTitle', event.target.value)}
                          placeholder="Tallinn"
                          value={draftCity.municipalityTitle}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={12}>
                      <Form.Group>
                        <Form.Label>Municipality description</Form.Label>
                        <Form.Control
                          onChange={(event) => updateDraft('municipalityDescription', event.target.value)}
                          placeholder="Capital city of Estonia"
                          value={draftCity.municipalityDescription}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Button onClick={addDraftCity} type="button" variant="outline-light">
                    Add city draft
                  </Button>
                </Form>
              </Card.Body>
            </Card>

            <Card className="card-border">
              <Card.Header>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Restricted tools</div>
                <h5 className="mb-0">Template surfaces still available for admin</h5>
              </Card.Header>
              <Card.Body className="d-grid gap-2">
                {adminToolLinks.map((tool) => (
                  <Link className="btn btn-outline-light text-start" href={tool.href} key={tool.href}>
                    {tool.label}
                  </Link>
                ))}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-3 mb-4">
          <Col xl={4}>
            <Card className="card-border h-100">
              <Card.Header>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Providers</div>
                <h5 className="mb-0">Register a data provider</h5>
              </Card.Header>
              <Card.Body>
                <Form className="d-grid gap-3">
                  <Form.Group>
                    <Form.Label>Provider name</Form.Label>
                    <Form.Control
                      onChange={(event) => updateProviderDraft('name', event.target.value)}
                      placeholder="Fire Department"
                      value={providerDraft.name}
                    />
                  </Form.Group>
                  <Row className="g-2">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Provider ID</Form.Label>
                        <Form.Control
                          onChange={(event) => updateProviderDraft('id', event.target.value)}
                          placeholder="fire-department"
                          value={providerDraft.id}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Type</Form.Label>
                        <Form.Control
                          onChange={(event) => updateProviderDraft('providerType', event.target.value)}
                          value={providerDraft.providerType}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Row className="g-2">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Connector</Form.Label>
                        <Form.Control
                          onChange={(event) => updateProviderDraft('connectorKey', event.target.value)}
                          placeholder="stations-csv"
                          value={providerDraft.connectorKey}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Connector type</Form.Label>
                        <Form.Select
                          onChange={(event) => updateProviderDraft('connectorType', event.target.value)}
                          value={providerDraft.connectorType}
                        >
                          <option value="upload">Upload</option>
                          <option value="api">API</option>
                          <option value="ogc-api-features">OGC API Features</option>
                          <option value="ogc-wfs">WFS</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                  <Form.Group>
                    <Form.Label>Formats</Form.Label>
                    <Form.Control
                      onChange={(event) => updateProviderDraft('supportedFormats', event.target.value)}
                      value={providerDraft.supportedFormats}
                    />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Endpoint URL</Form.Label>
                    <Form.Control
                      onChange={(event) => updateProviderDraft('endpointUrl', event.target.value)}
                      placeholder="https://example.org/collections/stations/items"
                      value={providerDraft.endpointUrl}
                    />
                  </Form.Group>
                  <Button disabled={providerSaving} onClick={saveProvider} type="button" variant="outline-light">
                    {providerSaving ? 'Saving provider…' : 'Save provider'}
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          </Col>

          <Col xl={4}>
            <Card className="card-border h-100">
              <Card.Header>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Layers</div>
                <h5 className="mb-0">Register a provider layer</h5>
              </Card.Header>
              <Card.Body>
                <Form className="d-grid gap-3">
                  <Form.Group>
                    <Form.Label>Layer name</Form.Label>
                    <Form.Control
                      onChange={(event) => updateLayerDraft('name', event.target.value)}
                      placeholder="Fire Stations"
                      value={layerDraft.name}
                    />
                  </Form.Group>
                  <Row className="g-2">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Layer key</Form.Label>
                        <Form.Control
                          onChange={(event) => updateLayerDraft('key', event.target.value)}
                          placeholder="fire-stations"
                          value={layerDraft.key}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Geometry</Form.Label>
                        <Form.Select
                          onChange={(event) => updateLayerDraft('geometryType', event.target.value)}
                          value={layerDraft.geometryType}
                        >
                          <option value="Geometry">Geometry</option>
                          <option value="Point">Point</option>
                          <option value="LineString">LineString</option>
                          <option value="Polygon">Polygon</option>
                          <option value="MultiPolygon">MultiPolygon</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                  <Form.Group>
                    <Form.Label>Provider</Form.Label>
                    <Form.Select
                      onChange={(event) => updateLayerDraft('providerId', event.target.value)}
                      value={layerDraft.providerId}
                    >
                      <option value="">No provider selected</option>
                      {providerOptions.map((provider) => (
                        <option key={provider.id} value={provider.id}>{provider.name}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Row className="g-2">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Family</Form.Label>
                        <Form.Control
                          onChange={(event) => updateLayerDraft('layerFamily', event.target.value)}
                          value={layerDraft.layerFamily}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Access</Form.Label>
                        <Form.Select
                          onChange={(event) => updateLayerDraft('accessLevel', event.target.value)}
                          value={layerDraft.accessLevel}
                        >
                          <option value="city-private">City private</option>
                          <option value="public-open-data">Public open data</option>
                          <option value="restricted-provider">Restricted provider</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                  <Button disabled={layerSaving || !activeCity?.id} onClick={saveProviderLayer} type="button" variant="outline-light">
                    {layerSaving ? 'Saving layer…' : `Save layer${activeCity?.name ? ` for ${activeCity.name}` : ''}`}
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          </Col>

          <Col xl={4}>
            <Card className="card-border h-100">
              <Card.Header>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Ingestion</div>
                <h5 className="mb-0">Load provider data</h5>
              </Card.Header>
              <Card.Body>
                <Form className="d-grid gap-3">
                  <Form.Group>
                    <Form.Label>Layer</Form.Label>
                    <Form.Select
                      onChange={(event) => updateIngestionDraft('layerKey', event.target.value)}
                      value={ingestionDraft.layerKey}
                    >
                      <option value="">Select layer</option>
                      {cityLayers.map((layer) => (
                        <option key={layer.key} value={layer.key}>{layer.name} · {layer.key}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Mode</Form.Label>
                    <Form.Select
                      onChange={(event) => updateIngestionDraft('mode', event.target.value)}
                      value={ingestionDraft.mode}
                    >
                      <option value="csv">CSV</option>
                      <option value="geojson">GeoJSON</option>
                      <option value="ogc">OGC API Features / WFS GeoJSON</option>
                      <option value="stac">STAC item / collection</option>
                      <option value="cityjson">CityJSON object centroids</option>
                      <option value="package">Raster / BIM / IoT / package metadata</option>
                    </Form.Select>
                  </Form.Group>
                  {ingestionDraft.mode === 'package' ? (
                    <Form.Group>
                      <Form.Label>Package format</Form.Label>
                      <Form.Select
                        onChange={(event) => updateIngestionDraft('packageFormat', event.target.value)}
                        value={ingestionDraft.packageFormat}
                      >
                        <option value="raster-cog">Raster COG</option>
                        <option value="stac">STAC item/catalog</option>
                        <option value="wms">WMS service</option>
                        <option value="sensor-feed">Sensor feed</option>
                        <option value="mqtt">MQTT feed</option>
                        <option value="http-json">HTTP JSON feed</option>
                        <option value="bim-package">BIM package</option>
                        <option value="ifc">IFC</option>
                        <option value="cityjson">CityJSON</option>
                        <option value="3d-tiles">3D Tiles</option>
                        <option value="shapefile">Shapefile package</option>
                        <option value="geopackage">GeoPackage</option>
                      </Form.Select>
                    </Form.Group>
                  ) : null}
                  <Form.Group>
                    <Form.Label>Source URI</Form.Label>
                    <Form.Control
                      onChange={(event) => updateIngestionDraft('sourceUri', event.target.value)}
                      placeholder="https://example.org/collections/layer/items"
                      value={ingestionDraft.sourceUri}
                    />
                  </Form.Group>
                  {ingestionDraft.mode === 'csv' ? (
                    <>
                      <Row className="g-2">
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label>Latitude field</Form.Label>
                            <Form.Control
                              onChange={(event) => updateIngestionDraft('latitudeField', event.target.value)}
                              value={ingestionDraft.latitudeField}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label>Longitude field</Form.Label>
                            <Form.Control
                              onChange={(event) => updateIngestionDraft('longitudeField', event.target.value)}
                              value={ingestionDraft.longitudeField}
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                      <Form.Group>
                        <Form.Label>CSV text</Form.Label>
                        <Form.Control
                          as="textarea"
                          onChange={(event) => updateIngestionDraft('csvText', event.target.value)}
                          placeholder={'id,name,lat,lon\nstation-001,Central,57.0746,24.3297'}
                          rows={4}
                          value={ingestionDraft.csvText}
                        />
                      </Form.Group>
                    </>
                  ) : null}
                  <div className="d-flex flex-wrap gap-2">
                    <Button disabled={ingestingLayer || !activeCity?.id} onClick={queueProviderLayerJob} type="button" variant="outline-light">
                      {ingestingLayer ? 'Queueing…' : 'Queue job'}
                    </Button>
                    <Button disabled={ingestingLayer || !activeCity?.id} onClick={ingestProviderLayer} type="button" variant="primary">
                      {ingestingLayer ? 'Ingesting…' : 'Ingest now'}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>

          <Col xl={12}>
            <Card className="card-border">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Provider layer status</div>
                  <h5 className="mb-0">{activeCity?.name ?? 'Active city'} layer registry</h5>
                </div>
                <Button onClick={() => loadProviderOps(activeCity?.id)} variant="outline-light">Reload layers</Button>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>Layer</th>
                        <th>Provider</th>
                        <th>Family</th>
                        <th>Geometry</th>
                        <th>Features</th>
                        <th>Latest job</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cityLayers.map((layer) => {
                        const latestJob = layerJobs.find((job) => job.layer?.key === layer.key)
                        return (
                          <tr key={layer.key}>
                            <td>
                              <strong>{layer.name}</strong>
                              <div className="text-muted fs-8">{layer.key}</div>
                            </td>
                            <td>{layer.provider?.name ?? 'Base / unassigned'}</td>
                            <td>{layer.layerFamily}</td>
                            <td>{layer.geometryType}</td>
                            <td>{layer.featureCount}</td>
                            <td>{latestJob ? `${latestJob.status} · ${latestJob.sourceFormat}` : 'No provider job'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-3 mb-4">
          <Col xl={12}>
            <Card className="card-border">
              <Card.Header>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">WS2 municipality catalog</div>
                <h5 className="mb-0">Prospect cities and contacts from the LDT4SSC WS2 working documentation</h5>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>City</th>
                        <th>Country</th>
                        <th>Organisation</th>
                        <th>Contact</th>
                        <th>Suggested role</th>
                        <th>Registry</th>
                        <th className="text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ws2CatalogRows.map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <strong>{entry.cityName}</strong>
                            <div className="text-muted fs-8">{entry.municipalityTitle}</div>
                          </td>
                          <td>{entry.country}</td>
                          <td>
                            <strong>{entry.organisation}</strong>
                            <div className="text-muted fs-8">{entry.region}</div>
                          </td>
                          <td>
                            <strong>{entry.contactName}</strong>
                            <div className="text-muted fs-8">{entry.contactRole}</div>
                          </td>
                          <td>{entry.recommendedUse}</td>
                          <td>
                            {entry.registryMatch ? (
                              <div className="d-flex flex-column gap-1">
                                <Badge bg={entry.registryMatch.enabled ? 'success' : 'secondary'}>
                                  {entry.registryMatch.enabled ? 'Enabled' : 'Draft / hidden'}
                                </Badge>
                                <span className="text-muted fs-8">{entry.registryMatch.name}</span>
                              </div>
                            ) : (
                              <Badge bg="dark">Not in registry</Badge>
                            )}
                          </td>
                          <td className="text-end">
                            {entry.registryMatch ? (
                              <Button
                                onClick={() => setActiveCity(entry.registryMatch.id)}
                                size="sm"
                                variant={entry.registryMatch.enabled ? 'outline-light' : 'outline-secondary'}
                              >
                                Set active
                              </Button>
                            ) : (
                              <Button onClick={() => addCatalogCity(entry)} size="sm" variant="outline-light">
                                Add to registry
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <Row className="g-3 mb-4">
          {adminMetrics.map((metric) => (
            <Col xl={3} md={6} key={metric.label}>
              <Card className="card-border h-100">
                <Card.Body>
                  <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">{metric.label}</div>
                  <h3 className="mb-2">{metric.value}</h3>
                  <p className="mb-0">{metric.note}</p>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        <Card className="card-border">
          <Card.Header>
            <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Recent platform activity</div>
            <h5 className="mb-0">Latest visible routes</h5>
          </Card.Header>
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table hover responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Viewer</th>
                    <th>Surface</th>
                    <th>Focus</th>
                    <th>Last seen</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {adminActivity.map((activity) => (
                    <tr key={`${activity.viewer}-${activity.surface}`}>
                      <td>{activity.viewer}</td>
                      <td>{activity.surface}</td>
                      <td>{activity.focus}</td>
                      <td>{activity.lastSeen}</td>
                      <td>{activity.status}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      </Container>
    </div>
  )
}
