//Images
import avatar2 from '@/assets/img/avatar2.jpg';
import avatar7 from '@/assets/img/avatar7.jpg';
import avatar9 from '@/assets/img/avatar9.jpg';
import avatar10 from '@/assets/img/avatar10.jpg';
import avatar13 from '@/assets/img/avatar13.jpg';
import avatar15 from '@/assets/img/avatar15.jpg';

export const DATASET = {
    tasks: {
        // Recently Assigned
        "task-1": {
            id: "task-1",
            checked: false,
            stared: true,
            task_name: "Video conference with Canada Team",
            priority: "High",
            indicator: "danger",
            task_time: [{ time: "Tomorrow", text: "primary" }],
            img: avatar7,
            badge: [{ text: "Calls", bg: "primary" }],
        },
        "task-2": {
            id: "task-2",
            checked: false,
            stared: false,
            task_name: "Client objective meeting",
            priority: "High",
            indicator: "warning",
            task_time: [{ time: "Yesterday", text: "danger" }],
            img: avatar9,
            badge: [{ text: "Conferences", bg: "violet" }],
        },
        "task-3": {
            id: "task-3",
            checked: false,
            stared: false,
            task_name: "Target market trend analysis on the go",
            indicator: "danger",
            task_time: [{ time: "Today", text: "primary" }],
            img: avatar7,
            badge: [{ text: "Meetings", bg: "pink" }],
        },
        "task-4": {
            id: "task-4",
            checked: false,
            stared: true,
            task_name: "Send revised proposal to Mr. Dow Jones",
            priority: "Low",
            indicator: "gold",
            task_time: [{ time: "Saturday", text: "" }],
            img: avatar10,
            badge: [{ text: "Project", bg: "orange" }],
        },
        "task-5": {
            id: "task-5",
            checked: false,
            stared: false,
            task_name: "Set up first call for demo",
            indicator: "warning",
            task_time: [{ time: "Sunday", text: "" }],
            init_avt: [{ text: "H", bg: "primary" }],
        },
        "task-6": {
            id: "task-6",
            checked: false,
            stared: true,
            task_name: "Upgrade dependency on resouces",
            priority: "Medium",
            indicator: "danger",
            task_time: [{ time: "27 Nov, 2020", text: "" }],
            img: avatar15,
            badge: [{ text: "Calls", bg: "primary" }],
        },
        "task-7": {
            id: "task-7",
            checked: false,
            stared: false,
            task_name: "Update contribution guidelines and licence",
            indicator: "danger",
            task_time: [{ time: "Today", text: "primary" }],
            img: avatar15,
            badge: [{ text: "Meetings", bg: "pink" }],
        },

        //Yesterday
        "task-8": {
            id: "task-8",
            checked: false,
            stared: false,
            task_name: "Fix tooltip word wrap/break rules",
            priority: "High",
            indicator: "warning",
            task_time: [{ time: "4 Days ago", text: "danger" }],
            img: avatar2,
            badge: [{ text: "Project", bg: "warning" }],
        },
        "task-9": {
            id: "task-9",
            checked: false,
            stared: false,
            task_name: "Redesigning the base model",
            priority: "Urgent",
            indicator: "warning",
            task_time: [{ time: "2 Aug, 2020", text: "" }],
            img: avatar13,
        },
        "task-10": {
            id: "task-10",
            checked: false,
            stared: true,
            task_name: "Configure security analysis feature",
            priority: "Medium",
            indicator: "gold",
            task_time: [{ time: "8 Aug, 2020", text: "" }],
            img: avatar7,
            badge: [{ text: "Calls", bg: "primary" }],
        },

        "task-11": {
            id: "task-11",
            checked: false,
            stared: false,
            task_name: "Remove notifications panel from inbox",
            priority: "Urgent",
            indicator: "danger",
            task_time: [{ time: "24 Sep, 2020", text: "" }],
            img: avatar15,
            badge: [{ text: "Meetings", bg: "pink" }],
        },

        //15 July, 20
        "task-12": {
            id: "task-12",
            checked: false,
            stared: false,
            task_name: "Send an invite to join project",
            priority: "Low",
            indicator: "warning",
            task_time: [{ time: "Yesterday", text: "danger" }],
            img: avatar7,
            badge: [{ text: "Project", bg: "warning" }],
        },
        "task-13": {
            id: "task-13",
            checked: false,
            stared: false,
            task_name: "Connect to software tools",
            priority: "High",
            indicator: "danger",
            task_time: [{ time: "Saturday", text: "" }],
            img: avatar10,
        },
        "task-14": {
            id: "task-14",
            checked: false,
            stared: false,
            task_name: "Speed up project review with planner",
            priority: "High",
            indicator: "danger",
            task_time: [{ time: "15 Oct, 2020", text: "" }],
            img: avatar9,
            badge: [{ text: "Calls", bg: "primary" }],
        },

    },
    cards: {
        "card-1": {
            id: "card-1",
            title: "Recently Assigned",
            taskIds: ["task-1", "task-2", "task-3", "task-4", "task-5", "task-6", "task-7"]
        },
        "card-2": {
            id: "card-2",
            title: "Yesterday",
            taskIds: ["task-8", "task-9", "task-10", "task-11"]
        },
        "card-3": {
            id: "card-3",
            title: "15 July, 20",
            taskIds: ["task-12", "task-13", "task-14"]
        },
    },
    cardOrder: ["card-1", "card-2", "card-3"]
};