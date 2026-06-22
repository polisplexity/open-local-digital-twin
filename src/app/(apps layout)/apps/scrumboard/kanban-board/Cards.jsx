import { useState } from 'react'
import classNames from 'classnames';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { Button, Card, Col, Dropdown, Form, Modal, Row } from 'react-bootstrap';
import { MoreHorizontal, Plus, } from 'react-feather';
import DateRangePicker from 'react-bootstrap-daterangepicker';
import PerfectScrollbar from 'react-perfect-scrollbar';
import HkBadge from '@/components/@hk-badge/@hk-badge';
import Task from './Task';

const Cards = (props) => {

    const [renameBoard, setRenameBoard] = useState(false);
    const [newBoardName, setNewBoardName] = useState("");
    const [addNewCard, setAddNewCard] = useState(false);
    const [newCardName, setNewCardName] = useState("");

    const handleRename = () => {
        setNewBoardName(props.card?.title);
        setRenameBoard(!renameBoard);
    }

    const onRenameBoard = () => {
        props.renameBoard(props.card.id, newBoardName)
        setRenameBoard(false);
    }


    const onSaveTask = (content) => {
        props.onAddNewTask(props.card?.id, newCardName);
        setNewCardName("");
        setAddNewCard(!addNewCard);
    };

    return (
        <>
            <Draggable draggableId={props.card.id} index={props.index}>
                {(provided) => (
                    <Card
                        className={classNames("card-simple card-border tasklist")}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        id={props.card.id}
                    >
                        <Card.Header
                            className="card-header-action"
                            {...provided.dragHandleProps}
                        >
                            <div className="tasklist-handle">
                                <h6 className="text-uppercase fw-bold  d-flex align-items-center mb-0">
                                    <span className="tasklist-name">{props.card.title}</span>
                                    <HkBadge bg="violet" soft pill className="ms-2">{props.card.taskIds.length}</HkBadge>
                                </h6>
                                <div className="card-action-wrap">
                                    <Dropdown>
                                        <Dropdown.Toggle as="a" href="#" className="btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret" >
                                            <span className="icon">
                                                <span className="feather-icon">
                                                    <MoreHorizontal />
                                                </span>
                                            </span>
                                        </Dropdown.Toggle>
                                        <Dropdown.Menu align="end">
                                            <Dropdown.Item className="edit-tasklist" onClick={handleRename} >Edit</Dropdown.Item>
                                            <Dropdown.Item className="delete-tasklist" onClick={() => props.onRemoveBoard(props.card.id)} >Delete</Dropdown.Item>
                                            <Dropdown.Item className="clear-tasklist" onClick={() => props.clearBoard(props.card.id)} >Clear All</Dropdown.Item>
                                        </Dropdown.Menu>
                                    </Dropdown>
                                </div>
                            </div>
                            <Button variant="white" className="btn-block btn-add-newtask" onClick={() => setAddNewCard(!addNewCard)}  >
                                <span>
                                    <span className="icon" >
                                        <span className="feather-icon">
                                            <Plus />
                                        </span>
                                    </span>
                                </span>
                            </Button>
                        </Card.Header>

                        <Card.Body as={PerfectScrollbar} >    {/* className="tasklist-cards-wrap custom-scroll" */}
                            <Droppable droppableId={props.card.id} type="task">
                                {(provided, snapshot) => (
                                    <>
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                        // isDraggingOver={snapshot.isDraggingOver}
                                        >
                                            {/* <div className="tasklist-cards-wrap"> */}
                                            {props.tasks.map((task, index) => (
                                                <Task
                                                    key={task.id}
                                                    task={task}
                                                    index={index}
                                                    cardId={props.card.id}
                                                    onRemoveTask={props.onRemoveTask}
                                                />

                                            ))}
                                            {/* </div> */}
                                        </div>

                                        {provided.placeholder}
                                    </>
                                )}
                            </Droppable>
                        </Card.Body>
                    </Card>
                )}
            </Draggable>

            {/* Board Rename */}
            <Modal Modal show={renameBoard} onHide={() => setRenameBoard(!renameBoard)} size="sm" centered >
                <Modal.Body>
                    <Button bsPrefix="btn-close" onClick={() => setRenameBoard(!renameBoard)} >
                        <span aria-hidden="true">×</span>
                    </Button>
                    <h5 className="mb-4">Edit Task List</h5>
                    <Form>
                        <Row className="gx-3">
                            <Col sm={12}>
                                <Form.Group>
                                    <Form.Label>Name</Form.Label>
                                    <Form.Control type="text" value={newBoardName} onChange={e => setNewBoardName(e.target.value)} />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Form>
                </Modal.Body>
                <div className="modal-footer align-items-center">
                    <Button variant="secondary" onClick={() => setRenameBoard(!renameBoard)} >Cancel</Button>
                    <Button variant="primary" className="btn-add-tasklist" onClick={onRenameBoard} >Add</Button>
                </div>
            </Modal >

            {/* Add New Task */}
            <Modal show={addNewCard} onHide={() => setAddNewCard(!addNewCard)} >
                <Modal.Body>
                    <Button bsPrefix="btn-close" onClick={() => setAddNewCard(!addNewCard)}>
                        <span aria-hidden="true">×</span>
                    </Button>
                    <h5 className="mb-4">Create New Card</h5>
                    <Form>
                        <Row className="gx-3">
                            <Col sm={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Name</Form.Label>
                                    <Form.Control className="task-name" type="text" name="Task_Name" value={newCardName} onChange={e => setNewCardName(e.target.value)} />
                                </Form.Group>
                            </Col>
                            <Col sm={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Start Date</Form.Label>
                                    <DateRangePicker
                                        initialSettings={{
                                            singleDatePicker: true,
                                            showDropdowns: true,
                                            startDate: new Date(),
                                        }}
                                    >
                                        <Form.Control name=" single-date-pick" type="text" />
                                    </DateRangePicker>
                                </Form.Group>
                            </Col>
                            <Col sm={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label>End Date</Form.Label>
                                    <DateRangePicker
                                        initialSettings={{
                                            singleDatePicker: true,
                                            showDropdowns: true,
                                            startDate: new Date(),
                                        }}
                                    >
                                        <Form.Control name=" single-date-pick2" type="text" />
                                    </DateRangePicker>
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Note/Description</Form.Label>
                                    <Form.Control as='textarea' rows={3} />
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group className="mt-3">
                                    <Form.Label className="me-3" >Set priority:</Form.Label>
                                    <Form.Check
                                        inline
                                        label="High"
                                        name="group1"
                                        type="radio"
                                        id="check1"
                                    />
                                    <Form.Check
                                        inline
                                        label="Medium"
                                        name="group1"
                                        type="radio"
                                        id="check2"
                                    />
                                    <Form.Check
                                        inline
                                        label="Low"
                                        name="group1"
                                        type="radio"
                                        id="check3"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Form>
                </Modal.Body>
                <Modal.Footer className="align-items-center">
                    <Button variant="secondary" onClick={() => setAddNewCard(!addNewCard)} >Cancel</Button>
                    <Button variant="primary" onClick={onSaveTask} >Add</Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}

export default Cards
