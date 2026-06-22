import HkDropZone from '@/components/@hk-drop-zone/HkDropZone';
import { Button, Col, Form, Modal, Row } from 'react-bootstrap';

const AddNewMember = ({ show, hide }) => {
    return (
        <Modal show={show} onHide={hide} centered >
                <Modal.Body>
                    <Button bsPrefix="btn-close" onClick={hide} >
                        <span aria-hidden="true">×</span>
                    </Button>
                    <h5 className="mb-4">Add New Member</h5>
                    <Form>
                        <Row className="gx-3">
                            <Col sm={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Name</Form.Label>
                                    <Form.Control type="text" />
                                </Form.Group>
                            </Col>
                            <Col sm={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Email Id</Form.Label>
                                    <Form.Control type="text" />
                                </Form.Group>
                            </Col>
                            <Col sm={12}>
                                <Form.Group className="mb-3">
                                    <HkDropZone className="dropify-square w-30">
                                        Upload Photo
                                    </HkDropZone>
                                </Form.Group>
                            </Col>
                        </Row>
                    </Form>
                </Modal.Body>
                <Modal.Footer className="align-items-center">
                    <Button variant="secondary" onClick={hide} >Cancel</Button>
                    <Button variant="primary" onClick={hide}>Add</Button>
                </Modal.Footer>
        </Modal>
    )
}

export default AddNewMember
