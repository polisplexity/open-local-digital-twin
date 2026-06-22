export const ToDoReducer = (state, action) => {
    switch (action.type) {
        case 'info':
            return { ...state, info: !state.info }
        case 'sidebar':
            return { ...state, sidebar: !state.sidebar }
        default:
            return state
    }
}