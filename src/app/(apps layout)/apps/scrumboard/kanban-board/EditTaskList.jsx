import { Button, Col, Form, Modal, Row } from 'react-bootstrap';

const EditTaskList = ({ show, onHide }) => {
    return (
        <Modal size="sm" show={show} onHide={onHide} centered >
            <Modal.Body>
                <Button bsPrefix="btn-close" onClick={onHide} >
                    <span aria-hidden="true">×</span>
                </Button>
                <h5 className="mb-4">Create Task List</h5>
                <Form>
                    <Row className="gx-3">
                        <Col sm={12}>
                            <Form.Group>
                                <Form.Label>Name</Form.Label>
                                <Form.Control type="text" />
                            </Form.Group>
                        </Col>
                    </Row>
                </Form>
            </Modal.Body>
            <Modal.Footer className="align-items-center">
                <Button variant="secondary" onClick={onHide}>Cancel</Button>
                <Button variant="primary" className="btn-edit-tasklist">Save</Button>
            </Modal.Footer>
        </Modal>
    )
}

export default EditTaskList
