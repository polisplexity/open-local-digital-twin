export const chatPopupinitStates = {
    popupMsgs: [
        { text: "I have a plan regarding pricing", types: "sent" },
        { text: "Welcome back! Are you looking to upgrade your existing plan?", types: "received" }
    ],
    directMsgs: [],
};
const chatPopupReducer = (state = chatPopupinitStates, action) => {
    switch (action.type) {
        case "send_popup_msg":
            return {
                ...state,
                popupMsgs: [...state.popupMsgs, action.popupMsgs]
            };
        case "send_direct_msg":
            return {
                ...state,
                directMsgs: [...state.directMsgs, action.directMsgs]
            };
        default:
            return state;
    }
};

export default chatPopupReducer