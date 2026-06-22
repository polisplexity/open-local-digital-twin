import * as Icons from 'tabler-icons-react';
import HkBadge from '@/components/@hk-badge/@hk-badge';
import { nanoid } from 'nanoid';

export const DashboardMenu = [
    {
        id: nanoid(),
        title: 'Dashboard',
        icon: <Icons.Template />,
        link: '/dashboard',
        badge: <HkBadge size="sm" bg="pink" soft className="ms-auto" >hot</HkBadge>
    },

    //Apps group
    {
        id: nanoid(),
        title: 'Apps',
        grouptitle: true
    },
    {
        id: nanoid(),
        title: 'Chat',
        icon: <Icons.MessageDots />,
        path: '/apps/chat/',
        children: [
            { id: nanoid(), link: '/apps/chat/chats', name: 'Chats' },
            { id: nanoid(), link: '/apps/chat/groups', name: 'Groups' },
            { id: nanoid(), link: '/apps/chat/contact', name: 'Contacts' },
        ]
    },
    {
        id: nanoid(),
        title: 'Chat Popup',
        icon: <Icons.MessageCircle />,
        path: '/apps/chat-popup/',
        children: [
            { id: nanoid(), link: '/apps/chat-popup/direct-message', name: 'Direct Message' },
            { id: nanoid(), link: '/apps/chat-popup/chat-bot', name: 'Chatbot' },
        ]
    },
    {
        id: nanoid(),
        title: 'Calendar',
        icon: <Icons.CalendarTime />,
        link: '/apps/calendar',
    },
    {
        id: nanoid(),
        title: 'Email',
        icon: <Icons.Inbox />,
        link: '/apps/email',
    },
    {
        id: nanoid(),
        title: 'Scrumboard',
        icon: <Icons.LayoutKanban />,
        iconBadge: <HkBadge bg="primary" size="sm" pill className="position-top-end-overflow">3</HkBadge>,
        path: '/apps/scrumboard',
        children: [
            { id: nanoid(), link: '/apps/scrumboard/project-board', name: 'All Boards' },
            { id: nanoid(), link: '/apps/scrumboard/kanban-board', name: 'Project Kanban' },
            { id: nanoid(), link: '/apps/scrumboard/pipeline', name: 'Pipeline Kanban' },
        ]
    },
    {
        id: nanoid(),
        title: 'Contact',
        icon: <Icons.Notebook />,
        path: '/apps/contact',
        children: [
            { id: nanoid(), link: '/apps/contact/contact-list', name: 'Contact List' },
            { id: nanoid(), link: '/apps/contact/contact-cards', name: 'Contact Cards' },
            { id: nanoid(), link: '/apps/contact/edit-contact', name: 'Edit Contact' },
        ]
    },
    {
        id: nanoid(),
        title: 'File Manager',
        icon: <Icons.FileCheck />,
        path: '/apps/file-manager',
        children: [
            { id: nanoid(), link: '/apps/file-manager/list-view', name: 'List View' },
            { id: nanoid(), link: '/apps/file-manager/grid-view', name: 'Grid View' },
        ]
    },
    {
        id: nanoid(),
        title: 'Gallery',
        icon: <Icons.Photo />,
        link: '/apps/gallery',
    },
    {
        id: nanoid(),
        title: 'Todo',
        icon: <Icons.ListDetails />,
        badge: <HkBadge bg="success" soft className="ms-2">2</HkBadge>,
        path: '/apps/todo',
        children: [
            { id: nanoid(), link: '/apps/todo/task-list', name: 'Tasklist' },
            { id: nanoid(), link: '/apps/todo/gantt', name: 'Gantt' },
        ]
    },
    {
        id: nanoid(),
        title: 'Blog',
        icon: <Icons.Browser />,
        path: '/apps/blog',
        children: [
            { id: nanoid(), link: '/apps/blog/posts', name: 'Posts' },
            { id: nanoid(), link: '/apps/blog/add-new-post', name: 'Add New Post' },
            { id: nanoid(), link: '/apps/blog/post-detail', name: 'Post Detail' },
        ]
    },
    {
        id: nanoid(),
        title: 'Invoices',
        icon: <Icons.FileDigit />,
        path: '/apps/invoices',
        children: [
            { id: nanoid(), link: '/apps/invoices/invoice-list', name: 'Invoice List' },
            { id: nanoid(), link: '/apps/invoices/invoice-templates', name: 'Invoice Templates' },
            { id: nanoid(), link: '/apps/invoices/create-invoice', name: 'Create Invoice' },
            { id: nanoid(), link: '/apps/invoices/invoice-preview', name: 'Invoice Preview' },
        ]
    },
    {
        id: nanoid(),
        title: 'Integrations',
        icon: <Icons.Code />,
        path: '/apps/integrations',
        children: [
            { id: nanoid(), link: '/apps/integrations/all-apps', name: 'All Apps' },
            { id: nanoid(), link: '/apps/integrations/app-detail', name: 'App Detail' },
            { id: nanoid(), link: '/apps/integrations/integration', name: 'Integrations' },
        ]
    },

    //Pages group
    {
        id: nanoid(),
        title: 'Pages',
        grouptitle: true
    },
    {
        id: nanoid(),
        title: 'Authentication',
        icon: <Icons.UserPlus />,
        children: [
            {
                id: nanoid(),
                link: '#',
                title: 'Log In',
                children: [
                    { id: nanoid(), link: '/auth/login', name: 'Login' },
                    { id: nanoid(), link: '/auth/login/simple', name: 'Login Simple' },
                    { id: nanoid(), link: '/auth/login/classic', name: 'Login Classic' }
                ]
            },
            {
                id: nanoid(),
                link: '#',
                title: 'Signup',
                children: [
                    { id: nanoid(), link: '/auth/signup', name: 'Signup' },
                    { id: nanoid(), link: '/auth/signup/simple', name: 'Signup Simple' },
                    { id: nanoid(), link: '/auth/signup/classic', name: 'Signup Classic' }
                ]
            },
            { id: nanoid(), link: '/auth/lock-screen', name: 'Lock Screen' },
            { id: nanoid(), link: '/auth/reset-password', name: 'Reset Password' },
            { id: nanoid(), link: '/error-404', name: 'Error 404' },
            { id: nanoid(), link: '/error-503', name: 'Error 503' },
        ]
    },

    {
        id: nanoid(),
        title: 'Profile',
        icon: <Icons.UserSearch />,
        badgeIndicator: <HkBadge bg="danger" indicator className="position-absolute top-0 start-100" />,
        path: '/profile',
        children: [
            { id: nanoid(), link: '/profile', name: 'Profile' },
            { id: nanoid(), link: '/profile/edit-profile', name: 'Edit Profile' },
            { id: nanoid(), link: '/profile/account', name: 'Account' },
        ]
    },

    //Documentation page
    {
        id: nanoid(),
        title: 'Documentation',
        grouptitle: true
    },
    {
        id: nanoid(),
        title: 'Documentation',
        icon: <Icons.FileCode2 />,
        link: 'https://nubra-ui-react.netlify.app/introduction',
        target: '_blank',
    },
    {
        id: nanoid(),
        title: 'Components',
        icon: <Icons.Layout />,
        link: 'https://nubra-ui-react.netlify.app/avatar',
        target: '_blank',
    },

];