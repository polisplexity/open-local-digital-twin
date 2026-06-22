import { Button, Col, Form, Modal, Row } from 'react-bootstrap';
import { Rating } from 'react-simple-star-rating';

const ReviewModal = ({ show, closeModal }) => {
    return (
        <Modal centered show={show} id="add_new_review" onHide={closeModal} className="add-new-task" >
            <Modal.Body>
                <Button bsPrefix="btn-close" onClick={closeModal} >
                    <span aria-hidden="true">×</span>
                </Button>
                <h5 className="mb-4">Write a review</h5>
                <Form>
                    <Row sm>
                        <Col md={12}>
                            <Form.Group className="mb-3">
                                <Form.Label>Your rating</Form.Label>
                                <div>
                                    <Rating initialValue={1} allowFraction size="20" className="d-flex align-items-center me-2" />
                                </div>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Reason Line</Form.Label>
                                <Form.Select>
                                    <option value={1}>Design Quality</option>
                                    <option value={2}>Customer Support</option>
                                </Form.Select>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <div className="form-label-group">
                                    <Form.Label>Comments</Form.Label>
                                    <small className="text-muted">2000</small>
                                </div>
                                <Form.Control as="textarea" rows={3} placeholder="Please describe the reason for your rating" />
                            </Form.Group>
                        </Col>
                    </Row>
                </Form>
            </Modal.Body>
            <Modal.Footer className="align-items-center">
                <Button variant="secondary" onClick={closeModal} >Discard</Button>
                <Button variant="primary">Send Review</Button>
            </Modal.Footer>
        </Modal>
    )
}

export default ReviewModal
