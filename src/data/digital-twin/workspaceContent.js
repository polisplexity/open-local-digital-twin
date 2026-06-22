import { getCityDisplayName, getCityWorkspaceLabel, getWorkspaceSubline } from './platformBrand'

export function getTwinOverview(city) {
  const cityName = getCityDisplayName(city)
  const regionLabel = getWorkspaceSubline(city)

  return {
    city: cityName,
    country: city?.country ?? 'Current country',
    region: city?.region ?? 'Current region',
    tagline:
      `${cityName} public-data base twin, lightweight logical twin, inferred semantic seeds, and a separate interoperability path.`,
    summary:
      `The current ${cityName} workspace starts from public territorial geometry, organizes it into a logical twin, exposes inferred semantic seeds honestly, and keeps data transport and interoperability as a separate architecture track for later growth.`,
    regionLabel,
  }
}

export function getAdminMetrics(city) {
  const cityName = getCityDisplayName(city)

  return [
    { label: 'Active viewers', value: '1', note: `Visible sessions in the last 15 minutes for ${cityName}.` },
    { label: 'Unique viewers 24h', value: '4', note: `Distinct users who opened the ${cityName} twin workspace.` },
    { label: 'Page views 24h', value: '32', note: 'Navigations across cockpit, municipal, public, theory, docs, and admin.' },
    { label: 'Docs reads 24h', value: '11', note: 'Recent reads across architecture, requirements, and reference materials.' },
  ]
}

export function getAdminActivity(city) {
  const cityName = getCityDisplayName(city)

  return [
    {
      viewer: 'Edgar Antonio Valdes',
      surface: 'Cockpit',
      focus: `${cityName} base vs semantic split review`,
      lastSeen: '22 Mar 2026, 09:12',
      status: 'Active',
    },
    {
      viewer: 'Twin Studio Admin',
      surface: 'Docs',
      focus: `${cityName} source and transport register`,
      lastSeen: '22 Mar 2026, 08:44',
      status: 'Active',
    },
    {
      viewer: 'Municipal Reviewer',
      surface: 'Public',
      focus: `${cityName} participatory walkthrough`,
      lastSeen: '21 Mar 2026, 18:07',
      status: 'Reviewing',
    },
  ]
}

export function getTwinUserProfile(city, currentUser = null) {
  const cityName = getCityDisplayName(city)
  const workspaceLabel = `${getCityWorkspaceLabel(city)} Workspace`
  const regionLabel = getWorkspaceSubline(city)
  const name = currentUser?.fullName || 'Workspace User'
  const shortName = currentUser?.fullName || 'Workspace User'
  const email = currentUser?.email || 'workspace.user@polisplexity.tech'
  const role = currentUser?.roles?.includes('platform-admin')
    ? 'Platform administrator'
    : currentUser?.role || 'Municipal reviewer'
  const status = currentUser?.status === 'active' ? 'Active session' : 'Pending activation'

  return {
    name,
    shortName,
    email,
    role,
    organization: 'Polisplexity / Hadox',
    workspace: workspaceLabel,
    city: `${cityName}${city?.country ? `, ${city.country}` : ''}`,
    status,
    accessLevel: 'Administrative access',
    lastSeen: currentUser?.lastLoginAt || '22 Mar 2026, 09:12',
    bio:
      `Responsible for platform administration, municipal reviews, and the delivery path from the ${cityName} base twin toward future semantic packs.`,
    responsibilities: [
      'Keep base, semantic, and interoperability layers clearly separated inside the product.',
      `Review the ${cityName} territorial baseline before municipal enrichment begins.`,
      'Manage restricted tools without exposing them to city-facing routes.',
    ],
    permissions: [
      'Open cockpit, Analytical Map, City 3D, Civic XR, theory, docs, and admin routes.',
      `Review live map, 3D, and immersive viewers for ${cityName}.`,
      'Access restricted template tools from the admin-only menu.',
    ],
    preferences: [
      { label: 'Theme preference', value: 'Adaptive light/dark workspace' },
      { label: 'Primary city', value: `${cityName}${city?.country ? `, ${city.country}` : ''}` },
      { label: 'Viewer preference', value: 'Municipal operations and cockpit' },
      { label: 'Notification mode', value: 'Critical updates only' },
    ],
    security: [
      { label: 'Sign-in channel', value: 'Workspace credentials' },
      { label: 'Password status', value: 'Managed outside the prototype' },
      { label: 'Restricted tools', value: 'Visible only for admin users' },
      { label: 'Session posture', value: `Single ${cityName} workspace control session` },
    ],
    recentSurfaces: [
      { surface: 'Cockpit', focus: `${cityName} base vs semantic split`, time: '22 Mar 2026, 09:12' },
      { surface: 'Docs', focus: `${cityName} source and transport register`, time: '22 Mar 2026, 08:44' },
      { surface: 'Public', focus: `${cityName} participatory walkthrough`, time: '21 Mar 2026, 18:07' },
    ],
    regionLabel,
  }
}
