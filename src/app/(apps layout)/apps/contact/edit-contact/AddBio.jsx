import { Button, Col, Form, Modal, Row } from 'react-bootstrap'

const AddBio = ({ show, hide }) => {
    return (
        <Modal show={show} onHide={hide} centered >
            <Modal.Header>
                <Modal.Title as="h6">Biography</Modal.Title>
                <Button bsPrefix="btn-close" onClick={hide} >
                    <span aria-hidden="true">×</span>
                </Button>
            </Modal.Header>
            <Modal.Body>
                <Form>
                    <Row className="gx-3">
                        <Col sm={12}>
                            <Form.Group className="mb-3">
                                <Form.Control as="textarea" rows={4} placeholder="Add Bio" defaultValue="Hello there, Morgan Freeman is a full-stack frontend developer working under pressure is his quality." />
                            </Form.Group>
                        </Col>
                    </Row>
                </Form>
            </Modal.Body>
            <Modal.Footer className="align-items-center">
                <Button variant="secondary" onClick={hide} >Discard</Button>
                <Button variant="primary" onClick={hide} >Update</Button>
            </Modal.Footer>
        </Modal>
    )
}

export default AddBio
