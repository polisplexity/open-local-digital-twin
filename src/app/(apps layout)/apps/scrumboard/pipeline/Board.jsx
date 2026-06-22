import { useState } from 'react';
import { Button, Card, Col, Dropdown, Form, Modal, Row } from 'react-bootstrap';
import { MoreHorizontal, Plus } from 'react-feather';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import DateRangePicker from 'react-bootstrap-daterangepicker';
import HkDropZone from '@/components/@hk-drop-zone/HkDropZone';
import Task from './Task';

const Board = (props) => {

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
                        className="card-simple card-flush spipeline-list"
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        id={props.card.id}
                    >
                        <Card.Header
                            className="card-header-action"
                            {...provided.dragHandleProps}
                        >
                            <div className="spipeline-handle">
                                <h6 className="text-uppercase fw-bold mb-0">{props.card.title}</h6>
                                <div className="card-action-wrap">
                                    <Dropdown as="a">
                                        <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                            <span className="icon">
                                                <span className="feather-icon">
                                                    <MoreHorizontal />
                                                </span>
                                            </span>
                                        </Dropdown.Toggle>
                                        <Dropdown.Menu align="end">
                                            <Dropdown.Item className="edit-tasklist" onClick={handleRename}>Edit</Dropdown.Item>
                                            <Dropdown.Item className="delete-tasklist" onClick={() => props.onRemoveBoard(props.card.id)}>Delete</Dropdown.Item>
                                            <Dropdown.Item className="clear-tasklist" onClick={() => props.clearBoard(props.card.id)}>Clear All</Dropdown.Item>
                                        </Dropdown.Menu>
                                    </Dropdown>
                                </div>
                            </div>
                            <div>
                                <span>
                                    <span className="overall-estimation">
                                        $123,453
                                    </span>
                                    <span className="spipeline-dot-sep">●</span>
                                    <span className="lead-count">
                                        {props.card.taskIds.length} Leads
                                    </span>
                                </span>
                            </div>
                            <Button variant="light" className="btn-block text-primary btn-add-newtask" onClick={() => setAddNewCard(!addNewCard)} >
                                <span>
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <Plus />
                                        </span>
                                    </span>
                                    <span className="btn-text">Add Card</span>
                                </span>
                            </Button>
                        </Card.Header>
                        <Card.Body>

                            <Droppable droppableId={props.card.id} type="task">
                                {(provided, snapshot) => (
                                    <>
                                        <div
                                            className="tasklist-cards-wrap"
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                        // isDraggingOver={snapshot.isDraggingOver}
                                        >
                                            {props.tasks.map((task, index) => (
                                                <Task
                                                    key={task.id}
                                                    task={task}
                                                    index={index}
                                                    cardId={props.card.id}
                                                    onRemoveTask={props.onRemoveTask}
                                                />

                                            ))}
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

            {/* Add New Deal */}
            <Modal show={addNewCard} onHide={() => setAddNewCard(!addNewCard)} centered >
                <div className="modal-content">
                    <Modal.Body>
                        <Button bsPrefix="btn-close" onClick={() => setAddNewCard(!addNewCard)} >
                            <span aria-hidden="true">×</span>
                        </Button>
                        <h5 className="mb-4">Add New Deal</h5>
                        <Form>
                            <Row className="gx-3">
                                <Col sm={12}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Name</Form.Label>
                                        <Form.Control className="task-name" type="text" value={newCardName} onChange={e => setNewCardName(e.target.value)} />
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
                                            <Form.Control type="text" name="single-date-pick1" />
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
                                            <Form.Control type="text" name="single-date-pick2" />
                                        </DateRangePicker>
                                    </Form.Group>
                                </Col>
                                <Col sm={12}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Add Deal IN</Form.Label>
                                        <Form.Select>
                                            <option value={0}>Choose Category</option>
                                            <option value={1}>Lead IN</option>
                                            <option value={2}>Opportunity</option>
                                            <option value={3}>Proposed</option>
                                            <option value={4}>Follow Up</option>
                                            <option value={5}>Conversion</option>
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col sm={12}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Note/Description</Form.Label>
                                        <Form.Control as="textarea" rows={3} />
                                    </Form.Group>
                                </Col>
                                <Col sm={12}>
                                    <Form.Group className="mb-3">
                                        <HkDropZone className="dropify-square w-30">
                                            Upload Photo
                                        </HkDropZone>
                                    </Form.Group>
                                </Col>
                                <Col sm={12}>
                                    <div className="form-inline">
                                        <Form.Group className="mt-3">
                                            <Form.Label className="me-3">Set priority:</Form.Label>
                                            <Form.Check
                                                inline
                                                label="High"
                                                name="group1"
                                                type="radio"
                                                id={"inline-1"}
                                                defaultChecked
                                            />
                                            <Form.Check
                                                inline
                                                label="Medium"
                                                name="group1"
                                                type="radio"
                                                id={"inline-2"}
                                            />
                                            <Form.Check
                                                inline
                                                label="Low"
                                                name="group1"
                                                type="radio"
                                                id={"inline-2"}
                                            />
                                        </Form.Group>
                                    </div>
                                </Col>
                            </Row>
                        </Form>
                    </Modal.Body>
                    <Modal.Footer className="align-items-center">
                        <Button variant="secondary" onClick={() => setAddNewCard(!addNewCard)}>Cancel</Button>
                        <Button variant="primary" className="btn-add-task" onClick={onSaveTask} >Add</Button>
                    </Modal.Footer>
                </div>
            </Modal>
        </>
    )
}

export default Board
