import { Button, Col, Form, Modal, Row } from 'react-bootstrap';

const MoreInfo = ({ show, hide }) => {
    return (
        <Modal show={show} onHide={hide} size="lg" centered >
            <Modal.Header>
                <Modal.Title as="h6">Profile Information</Modal.Title>
                <Button bsPrefix="btn-close" onClick={hide} >
                    <span aria-hidden="true">×</span>
                </Button>
            </Modal.Header>
            <Modal.Body>
                <Form>
                    <Row className="gx-3">
                        <Col sm={6}>
                            <Form.Group className="mb-3" >
                                <Form.Label>Designation</Form.Label>
                                <Form.Control type="text" defaultValue="Mandaline" placeholder="First Name" name="name1" />
                            </Form.Group>
                        </Col>
                        <Col sm={6}>
                            <Form.Group className="mb-3" >
                                <Form.Label>Company</Form.Label>
                                <Form.Control type="text" defaultValue="Shane" placeholder="Last Name" name="lastname1" />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row className="gx-3">
                        <Col sm={6}>
                            <Form.Group className="mb-3" >
                                <Form.Label>Language</Form.Label>
                                <Form.Control type="email" defaultValue="contct@hencework.com" placeholder="Email Id" name="emailid1" />
                            </Form.Group>
                        </Col>
                        <Col sm={6}>
                            <Form.Group className="mb-3" >
                                <Form.Label>Birthday</Form.Label>
                                <Form.Control type="text" defaultValue="10/24/1984" placeholder="Phone No" name="birthday1" />
                            </Form.Group>
                        </Col>
                    </Row>
                </Form>
            </Modal.Body>
            <Modal.Footer className="align-items-center">
                <Button variant="secondary" onClick={hide}>Discard</Button>
                <Button variant="primary" onClick={hide}>Update</Button>
            </Modal.Footer>
        </Modal>
    )
}

export default MoreInfo
