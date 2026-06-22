
//image
import avatar1 from '@/assets/img/avatar1.jpg';
import avatar8 from '@/assets/img/avatar8.jpg';

export const chatInitialStates = {
    startChat: false,
    avatar: { type: "img", src: avatar8 },
    userId: 2,
    userName: "Huma Therman",
    msg: [],
    contactMsg: [],
    rplyMsg: [],
    status: "Typing",
    //Group states
    grpId: 12,
    grpAvatar: { type: "img", src: avatar1 },
    groupName: "Developers Stage",
    grpStatus: "Active 5min ago",
    grpMsg: [],
}

const chatReducer = (state = chatInitialStates, action) => {
    switch (action.type) {
        case "start_chat":
            return {
                ...state,
                startChat: !state.startChat
            };
        case "send_msg":
            return {
                ...state,
                msg: [...state.msg, action.msg]
            };
        case "set_user":
            return {
                ...state,
                userId: action.userId,
                avatar: action.avatar,
                userName: action.userName,
                status: action.status
            };
        case "contact_msg":
            return {
                ...state,
                contactMsg: [...state.contactMsg, action.contactMsg]
            };
        case "reply_msg":
            return {
                ...state,
                rplyMsg: [...state.rplyMsg, action.rplyMsg]
            };
        //Chat Group reducers
        case "grp_msg":
            return {
                ...state,
                grpMsg: [...state.grpMsg, action.grpMsg]
            };
        case "select_group":
            return {
                ...state,
                grpId: action.grpId,
                grpAvatar: action.grpAvatar,
                groupName: action.groupName,
                grpStatus: action.grpStatus,
            };
        default:
            return state;
    }
};

export default chatReducer