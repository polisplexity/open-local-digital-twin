import {
  getDataSpacePackageContent,
  receiveDataSpaceTransfer,
} from '../services/ldtOps/dataSpacePackageService.mjs'

function tokenValue(request) {
  return String(request.query?.token ?? '').trim()
}

export function registerDataSpaceExchangeRoutes(app) {
  app.get('/api/data-space/packages/:packageId/content', async (request, response) => {
    const result = await getDataSpacePackageContent({
      packageId: request.params.packageId,
      token: tokenValue(request),
    }).catch((error) => ({ ok: false, error: String(error?.message ?? error) }))
    if (!result.ok) {
      response.status(404).json({ error: result.error ?? 'DATA_SPACE_PACKAGE_NOT_FOUND' })
      return
    }
    response.setHeader('Content-Type', result.mediaType)
    response.setHeader('Content-Length', String(result.byteSize))
    response.setHeader('Content-Disposition', `attachment; filename="${result.fileName.replace(/["\r\n]/g, '')}"`)
    response.setHeader('ETag', `"sha256-${result.sha256}"`)
    response.setHeader('Cache-Control', 'private, no-store')
    response.status(200).send(result.content)
  })

  app.post('/api/data-space/transfers/:receiptId', async (request, response) => {
    const content = Buffer.isBuffer(request.body) ? request.body : Buffer.from(request.body ?? '')
    const result = await receiveDataSpaceTransfer({
      receiptId: request.params.receiptId,
      token: tokenValue(request),
      content,
      mediaType: request.headers['content-type'],
      headers: request.headers,
    }).catch((error) => ({ ok: false, error: String(error?.message ?? error) }))
    if (result.error === 'DATA_SPACE_RECEIPT_ACCESS_DENIED') {
      response.status(404).json({ error: result.error })
      return
    }
    if (!result.ok) {
      response.status(409).json(result)
      return
    }
    response.status(201).json({
      ok: true,
      receipt: result.receipt,
      checksumVerified: true,
    })
  })
}
