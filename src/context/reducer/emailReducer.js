export const emailInitialStates = {
    openEmail: false,
    composeEmail: false,
    maximize: false,
    minimize: false,
};

const emailReducer = (state = emailInitialStates, action) => {
    switch (action.type) {
        case "open_email":
            return {
                ...state,
                openEmail: !state.openEmail
            };
        case "compose_email":
            return {
                ...state,
                composeEmail: action.composeEmail
            };
        case "maximize_modal":
            return {
                ...state,
                maximize: action.maximize
            };
        case "minimize_modal":
            return {
                ...state,
                minimize: action.minimize
            };
        default:
            return state;
    }
};

export default emailReducer