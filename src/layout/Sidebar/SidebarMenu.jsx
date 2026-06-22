import * as Icons from 'tabler-icons-react'
import HkBadge from '@/components/@hk-badge/@hk-badge'

export const SidebarMenu = [
  {
    group: 'Workspace',
    contents: [
      {
        name: 'Cockpit',
        icon: <Icons.Compass />,
        path: '/cockpit',
        badge: <HkBadge size="sm" bg="success" soft className="ms-auto">live</HkBadge>,
      },
      {
        name: 'Analytical Map',
        icon: <Icons.Map2 />,
        path: '/analytical-map',
      },
      {
        name: 'City 3D',
        icon: <Icons.BuildingCommunity />,
        path: '/city-3d',
      },
      {
        name: 'Civic XR',
        icon: <Icons.Users />,
        path: '/civic-xr',
      },
    ],
  },
  {
    group: 'Guidance',
    contents: [
      {
        name: 'Theory',
        icon: <Icons.Route2 />,
        path: '/theory',
      },
      {
        name: 'Docs',
        icon: <Icons.FileText />,
        path: '/docs',
      },
    ],
  },
]
