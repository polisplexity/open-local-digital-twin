export function getCityDisplayName(city) {
  return city?.name || 'Current city'
}

export function getCityWorkspaceLabel(city) {
  return city?.twinLabel || `${getCityDisplayName(city)} Digital Twin`
}

export function getWorkspaceSubline(city) {
  const parts = [city?.region, city?.country].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Local digital twin workspace'
}

export function getTopNavEyebrow(city) {
  return `${getCityDisplayName(city)} digital twin`
}

export function getLoginTitle(city) {
  return city?.name ? `${city.name} digital twin workspace` : 'Local digital twin workspace'
}

