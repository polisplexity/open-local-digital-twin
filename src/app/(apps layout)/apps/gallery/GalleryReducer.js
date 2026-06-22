export const GalleryReducer = (state, action) => {
    switch (action.type) {
        case 'addCat':
            return { ...state, addCat: !state.addCat }
        case 'sidebar':
            return { ...state, sidebar: !state.sidebar }
        default:
            return state
    }
}