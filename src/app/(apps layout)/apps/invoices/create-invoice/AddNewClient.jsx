import { Button, Col, Form, Modal, Row } from 'react-bootstrap';

const AddNewClient = ({ show, hide }) => {
    return (
        <Modal show={show} onHide={hide} centered >
            <Modal.Body>
                <Button bsPrefix="btn-close" onClick={hide} >
                    <span aria-hidden="true">×</span>
                </Button>
                <h5 className="mb-5">Billed To</h5>
                <Form>
                    <Row className="gx-3">
                        <Col sm={12} as={Form.Group} className="mb-3" >
                            <Form.Label>Company Name</Form.Label>
                            <Form.Control type="text" defaultValue="Supernova Consultants" />
                        </Col>
                        <Col sm={12} as={Form.Group} className="mb-3" >
                            <Form.Label>Email ID</Form.Label>
                            <Form.Control type="email" defaultValue="thompson_peter@super.co" />
                        </Col>
                        <Col sm={12} as={Form.Group} className="mb-3" >
                            <Form.Label>Address Line One</Form.Label>
                            <Form.Control type="text" defaultValue="Sycamore Street" />
                        </Col>
                        <Col sm={12} as={Form.Group} className="mb-3" >
                            <Form.Label>Address Line Two</Form.Label>
                            <Form.Control type="text" defaultValue="San Antonio Valley, CA 34668" />
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

export default AddNewClient
