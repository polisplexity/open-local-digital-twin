'use client'

import TwinViewerPage from '@/components/twin-module/TwinViewerPage'
import { twinViewerModules, viewerBundles } from '@/data/digital-twin/moduleConfig'

const AnalyticalMapPage = () => {
  return <TwinViewerPage bundles={viewerBundles.map} config={twinViewerModules.map} />
}

export default AnalyticalMapPage
