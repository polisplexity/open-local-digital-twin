import { nanoid } from 'nanoid';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import Board from './Board';

//Images
import avatar8 from '@/assets/img/avatar8.jpg';
import symbolAvatar4 from '@/assets/img/symbol-avatar-4.png';


const DragDropCard = ({
    cards,
    tasks,
    cardOrder,
    setCards,
    setTasks,
    setCardOrder
}) => {

    const reorderCards = (source, destination, draggableId) => {
        const newCardOrder = Array.from(cardOrder);
        newCardOrder.splice(source.index, 1);
        newCardOrder.splice(destination.index, 0, draggableId);
        setCardOrder(newCardOrder);
    };

    const reorderTasksWithinCard = (
        card,
        sourceIdx,
        destinationIdx,
        draggableId
    ) => {
        const newTaskIds = Array.from(card.taskIds);
        newTaskIds.splice(sourceIdx, 1);
        newTaskIds.splice(destinationIdx, 0, draggableId);
        setCards({
            ...cards,
            [card.id]: {
                ...card,
                taskIds: newTaskIds
            }
        });
    };

    const moveTask = (start, finish, sourceIdx, destinationIdx, draggableId) => {
        const startTaskIds = Array.from(start.taskIds);
        startTaskIds.splice(sourceIdx, 1);
        const newStart = {
            ...start,
            taskIds: startTaskIds
        };
        const finishTaskIds = Array.from(finish.taskIds);
        finishTaskIds.splice(destinationIdx, 0, draggableId);
        const newFinish = {
            ...finish,
            taskIds: finishTaskIds
        };
        setCards({
            ...cards,
            [newStart.id]: newStart,
            [newFinish.id]: newFinish
        });
    };

    const onDragEnd = (result) => {
        const { destination, source, draggableId, type } = result;

        if (
            !destination ||
            (destination.droppableId === source.droppableId &&
                destination.index === source.index)
        ) {
            return;
        }

        if (type === "card") {
            reorderCards(source, destination, draggableId);
        } else {
            // type === tasks
            const start = cards[source.droppableId];
            const finish = cards[destination.droppableId];
            if (start.id === finish.id) {
                reorderTasksWithinCard(
                    start,
                    source.index,
                    destination.index,
                    draggableId
                );
            } else {
                moveTask(start, finish, source.index, destination.index, draggableId);
            }
        }
    };

    //Rename Board
    const boardRename = (cardID, newTitle) => {
        if (newTitle !== cards[cardID].title) {
            setCards({
                ...cards,
                [cardID]: {
                    ...cards[cardID],
                    title: newTitle
                }
            });
        }
        // setEditing(null);
    };

    //Remove Board
    const onRemoveBoard = (cardID) => {
        const newCardOrder = cardOrder.filter((id) => id !== cardID);
        setCardOrder(newCardOrder);

        const cardTaskIds = cards[cardID].taskIds;
        cardTaskIds.forEach((taskID) => delete tasks[taskID]);
        delete cards[cardID];
        setCards(cards);
        setTasks(tasks);
    };

    //Remove all task from board
    const clearBoard = (cardID) => {
        setCards({ ...cards, [cardID]: { ...cards[cardID], taskIds: [] } });
    };

    //Add New Task on Board
    const onAddNewTask = (cardID, taskName) => {
        const newTask = {
            id: nanoid(),
            symbolLogo: symbolAvatar4,
            brandName: taskName,
            price: "$16,528",
            type: "Dashboard Template",
            avatar: avatar8,
            lastUsed: "9 days"
        };
        setTasks({
            ...tasks,
            [newTask.id]: newTask
        });
        const newTaskIds = Array.from(cards[cardID].taskIds);
        newTaskIds.push(newTask.id);
        setCards({ ...cards, [cardID]: { ...cards[cardID], taskIds: newTaskIds } });
    };

    //Remove a task from a board
    const onRemoveTask = (taskID, cardID) => {
        const newTaskIds = cards[cardID].taskIds.filter((id) => id !== taskID);
        setCards({ ...cards, [cardID]: { ...cards[cardID], taskIds: newTaskIds } });
        delete tasks[taskID];
        setTasks(tasks);
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="all-cards" direction="horizontal" type="card">
                {(provided) => (

                    <div className="tasklist-wrap" {...provided.droppableProps} ref={provided.innerRef}>
                        {cardOrder.map((id, index) => {
                            const card = cards[id];
                            const cardTasks = card.taskIds.map((taskId) => tasks[taskId]);
                            return (
                                <Board
                                    key={card.id}
                                    card={card}
                                    tasks={cardTasks}
                                    index={index}
                                    renameBoard={boardRename}
                                    onRemoveBoard={onRemoveBoard}
                                    clearBoard={clearBoard}
                                    onRemoveTask={onRemoveTask}
                                    onAddNewTask={onAddNewTask}
                                />
                            );
                        })}

                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    )
}

export default DragDropCard
