const EDC_VOCAB = 'https://w3id.org/edc/v0.0.1/ns/'
const ODRL = 'http://www.w3.org/ns/odrl/2/'

function textValue(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function boundedNumber(value, fallback, minimum, maximum) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(minimum, Math.min(numeric, maximum))
}

function managementUrl(value) {
  const normalized = textValue(value).replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(normalized)) throw new Error('EDC_MANAGEMENT_URL_INVALID')
  return normalized
}

function endpointUrl(baseUrl, path = '') {
  const base = managementUrl(baseUrl)
  const suffix = String(path ?? '').replace(/^\/+/, '')
  return suffix ? `${base}/${suffix}` : base
}

function compactResponse(body) {
  if (body == null) return null
  if (typeof body === 'string') return body.slice(0, 1000)
  return body
}

async function requestEdcJson({ endpoint, headers = {}, path, method = 'GET', body, timeoutMs = 15000, expectedStatuses }) {
  const url = endpointUrl(endpoint, path)
  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  }
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json'
  let response
  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(boundedNumber(timeoutMs, 15000, 1000, 120000)),
    })
  } catch (error) {
    throw new Error(`EDC_HTTP_REQUEST_FAILED:${method}:${url}:${String(error?.message ?? error)}`)
  }
  const text = await response.text()
  let responseBody = null
  if (text) {
    try {
      responseBody = JSON.parse(text)
    } catch {
      responseBody = text
    }
  }
  const accepted = Array.isArray(expectedStatuses)
    ? expectedStatuses.includes(response.status)
    : response.ok
  if (!accepted) {
    const error = new Error(`EDC_HTTP_${response.status}:${method}:${url}`)
    error.status = response.status
    error.response = compactResponse(responseBody)
    throw error
  }
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: responseBody,
    url,
  }
}

async function getResource({ endpoint, headers, collection, id, timeoutMs }) {
  return requestEdcJson({
    endpoint,
    headers,
    path: `${collection}/${encodeURIComponent(id)}`,
    timeoutMs,
    expectedStatuses: [200, 404],
  })
}

async function ensureResource({ endpoint, headers, collection, id, payload, timeoutMs }) {
  const existing = await getResource({ endpoint, headers, collection, id, timeoutMs })
  if (existing.status === 200) {
    return { id, created: false, body: existing.body }
  }
  try {
    const created = await requestEdcJson({
      endpoint,
      headers,
      path: collection,
      method: 'POST',
      body: payload,
      timeoutMs,
      expectedStatuses: [200, 201, 204],
    })
    return { id: textValue(created.body?.['@id'], id), created: true, body: created.body }
  } catch (error) {
    if (error?.status !== 409) throw error
    const readback = await getResource({ endpoint, headers, collection, id, timeoutMs })
    if (readback.status !== 200) throw error
    return { id, created: false, body: readback.body }
  }
}

export async function queryEdcAssets({ endpoint, headers = {}, limit = 1, timeoutMs } = {}) {
  return requestEdcJson({
    endpoint,
    headers,
    path: 'assets/request',
    method: 'POST',
    body: {
      '@context': { '@vocab': EDC_VOCAB },
      '@type': 'QuerySpec',
      offset: 0,
      limit: Math.max(1, Math.min(Number(limit) || 1, 25)),
    },
    timeoutMs,
  })
}

export async function ensureEdcOpenPolicy({ endpoint, headers = {}, policyId, timeoutMs } = {}) {
  const id = textValue(policyId)
  if (!id) throw new Error('EDC_POLICY_ID_REQUIRED')
  return ensureResource({
    endpoint,
    headers,
    collection: 'policydefinitions',
    id,
    timeoutMs,
    payload: {
      '@context': { '@vocab': EDC_VOCAB, odrl: ODRL },
      '@id': id,
      policy: {
        '@type': 'odrl:Set',
        'odrl:permission': [],
        'odrl:prohibition': [],
        'odrl:obligation': [],
      },
    },
  })
}

export async function ensureEdcHttpAsset({
  endpoint,
  headers = {},
  assetId,
  name,
  description,
  sourceUrl,
  properties = {},
  timeoutMs,
} = {}) {
  const id = textValue(assetId)
  const baseUrl = textValue(sourceUrl)
  if (!id) throw new Error('EDC_ASSET_ID_REQUIRED')
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error('EDC_ASSET_SOURCE_URL_INVALID')
  return ensureResource({
    endpoint,
    headers,
    collection: 'assets',
    id,
    timeoutMs,
    payload: {
      '@context': { '@vocab': EDC_VOCAB },
      properties: {
        id,
        name: textValue(name, id),
        description: textValue(description),
        ...properties,
      },
      dataAddress: {
        '@type': 'DataAddress',
        type: 'HttpData',
        baseUrl,
        method: 'GET',
      },
    },
  })
}

export async function ensureEdcContractDefinition({
  endpoint,
  headers = {},
  contractDefinitionId,
  assetId,
  policyId,
  timeoutMs,
} = {}) {
  const id = textValue(contractDefinitionId)
  if (!id || !textValue(assetId) || !textValue(policyId)) throw new Error('EDC_CONTRACT_DEFINITION_CONTEXT_REQUIRED')
  return ensureResource({
    endpoint,
    headers,
    collection: 'contractdefinitions',
    id,
    timeoutMs,
    payload: {
      '@context': { '@vocab': EDC_VOCAB },
      '@id': id,
      accessPolicyId: policyId,
      contractPolicyId: policyId,
      assetsSelector: [{
        operandLeft: `${EDC_VOCAB}id`,
        operator: '=',
        operandRight: assetId,
      }],
    },
  })
}

export async function requestEdcCatalog({
  endpoint,
  headers = {},
  counterPartyAddress,
  counterPartyId,
  timeoutMs,
} = {}) {
  if (!/^https?:\/\//i.test(textValue(counterPartyAddress))) throw new Error('EDC_COUNTER_PARTY_ADDRESS_INVALID')
  if (!textValue(counterPartyId)) throw new Error('EDC_COUNTER_PARTY_ID_REQUIRED')
  const response = await requestEdcJson({
    endpoint,
    headers,
    path: 'catalog/request',
    method: 'POST',
    body: {
      '@context': { '@vocab': EDC_VOCAB },
      counterPartyAddress,
      counterPartyId,
      protocol: 'dataspace-protocol-http',
    },
    timeoutMs,
  })
  if (!response.body || Array.isArray(response.body)) throw new Error('EDC_CATALOG_RESPONSE_INVALID')
  return response.body
}

function asArray(value) {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function propertyValue(object, compact, expanded) {
  return object?.[compact] ?? object?.[expanded]
}

export function findEdcCatalogOffer(catalog, assetId) {
  const datasets = asArray(propertyValue(catalog, 'dcat:dataset', 'https://www.w3.org/ns/dcat/dataset'))
  const dataset = datasets.find((entry) => textValue(entry?.['@id']) === textValue(assetId))
  if (!dataset) throw new Error(`EDC_CATALOG_ASSET_NOT_FOUND:${assetId}`)
  const policies = asArray(propertyValue(dataset, 'odrl:hasPolicy', `${ODRL}hasPolicy`))
  const policy = policies[0]
  const offerId = textValue(policy?.['@id'])
  if (!offerId) throw new Error(`EDC_CATALOG_OFFER_NOT_FOUND:${assetId}`)
  return { assetId, offerId, dataset, policy }
}

function stateValue(body = {}) {
  return textValue(body.state ?? body['edc:state'] ?? body[`${EDC_VOCAB}state`]).toUpperCase()
}

function idValue(body = {}) {
  return textValue(body?.['@id'] ?? body?.id)
}

function agreementIdValue(body = {}) {
  return textValue(body.contractAgreementId ?? body['edc:contractAgreementId'] ?? body[`${EDC_VOCAB}contractAgreementId`])
}

async function pollEdcState({
  endpoint,
  headers,
  path,
  successStates,
  failureStates,
  timeoutMs = 60000,
  pollIntervalMs = 1000,
  errorCode,
}) {
  const deadline = Date.now() + boundedNumber(timeoutMs, 60000, 3000, 300000)
  let latest = null
  while (Date.now() < deadline) {
    latest = (await requestEdcJson({ endpoint, headers, path, timeoutMs: Math.min(timeoutMs, 15000) })).body
    const state = stateValue(latest)
    if (successStates.includes(state)) return { state, body: latest }
    if (failureStates.includes(state)) {
      const error = new Error(`${errorCode}:${state}`)
      error.response = compactResponse(latest)
      throw error
    }
    await new Promise((resolve) => setTimeout(resolve, boundedNumber(pollIntervalMs, 1000, 100, 10000)))
  }
  throw new Error(`${errorCode}:TIMEOUT:${stateValue(latest) || 'UNKNOWN'}`)
}

export async function negotiateEdcContract({
  endpoint,
  headers = {},
  counterPartyAddress,
  counterPartyId,
  offerId,
  assetId,
  timeoutMs,
  pollIntervalMs,
} = {}) {
  const response = await requestEdcJson({
    endpoint,
    headers,
    path: 'contractnegotiations',
    method: 'POST',
    body: {
      '@context': { '@vocab': EDC_VOCAB, odrl: ODRL },
      counterPartyAddress,
      counterPartyId,
      protocol: 'dataspace-protocol-http',
      policy: {
        '@context': 'http://www.w3.org/ns/odrl.jsonld',
        '@type': 'odrl:Offer',
        '@id': offerId,
        assigner: counterPartyId,
        target: assetId,
        'odrl:permission': [],
        'odrl:prohibition': [],
        'odrl:obligation': [],
      },
    },
    timeoutMs,
  })
  const negotiationId = idValue(response.body)
  if (!negotiationId) throw new Error('EDC_NEGOTIATION_ID_MISSING')
  const finalized = await pollEdcState({
    endpoint,
    headers,
    path: `contractnegotiations/${encodeURIComponent(negotiationId)}`,
    successStates: ['FINALIZED'],
    failureStates: ['TERMINATED', 'ERROR'],
    timeoutMs,
    pollIntervalMs,
    errorCode: 'EDC_NEGOTIATION_FAILED',
  })
  const agreementId = agreementIdValue(finalized.body)
  if (!agreementId) throw new Error('EDC_CONTRACT_AGREEMENT_ID_MISSING')
  return { negotiationId, agreementId, state: finalized.state, body: finalized.body }
}

export async function startEdcHttpPushTransfer({
  endpoint,
  headers = {},
  counterPartyAddress,
  agreementId,
  destinationUrl,
  timeoutMs,
} = {}) {
  if (!/^https?:\/\//i.test(textValue(destinationUrl))) throw new Error('EDC_TRANSFER_DESTINATION_INVALID')
  const response = await requestEdcJson({
    endpoint,
    headers,
    path: 'transferprocesses',
    method: 'POST',
    body: {
      '@context': { '@vocab': EDC_VOCAB },
      counterPartyAddress,
      protocol: 'dataspace-protocol-http',
      contractId: agreementId,
      transferType: 'HttpData-PUSH',
      dataDestination: {
        type: 'HttpData',
        baseUrl: destinationUrl,
        method: 'POST',
      },
    },
    timeoutMs,
  })
  const transferId = idValue(response.body)
  if (!transferId) throw new Error('EDC_TRANSFER_ID_MISSING')
  return { transferId, body: response.body }
}

export async function waitForEdcTransfer({
  endpoint,
  headers = {},
  transferId,
  timeoutMs,
  pollIntervalMs,
} = {}) {
  const completed = await pollEdcState({
    endpoint,
    headers,
    path: `transferprocesses/${encodeURIComponent(transferId)}`,
    successStates: ['COMPLETED'],
    failureStates: ['TERMINATED', 'ERROR', 'DEPROVISIONED'],
    timeoutMs,
    pollIntervalMs,
    errorCode: 'EDC_TRANSFER_FAILED',
  })
  return { transferId, state: completed.state, body: completed.body }
}
