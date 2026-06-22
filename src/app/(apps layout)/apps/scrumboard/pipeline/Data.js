//Images
import avatar2 from '@/assets/img/avatar2.jpg';
import avatar5 from '@/assets/img/avatar5.jpg';
import avatar7 from '@/assets/img/avatar7.jpg';
import avatar8 from '@/assets/img/avatar8.jpg';
import avatar13 from '@/assets/img/avatar13.jpg';
import symbolAvatar1 from '@/assets/img/symbol-avatar-1.png';
import symbolAvatar4 from '@/assets/img/symbol-avatar-4.png';
import symbolAvatar5 from '@/assets/img/logo-avatar-5.png';
import symbolAvatar6 from '@/assets/img/symbol-avatar-6.png';
import symbolAvatar7 from '@/assets/img/symbol-avatar-7.png';
import symbolAvatar8 from '@/assets/img/logo-avatar-8.png';
import symbolAvatar9 from '@/assets/img/symbol-avatar-9.png';
import symbolAvatar10 from '@/assets/img/symbol-avatar-10.png';
import symbolAvatar12 from '@/assets/img/symbol-avatar-12.png';
import symbolAvatar13 from '@/assets/img/symbol-avatar-13.png';
import symbolAvatar15 from '@/assets/img/symbol-avatar-15.png';
import symbolAvatar14 from '@/assets/img/symbol-avatar-14.png';
import logoAvatar1 from '@/assets/img/logo-avatar-1.png';
import logoAvatar3 from '@/assets/img/logo-avatar-3.png';
import logoAvatar9 from '@/assets/img/logo-avatar-9.png';
import logoAvatar7 from '@/assets/img/logo-avatar-7.png';
import logoAvatar2 from '@/assets/img/logo-avatar-2.png';
import logoAvatar10 from '@/assets/img/logo-avatar-10.png';
import logoAvatar11 from '@/assets/img/logo-avatar-11.png';


export const ITEM_TYPES = {
    CARD: "card",
    TASK: "task"
};

export const DATASET = {
    tasks: {
        // LeadIn Board
        "task-1": {
            id: "task-1",
            symbolLogo: symbolAvatar14,
            brandName: "Intercom",
            price: "1,025",
            type: "Chatbot",
            avatar: avatar13,
            lastUsed: "a month ago",
            growth: "normal",
        },
        "task-2": {
            id: "task-2",
            logo: logoAvatar2,
            brandName: "Swiggy",
            price: "$2,456",
            type: "Food Order",
            avatar: avatar8,
            lastUsed: "24 days",
            growth: "high",
        },
        "task-3": {
            id: "task-3",
            logo: logoAvatar10,
            brandName: "Medium",
            price: "$9,425",
            type: "Publishing Co",
            avatar: avatar8,
            lastUsed: "5 days",
            status: "lost",
            growth: "high",
        },
        "task-4": {
            id: "task-4",
            symbolLogo: symbolAvatar12,
            brandName: "Figma",
            price: "$109",
            type: "Design App",
            avatar: avatar7,
            lastUsed: "9 days",
            growth: "low",
        },
        "task-5": {
            id: "task-5",
            initLogo: "H",
            logoBg: "avatar-violet",
            brandName: "Hencework",
            price: "$14,023",
            type: "UI/UX Design Agency",
            initAvatar: "H",
            avatar: avatar13,
            lastUsed: "15 days",
            growth: "average",
        },
        "task-6": {
            id: "task-6",
            symbolLogo: symbolAvatar4,
            brandName: "Jampack",
            price: "$16,528",
            type: "Dashboard Template",
            avatar: avatar7,
            lastUsed: "9 days",
            growth: "high",
        },
        "task-7": {
            id: "task-7",
            symbolLogo: symbolAvatar1,
            brandName: "Tinder",
            price: "$4,256",
            type: "Dating App",
            avatar: avatar8,
            lastUsed: "18 days",
            growth: "normal",
        },
        "task-8": {
            id: "task-8",
            logo: logoAvatar2,
            brandName: "Swiggy",
            price: "$2,456",
            type: "Food Order",
            avatar: avatar8,
            lastUsed: "9 days",
            growth: "high",
        },
        "task-9": {
            id: "task-9",
            logo: logoAvatar10,
            brandName: "Medium",
            price: "$9,425",
            type: "Publishing Co",
            avatar: avatar8,
            lastUsed: "5 days",
            growth: "high",
        },
        "task-10": {
            id: "task-10",
            symbolLogo: symbolAvatar12,
            brandName: "Figma",
            price: "$109",
            type: "Design App",
            avatar: avatar7,
            lastUsed: "9 days",
            growth: "low",
        },

        "task-11": {
            id: "task-11",
            initLogo: "H",
            logoBg: "avatar-violet",
            brandName: "Hencework",
            price: "$14,023",
            type: "UI/UX Design Agency",
            avatar: avatar13,
            lastUsed: "15 days",
            growth: "average",
        },

        // Opportunity Board

        "task-12": {
            id: "task-12",
            logo: logoAvatar1,
            brandName: "Phone pay",
            price: "$5,201",
            type: "Chatbot",
            avatar: avatar7,
            lastUsed: "Yesterday",
            growth: "low",
        },
        "task-13": {
            id: "task-13",
            logo: logoAvatar3,
            brandName: "Coursera",
            price: "$6,542",
            type: "Food Order",
            avatar: avatar13,
            lastUsed: "2 days",
            growth: "normal",
        },
        "task-14": {
            id: "task-14",
            symbolLogo: symbolAvatar15,
            brandName: "Kickstarter",
            price: "$9,425",
            type: "Publishing Co",
            avatar: avatar13,
            lastUsed: "28 days",
            growth: "normal",
        },
        "task-15": {
            id: "task-15",
            logo: logoAvatar7,
            brandName: "Codepen",
            price: "$901",
            type: "Design App",
            avatar: avatar2,
            lastUsed: "10 days",
            growth: "average",
        },
        "task-16": {
            id: "task-16",
            initLogo: "G",
            logoBg: "avatar-soft-blue",
            brandName: "Google",
            price: "$14,010",
            type: "UI/UX Design Agency",
            avatar: avatar2,
            lastUsed: "8 days",
            growth: "low",
        },

        "task-17": {
            id: "task-17",
            logo: logoAvatar11,
            brandName: "Mozilla Ubisoft",
            price: "$14,546",
            type: "Dashboard Template",
            avatar: avatar8,
            lastUsed: "13 days",
            growth: "normal",
        },
        "task-18": {
            id: "task-18",
            initLogo: "M",
            logoBg: "avatar-violet",
            brandName: "Mad World",
            price: "$6,524",
            type: "Dating App",
            avatar: avatar7,
            lastUsed: "4 days",
            status: "lost",
            growth: "normal",
        },
        "task-19": {
            id: "task-19",
            symbolLogo: symbolAvatar9,
            brandName: "Propswala",
            price: "$3,543",
            type: "Food Order",
            avatar: avatar13,
            lastUsed: "9 days",
            growth: "normal",
        },

        // Proposed
        "task-20": {
            id: "task-20",
            symbolLogo: symbolAvatar7,
            brandName: "Icons 8",
            price: "$9,425",
            type: "Chatbot",
            avatar: avatar2,
            lastUsed: "a month ago",
            growth: "normal",
        },

        "task-21": {
            id: "task-21",
            symbolLogo: symbolAvatar6,
            brandName: "Behance",
            price: "$4,560",
            type: "Food Order",
            avatar: avatar8,
            lastUsed: "a month ago",
            status: "lost",
            growth: "high",
        },
        "task-22": {
            id: "task-22",
            symbolLogo: symbolAvatar10,
            brandName: "Morris Jet",
            price: "$5,217",
            type: "Publishing Co",
            avatar: avatar13,
            lastUsed: "a month ago",
            growth: "normal",
        },

        //FollowUp
        "task-23": {
            id: "task-23",
            initLogo: "c",
            logoBg: "avatar-soft-danger",
            brandName: "Challenger",
            price: "$156",
            type: "Chatbot",
            avatar: avatar2,
            lastUsed: "a month ago",
            growth: "normal",
        },
        "task-24": {
            id: "task-24",
            initLogo: "A",
            logoBg: "avatar-soft-success",
            brandName: "Atmanirbhar",
            price: "$2,456",
            type: "Food Order",
            avatar: avatar13,
            lastUsed: "9 days",
            growth: "high",
        },
        "task-25": {
            id: "task-25",
            symbolLogo: symbolAvatar13,
            brandName: "Sketch",
            price: "$1,760",
            type: "Publishing Co",
            avatar: avatar2,
            lastUsed: "5 days",
            growth: "average",
        },
        "task-26": {
            id: "task-26",
            logo: symbolAvatar8,
            brandName: "ITF",
            price: "$287",
            type: "UI/UX Design Agency",
            avatar: avatar2,
            lastUsed: "15 days",
            growth: "low",
        },
        "task-27": {
            id: "task-27",
            logo: symbolAvatar5,
            brandName: "City Deals",
            price: "$12,145",
            type: "Dashboard Template",
            avatar: avatar5,
            lastUsed: "24 days",
            growth: "high",
        },
        "task-28": {
            id: "task-28",
            logo: logoAvatar9,
            brandName: "Daily",
            price: "$7,532",
            type: "Dating App",
            avatar: avatar7,
            lastUsed: "15 days",
            growth: "normal",
        },

        //Conversion
        "task-29": {
            id: "task-29",
            logo: logoAvatar7,
            brandName: "Codepen",
            price: "$7,864",
            type: "Chatbot",
            avatar: avatar13,
            lastUsed: "a month ago",
            growth: "normal",
        },
        "task-30": {
            id: "task-30",
            symbolLogo: symbolAvatar15,
            brandName: "Kickstarter",
            price: "$8,542",
            type: "Food Order",
            avatar: avatar2,
            lastUsed: "9 days",
            status: "won",
            growth: "normal",
        },
        "task-31": {
            id: "task-31",
            symbolLogo: symbolAvatar14,
            brandName: "Intercom",
            price: "$3,791",
            type: "Publishing Co",
            avatar: avatar7,
            lastUsed: "a month ago",
            growth: "normal",
        },
        "task-32": {
            id: "task-32",
            symbolLogo: symbolAvatar12,
            brandName: "Figma",
            price: "$478",
            type: "Design App",
            avatar: avatar2,
            lastUsed: "9 days",
            growth: "low",
        },
        "task-33": {
            id: "task-33",
            initLogo: "H",
            logoBg: "avatar-success",
            brandName: "Hencework",
            price: "$987",
            type: "UI/UX Design Agency",
            avatar: avatar7,
            lastUsed: "15 days",
            growth: "normal",
        },

    },
    cards: {
        "card-1": {
            id: "card-1",
            title: "LEAD IN",
            taskIds: ["task-1", "task-2", "task-3", "task-4", "task-5", "task-6", "task-7", "task-8", "task-9", "task-10"]
        },
        "card-2": {
            id: "card-2",
            title: "OPPORTUNITY",
            taskIds: ["task-12", "task-13", "task-14", "task-15", "task-16", "task-17", "task-18", "task-19"]
        },
        "card-3": {
            id: "card-3",
            title: "PROPOSED",
            taskIds: ["task-20", "task-21", "task-22"]
        },
        "card-4": {
            id: "card-4",
            title: "FOLLOW UP ",
            taskIds: ["task-23", "task-24", "task-25", "task-26", "task-27", "task-28"]
        },
        "card-5": {
            id: "card-5",
            title: "Conversion",
            taskIds: ["task-29", "task-30", "task-31", "task-32", "task-33"]
        }
    },
    cardOrder: ["card-1", "card-2", "card-3", "card-4", "card-5"]
};