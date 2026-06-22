export const todoInitialState = {
    vm: "Week"
}

const todoReducer = (state = todoInitialState, action) => {
    switch (action.type) {
        case "change_vm":
            return {
                ...state,
                vm: action.vm
            };
        default:
            return state;
    }
};

export default todoReducer