export const dropdownReducer = (state, action) => {
    switch (action.type) {
        case 'dropdown_toggle':
            return { ...state, show: !state.show }
        default:
            return state
    }
}