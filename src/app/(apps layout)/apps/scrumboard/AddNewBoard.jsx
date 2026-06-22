import HkDropZone from '@/components/@hk-drop-zone/HkDropZone';
import { useState } from 'react';
import { Button, Col, Form, InputGroup, Modal, Row } from 'react-bootstrap';

const AddNewBoard = ({ show, onHide }) => {
    const [avatarColor, setAvatarColor] = useState("#009B84");

    return (
        <Modal show={show} onHide={onHide}>
            <Modal.Body>
                <Button bsPrefix='btn-close' onClick={onHide} >
                    <span aria-hidden="true">×</span>
                </Button>
                <h5>Add New Board</h5>
                <p className="mb-4">You are granted limited license only for purposes of viewing the material contained on this Website.</p>
                <Form>
                    <Row className="gx-3">
                        <Col sm={12}>
                            <Form.Group className="mb-3">
                                <Form.Label>Name</Form.Label>
                                <Form.Control className="task-name" type="text" />
                            </Form.Group>
                        </Col>
                        <Col sm={12}>
                            <Form.Group className="mb-3">
                                <Form.Label>Visibility</Form.Label>
                                <Form.Select>
                                    <option value={1}>Public</option>
                                    <option value={2}>Private</option>
                                </Form.Select>
                                <small className="form-text text-muted">
                                    Public setting will be seen by everybody with login details.
                                </small>
                            </Form.Group>
                        </Col>
                        <Col sm={12}>
                            <Form.Group className="mb-3">
                                <Form.Label>Avatar</Form.Label>
                                <Form.Select>
                                    <option value={1}>Choose Avatar-Text</option>
                                    <option value={2}>A</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col sm={12}>
                            <Form.Group className="mb-3">
                                <Form.Label>Avatar Color</Form.Label>
                                <InputGroup className="color-picker">
                                    <InputGroup.Text className="colorpicker-input-addon" >
                                        <Form.Control
                                            type="color"
                                            value={avatarColor}
                                            onChange={e => setAvatarColor(e.target.value)}
                                        />
                                    </InputGroup.Text>
                                    <Form.Control type="text" value={avatarColor} />
                                </InputGroup>

                            </Form.Group>
                        </Col>
                        <Col sm={6}>
                            <Form.Group className="mb-3">
                                <HkDropZone className="dropify-square w-60">
                                    Upload Photo
                                </HkDropZone>
                            </Form.Group>
                        </Col>
                    </Row>
                </Form>
            </Modal.Body>
            <Modal.Footer className="align-items-center">
                <Button variant="secondary" onClick={onHide}>Cancel</Button>
                <Button variant="primary" onClick={onHide} >Add</Button>
            </Modal.Footer>
        </Modal>
    )
}

export default AddNewBoard
