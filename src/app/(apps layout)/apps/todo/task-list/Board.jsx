import { Droppable } from '@hello-pangea/dnd';
import { Card } from 'react-bootstrap';
import Task from './Task';
import HkCollapse from '@/components/@hk-collapse/@hk-collapse';

const Board = (props) => {
    return (
        <div className="collapse-simple mt-4">
            <HkCollapse
                bsPrefix="a"
                href="#"
                wrapperClass="card-border"
                targetId={props.card.id}
                title={<h5 className="mb-0">{props.card.title}</h5>}
                collapsed={false}
            >
                <Droppable droppableId={props.card.id} type="task">
                    {(provided, snapshot) => (
                        <Card.Body
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                        >
                            <ul className="advance-list">
                                {props.tasks.map((task, index) => (
                                    <Task
                                        key={task.id}
                                        task={task}
                                        index={index}
                                        cardId={props.card.id}
                                        onRemoveTask={props.onRemoveTask}
                                        taskInfo={props.taskInfo}
                                    />

                                ))}

                                {provided.placeholder}
                            </ul>
                        </Card.Body>
                    )}
                </Droppable>
            </HkCollapse>
        </div>
    )
}

export default Board
