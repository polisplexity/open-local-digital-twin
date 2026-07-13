import path from 'node:path'
import { readFile } from 'node:fs/promises'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FileText } from 'react-feather'
import { manualReferenceDocuments } from '@/data/digital-twin/userManualContent'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function resolveReference(key) {
  const reference = manualReferenceDocuments.find((item) => item.key === key)
  if (!reference) return null

  const docsRoot = path.resolve(process.cwd(), 'docs')
  const documentPath = path.resolve(process.cwd(), reference.path)
  const relativePath = path.relative(docsRoot, documentPath)
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null
  }

  try {
    return {
      reference,
      fileName: path.basename(documentPath),
      markdown: await readFile(documentPath, 'utf8'),
    }
  } catch {
    return null
  }
}

export default async function ManualReferencePage({ params }) {
  const { key } = await params
  const resolved = await resolveReference(key)
  if (!resolved) notFound()

  return (
    <main className="dt-reference-reader">
      <header className="dt-reference-reader__header">
        <div className="dt-reference-reader__identity">
          <span>Allowlisted technical reference</span>
          <div>
            <FileText aria-hidden="true" size={22} />
            <h1>{resolved.fileName}</h1>
          </div>
          <p>{resolved.reference.purpose}</p>
          <code>{resolved.reference.path}</code>
        </div>
        <Link className="btn btn-outline-primary" href="/docs">
          <ArrowLeft aria-hidden="true" size={15} />
          Back to manual
        </Link>
      </header>
      <article className="dt-reference-reader__source" aria-label={`${resolved.fileName} Markdown source`}>
        <pre>{resolved.markdown}</pre>
      </article>
    </main>
  )
}
