import classNames from 'classnames';
import { Draggable } from '@hello-pangea/dnd';
import { Badge, Dropdown, Form } from 'react-bootstrap';
import { MoreVertical, Star } from 'react-feather';
import HkBadge from '@/components/@hk-badge/@hk-badge';
import Image from 'next/image';

const Task = (props) => {
    return (

        <Draggable
            draggableId={props.task.id}
            index={props.index}
        >
            {(provided, snapshot) => (

                <li
                    className={classNames("advance-list-item single-task-list active-todo", { "selected": props.task.checked })}
                    key={props.task.id}
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                >
                    <div className="d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center">

                            <Form.Check>
                                <Form.Check.Input
                                    type="checkbox"
                                // checked={task.checked}
                                // onChange={() => checkTaskList(data.id, task.id)}
                                />
                                <Form.Check.Label />
                            </Form.Check>

                            <div>
                                <span className={classNames("todo-star", { " marked": props.task.stared })}>
                                    <span className="feather-icon">
                                        <Star />
                                    </span>
                                </span>
                                <HkBadge
                                    indicator
                                    bg={props.task.indicator}
                                    className="badge-indicator-xl d-md-inline-block d-none"
                                />
                                <span className="todo-text text-dark text-truncate" onClick={props.taskInfo} >
                                    {/* onClick={showInfo} */}
                                    {props.task.task_name}
                                </span>
                                {
                                    props.task.priority && <Badge
                                        size="sm"
                                        bg="white"
                                        className={classNames("badge-sm badge-outline badge-wth-indicator badge-wth-icon ms-3 d-lg-inline-block d-none", { "badge-danger": props.task.priority === "High" || props.task.priority === "Urgent" }, { "badge-warning": props.task.priority === "Low" }, { "badge-orange": props.task.priority === "Medium" })}
                                    >
                                        <span>
                                            <i className="badge-dot ri-checkbox-blank-circle-fill" />
                                            {props.task.priority}
                                        </span>
                                    </Badge>
                                }
                            </div>
                        </div>
                        <div className="d-flex flex-shrink-0 align-items-center ms-3">
                            {
                                props.task.task_time.map((ele, i) => (
                                    <span className={
                                        classNames("todo-time d-lg-inline-block d-none me-3", (`text-${ele.text}`))}
                                        key={i}
                                    >
                                        {ele.time}
                                    </span>
                                ))
                            }
                            <div className="avatar avatar-xs avatar-rounded d-md-inline-block d-none">
                                {props.task.img && <Image src={props.task.img} alt="user" className="avatar-img" />}

                                {props.task.init_avt && props.task.init_avt.map((avt, idx) => (
                                    <div className={classNames("avatar avatar-xs avatar-rounded d-md-inline-block d-none", (`avatar-${avt.bg}`))}
                                        key={idx}
                                    >
                                        <span className="initial-wrap">{avt.text}</span>
                                    </div>
                                ))}

                            </div>
                            {
                                props.task.badge && props.task.badge.map((bdg, indx) => (
                                    <HkBadge key={indx} bg={bdg.bg} className="ms-3 d-md-inline-block d-none" >{bdg.text}</HkBadge>
                                ))
                            }
                            <Dropdown>
                                <Dropdown.Toggle variant='flush-light' className="btn-icon btn-rounded flush-soft-hover no-caret">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <MoreVertical />
                                        </span>
                                    </span>
                                </Dropdown.Toggle>
                                <Dropdown.Menu align="end" >
                                    <Dropdown.Item className="edit-task">Edit Task</Dropdown.Item>
                                    <Dropdown.Item className="view-task">View Task</Dropdown.Item>
                                    <Dropdown.Item className="delete-task" onClick={() => props.onRemoveTask(props.task.id, props.cardId)} >Delete Task</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>
                    </div>
                    {provided.placeholder}
                </li>
            )}
        </Draggable>
    )
}

export default Task
