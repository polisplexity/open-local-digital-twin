//Images
import avatar1 from '@/assets/img/avatar1.jpg';
import avatar5 from '@/assets/img/avatar5.jpg';
import avatar7 from '@/assets/img/avatar7.jpg';
import avatar8 from '@/assets/img/avatar8.jpg';

const groupList = [
    {
        id: 12,
        group: "Developers Stage",
        avatar: { type: "img", src: avatar1 },
        lastChat: "Code builders & reviewers stage",
        status: "Active 5min ago",
    },
    {
        id: 13,
        group: "Designer'ss",
        avatar: { type: "img", src: avatar8 },
        lastChat: "Don't know how  I did it? 😍",
        status: "Active 7min ago",
    },
    {
        id: 14,
        group: "Hencework",
        initAvatar: { type: "init", title: "H", variant: "primary" },
        lastChat: "Hi There, I am using Jampack",
        status: "Active 8min ago",
    },
    {
        id: 15,
        group: "Support Team",
        avatar: { type: "img", src: avatar5 },
        lastChat: "contact@hencework.com",
        status: "Active 5min ago",
    },
    {
        id: 16,
        group: "Jampack Team",
        avatar: { type: "img", src: avatar7 },
        lastChat: "Working on wonders :)",
        status: "Active 1min ago",
    },
    {
        id: 17,
        group: "Management",
        initAvatar: { type: "init", title: "M", variant: "soft-danger" },
        lastChat: "No calls, telepathy only",
        status: "Active 5min ago",
    },

]

export default groupList