'use client'

import TwinViewerPage from '@/components/twin-module/TwinViewerPage'
import { twinViewerModules, viewerBundles } from '@/data/digital-twin/moduleConfig'

const CivicXrPage = () => {
  return <TwinViewerPage bundles={viewerBundles.civicXr} config={twinViewerModules.civicXr} />
}

export default CivicXrPage
