'use client'

import TwinViewerPage from '@/components/twin-module/TwinViewerPage'
import { twinViewerModules, viewerBundles } from '@/data/digital-twin/moduleConfig'

const City3dPage = () => {
  return <TwinViewerPage bundles={viewerBundles.municipal} config={twinViewerModules.municipal} />
}

export default City3dPage
