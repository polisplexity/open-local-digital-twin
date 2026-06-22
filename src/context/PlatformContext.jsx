'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const CITY_SELECTION_STORAGE_KEY = 'twinSelectedCityId'

const defaultContext = {
  workspaceName: 'Twin Base Studio',
  brandName: 'Polisplexity',
  registryActiveCityId: 'adazi',
  registryActiveCity: null,
  selectedCityId: '',
  selectedCity: null,
  availableCities: [],
  activeCityId: 'adazi',
  activeCity: null,
  cities: [],
  authenticated: false,
  currentUser: null,
  allowedCityIds: [],
}

const PlatformContext = createContext({
  loading: true,
  error: '',
  ...defaultContext,
  refreshPlatformContext: async () => {},
  setSelectedCityId: () => {},
})

function normalizeServerContext(payload = {}) {
  return {
    workspaceName: payload.workspaceName ?? defaultContext.workspaceName,
    brandName: payload.brandName ?? defaultContext.brandName,
    registryActiveCityId: payload.activeCityId ?? defaultContext.registryActiveCityId,
    registryActiveCity: payload.activeCity ?? null,
    cities: Array.isArray(payload.cities) ? payload.cities : [],
    authenticated: Boolean(payload.authenticated),
    currentUser: payload.currentUser ?? null,
    allowedCityIds: Array.isArray(payload.allowedCityIds) ? payload.allowedCityIds : [],
  }
}

function resolveContext(serverContext = defaultContext, selectedCityId = '') {
  const cities = Array.isArray(serverContext.cities) ? serverContext.cities : []
  const isAdmin = Boolean(serverContext.currentUser?.roles?.includes('platform-admin'))
  const availableCities =
    serverContext.authenticated && !isAdmin && Array.isArray(serverContext.allowedCityIds) && serverContext.allowedCityIds.length
      ? cities.filter((city) => city.enabled !== false && serverContext.allowedCityIds.includes(city.id))
      : cities.filter((city) => city.enabled !== false)
  const registryActiveCity =
    serverContext.registryActiveCity ??
    cities.find((city) => city.id === serverContext.registryActiveCityId) ??
    null
  const selectedCity =
    availableCities.find((city) => city.id === selectedCityId) ??
    null
  const fallbackCity =
    availableCities.find((city) => city.id === serverContext.registryActiveCityId) ??
    availableCities[0] ??
    registryActiveCity ??
    cities[0] ??
    null
  const activeCity = selectedCity ?? fallbackCity

  return {
    ...serverContext,
    availableCities,
    selectedCityId: selectedCity?.id ?? '',
    selectedCity,
    activeCityId: activeCity?.id ?? serverContext.registryActiveCityId,
    activeCity,
  }
}

export function PlatformContextProvider({ children, initialContext }) {
  const hasInitialContext = Boolean(initialContext && (initialContext.activeCity || initialContext.cities?.length))
  const [serverContext, setServerContext] = useState(
    normalizeServerContext(hasInitialContext ? initialContext : defaultContext),
  )
  const [selectedCityId, setSelectedCityIdState] = useState('')
  const [loading, setLoading] = useState(!hasInitialContext)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CITY_SELECTION_STORAGE_KEY)
      if (stored) {
        setSelectedCityIdState(stored)
      }
    } catch {
      // Ignore storage access failures and fall back to the registry default.
    }
  }, [])

  const refreshPlatformContext = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true)
        setError('')
      }
      const response = await fetch('/api/platform/context', { credentials: 'same-origin' })
      if (!response.ok) {
        throw new Error(`PLATFORM_CONTEXT_FAILED:${response.status}`)
      }
      const payload = await response.json()
      setServerContext(normalizeServerContext(payload))
      setLoading(false)
      setError('')
    } catch (error) {
      setLoading(false)
      setError(String(error?.message ?? 'PLATFORM_CONTEXT_FAILED'))
    }
  }, [])

  const setSelectedCityId = useCallback(
    (nextCityId = '') => {
      const normalized = String(nextCityId ?? '').trim()
      const isAdmin = Boolean(serverContext.currentUser?.roles?.includes('platform-admin'))
      const nextAvailableCities = Array.isArray(serverContext.cities)
        ? serverContext.cities.filter((city) => {
            if (city.enabled === false) return false
            if (isAdmin) return true
            if (!serverContext.authenticated || !serverContext.allowedCityIds?.length) return true
            return serverContext.allowedCityIds.includes(city.id)
          })
        : []
      const validCityId = nextAvailableCities.find((city) => city.id === normalized)?.id ?? normalized

      setSelectedCityIdState(validCityId)

      try {
        if (validCityId) {
          window.localStorage.setItem(CITY_SELECTION_STORAGE_KEY, validCityId)
        } else {
          window.localStorage.removeItem(CITY_SELECTION_STORAGE_KEY)
        }
      } catch {
        // Ignore storage access failures and keep the in-memory state.
      }
    },
    [serverContext.allowedCityIds, serverContext.authenticated, serverContext.cities, serverContext.currentUser],
  )

  useEffect(() => {
    refreshPlatformContext({ silent: hasInitialContext })
  }, [hasInitialContext, refreshPlatformContext])

  const resolvedContext = useMemo(
    () => resolveContext(serverContext, selectedCityId),
    [selectedCityId, serverContext],
  )

  const value = useMemo(
    () => ({
      loading,
      error,
      ...resolvedContext,
      refreshPlatformContext,
      setSelectedCityId,
    }),
    [error, loading, refreshPlatformContext, resolvedContext, setSelectedCityId],
  )

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
}

export function usePlatformContext() {
  return useContext(PlatformContext)
}
