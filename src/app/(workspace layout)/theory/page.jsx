'use client'

import TwinInfoPage from '@/components/twin-module/TwinInfoPage'
import { usePlatformContext } from '@/context/PlatformContext'
import { getCityDisplayName, getCityWorkspaceLabel } from '@/data/digital-twin/platformBrand'
import { theoryPageConfig } from '@/data/digital-twin/moduleConfig'
import {
  getArchitectureStepsData,
  getCapabilityJourneyData,
  getDataTransportLifecycleData,
  getPilotRequirementsData,
  getTheoryLensesData,
  getTwinModelRegisterData,
  getWs2PilotDetailRegisterData,
} from '@/data/digital-twin/cityTwinContent'

const TheoryPage = () => {
  const { activeCity } = usePlatformContext()
  const theoryLenses = getTheoryLensesData()
  const capabilityJourney = getCapabilityJourneyData()
  const architectureSteps = getArchitectureStepsData()
  const pilotRequirements = getPilotRequirementsData(activeCity)
  const twinModelRegister = getTwinModelRegisterData(activeCity)
  const dataTransportLifecycle = getDataTransportLifecycleData()
  const ws2PilotDetailRegister = getWs2PilotDetailRegisterData()

  const cards = [
    {
      id: 'theory-lenses',
      title: 'Four layers the municipality should not confuse',
      items: theoryLenses.map((lens) => `${lens.title}: ${lens.body}`),
    },
    {
      id: 'theory-capabilities',
      title: `Current maturity of the ${getCityDisplayName(activeCity)} twin`,
      items: capabilityJourney.map((stage) => `${stage.label}: ${stage.value}% currently evidenced inside the product.`),
    },
    {
      id: 'theory-architecture',
      title: 'From public baseline to future semantic packs',
      items: architectureSteps.map((step) => `${step.title}: ${step.body}`),
    },
    {
      id: 'theory-pilot',
      title: 'Why this separation matters for WS2 pilot details',
      items: pilotRequirements.map((requirement) => `${requirement.title}: ${requirement.body}`),
    },
  ]
  const tables = [
    {
      id: 'theory-capability-table',
      title: 'Current twin model register',
      columns: ['Layer', 'Current status', 'What it contains', 'What it does not contain yet'],
      rows: twinModelRegister,
    },
    {
      id: 'theory-transport',
      title: 'Data lifecycle and transport path',
      columns: ['Stage', 'Current posture', 'Next expectation'],
      rows: dataTransportLifecycle,
    },
    {
      id: 'theory-pilot-fit',
      title: 'WS2 pilot-detail alignment register',
      columns: ['Requirement', 'Manual expectation', 'Current platform posture'],
      rows: ws2PilotDetailRegister,
    },
  ]

  return (
    <TwinInfoPage
      cards={cards}
      config={theoryPageConfig}
      sidebarBody={[
        `${getCityWorkspaceLabel(activeCity)} starts from a public base twin first, not from a fully semantic or interoperable stack.`,
        'This module explains the difference between base twin, logical twin, inferred semantic seeds, and transport/interoperability so municipal reviewers and partners do not confuse one layer with another.',
        'WS2 expects the product to explain data lifecycle, seven-layer management posture, and semantic interoperability. Those obligations are surfaced here instead of being hidden inside generic product language.',
      ]}
      stats={capabilityJourney.map((stage) => ({
        label: stage.label,
        value: `${stage.value}%`,
        note: 'Current maturity of this twin layer inside the platform.',
        col: 4,
      }))}
      tables={tables}
    />
  )
}

export default TheoryPage
