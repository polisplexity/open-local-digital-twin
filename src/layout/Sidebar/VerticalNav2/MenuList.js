import * as Icons from 'tabler-icons-react';
import { nanoid } from 'nanoid';

export const DashboardMenu = [
    {
        id: nanoid(),
        title: 'Cockpit',
        icon: <Icons.Template />,
        link: '/cockpit',
    },

    {
        id: nanoid(),
        title: 'Workspace',
        grouptitle: true
    },
    {
        id: nanoid(),
        title: 'Workspace',
        icon: <Icons.LayoutGrid />,
        link: '/workspace',
    },
    {
        id: nanoid(),
        title: 'Operations',
        icon: <Icons.ActivityHeartbeat />,
        path: '/operations',
        children: [
            { id: nanoid(), link: '/operations', name: 'Overview' },
            { id: nanoid(), link: '/operations/ingestion', name: 'Ingestion' },
            { id: nanoid(), link: '/operations/apis', name: 'APIs' },
            { id: nanoid(), link: '/operations/telemetry', name: 'Telemetry' },
            { id: nanoid(), link: '/operations/workflows', name: 'Workflows' },
            { id: nanoid(), link: '/operations/compliance', name: 'Compliance' },
        ]
    },
    {
        id: nanoid(),
        title: 'Standards',
        icon: <Icons.World />,
        link: '/standards',
    },
    {
        id: nanoid(),
        title: 'Capabilities',
        icon: <Icons.ShieldCheck />,
        link: '/capabilities',
    },

    {
        id: nanoid(),
        title: 'Visual Surfaces',
        grouptitle: true
    },
    {
        id: nanoid(),
        title: 'Analytical Map',
        icon: <Icons.Map />,
        link: '/analytical-map',
    },
    {
        id: nanoid(),
        title: 'City 3D',
        icon: <Icons.BuildingSkyscraper />,
        link: '/city-3d',
    },
    {
        id: nanoid(),
        title: 'Civic XR',
        icon: <Icons.Users />,
        link: '/civic-xr',
    },
    {
        id: nanoid(),
        title: 'Guidance',
        grouptitle: true
    },
    {
        id: nanoid(),
        title: 'Theory',
        icon: <Icons.Route />,
        link: '/theory',
    },
    {
        id: nanoid(),
        title: 'Docs',
        icon: <Icons.FileText />,
        link: '/docs',
    },
    {
        id: nanoid(),
        title: 'Profile',
        icon: <Icons.UserSearch />,
        link: '/profile',
    },
    {
        id: nanoid(),
        title: 'Admin',
        icon: <Icons.Settings />,
        link: '/admin',
    },

];
