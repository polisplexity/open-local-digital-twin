import { Button, Col, Form, Modal, Row } from 'react-bootstrap';

const EditInfo = ({ show, hide }) => {
    return (
        <Modal show={show} onHide={hide} centered >
            <Modal.Body>
                <Button bsPrefix="btn-close" onClick={hide} >
                    <span aria-hidden="true">×</span>
                </Button>
                <h5 className="mb-5">Edit Info</h5>
                <Form>
                    <Row className="gx-3">
                        <Col sm={12} as={Form.Group} className="mb-3" >
                            <Form.Label>Company Name</Form.Label>
                            <Form.Control type="text" defaultValue="Hencework" />
                        </Col>
                        <Col sm={12} as={Form.Group} className="mb-3" >
                            <Form.Label>Email ID</Form.Label>
                            <Form.Control type="email" defaultValue="jampack_01@hencework.com" />
                        </Col>
                        <Col sm={12} as={Form.Group} className="mb-3" >
                            <Form.Label>Address Line One</Form.Label>
                            <Form.Control type="text" defaultValue="4747, Pearl Street Rainy day Drive" />
                        </Col>
                        <Col sm={12} as={Form.Group} className="mb-3" >
                            <Form.Label>Address Line Two</Form.Label>
                            <Form.Control type="text" defaultValue="Washington DC 42341" />
                        </Col>
                    </Row>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={hide} >Discard</Button>
                <Button variant="primary" onClick={hide}>Add</Button>
            </Modal.Footer>
        </Modal>
    )
}

export default EditInfo
