import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import Board from './Board';

const DragCard = ({
    cards,
    tasks,
    cardOrder,
    setCards,
    setTasks,
    setCardOrder,
    taskInfo
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


    //Remove a task from a board
    const onRemoveTask = (taskID, cardID) => {
        const newTaskIds = cards[cardID].taskIds.filter((id) => id !== taskID);
        setCards({ ...cards, [cardID]: { ...cards[cardID], taskIds: newTaskIds } });
        delete tasks[taskID];
        setTasks(tasks);
    };


    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="all-cards" direction="vertical" type="card">
                {(provided) => (
                    <div  {...provided.droppableProps} ref={provided.innerRef} >
                        {cardOrder.map((id, index) => {
                            const card = cards[id];
                            const cardTasks = card.taskIds.map((taskId) => tasks[taskId]);
                            return (
                                <Board
                                    key={card.id}
                                    card={card}
                                    tasks={cardTasks}
                                    index={index}
                                    onRemoveTask={onRemoveTask}
                                    taskInfo={taskInfo}
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

export default DragCard
