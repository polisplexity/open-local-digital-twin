'use client'

import TwinViewerPage from '@/components/twin-module/TwinViewerPage'
import { twinViewerModules, viewerBundles } from '@/data/digital-twin/moduleConfig'

const City3dPage = () => {
  return <TwinViewerPage bundles={viewerBundles.city3d} config={twinViewerModules.city3d} />
}

export default City3dPage
