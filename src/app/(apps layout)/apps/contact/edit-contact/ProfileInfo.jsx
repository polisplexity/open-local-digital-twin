import { Button, Col, Form, Modal, Row } from 'react-bootstrap';

const ProfileInfo = ({ show, hide }) => {
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
                            <Form.Group className="mb-3">
                                <Form.Label>First Name</Form.Label>
                                <Form.Control type="text" defaultValue="Mandaline" placeholder="First Name" name="name" />
                            </Form.Group>
                        </Col>
                        <Col sm={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Last Name</Form.Label>
                                <Form.Control type="text" defaultValue="Shane" placeholder="Last Name" name="lastname" />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row className="gx-3">
                        <Col sm={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Email ID</Form.Label>
                                <Form.Control type="email" defaultValue="contct@hencework.com" placeholder="Email Id" name="emailid" />
                            </Form.Group>
                        </Col>
                        <Col sm={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Phone</Form.Label>
                                <Form.Control type="text" defaultValue="+91-25-4125-2365" placeholder="Phone No" name="phone" />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row className="gx-3">
                        <div className="col-sm-12">
                            <Form.Label>Location</Form.Label>
                            <Form.Group className="mb-3">
                                <Form.Control type="text" defaultValue="Lane 1" placeholder="Line 1" name="add1" />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Control type="text" defaultValue="Newyork" placeholder="Line 2" name="add2" />
                            </Form.Group>
                        </div>
                    </Row>
                </Form>
            </Modal.Body>
            <Modal.Footer className="align-items-center">
                <Button variant="secondary" onClick={hide}>Discard</Button>
                <Button variant="primary" onClick={hide} >Update</Button>
            </Modal.Footer>
        </Modal >
    )
}

export default ProfileInfo;
