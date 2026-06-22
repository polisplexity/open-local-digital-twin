
export const layoutInitialStates = {
    isSidebarCollapsed: false,
    topNavCollapse: false,
    dataHover: false,
}

const layoutReducer = (state = layoutInitialStates, action) => {
    switch (action.type) {
        case "sidebar_toggle": {
            return {
                ...state,
                isSidebarCollapsed: !state.isSidebarCollapsed
            };
        };
        case 'collapse_sidebar':
            return {
                ...state,
                isSidebarCollapsed: true,
            };
        case 'expand_sidebar':
            return {
                ...state,
                isSidebarCollapsed: false,
            };
        case "top_nav_toggle":
            return {
                ...state,
                topNavCollapse: !state.topNavCollapse
            };
        case "data_hover":
            return {
                ...state,
                dataHover: action.dataHover
            };
        default:
            return state;
    }
};

export default layoutReducer