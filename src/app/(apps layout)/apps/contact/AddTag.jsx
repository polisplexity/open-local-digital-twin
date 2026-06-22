import HkTags from '@/components/@hk-tags/@hk-tags';
import { Button, Col, Form, Modal, Row } from 'react-bootstrap';

const AddTag = ({ show, hide }) => {

    const multiSelectOpt = [
        { value: "collaborator", label: "Collaborator" },
        { value: "designer", label: "Designer" },
        { value: "react-developer", label: "React Developer" },
        { value: "promotion", label: "Promotion" },
        { value: "advertisement", label: "Advertisement" },
    ]

    return (
        <Modal show={show} onHide={hide} size="sm" centered >
            <Modal.Body>
                <Button bsPrefix="btn-close" onClick={hide} >
                    <span aria-hidden="true">×</span>
                </Button>
                <h6 className="text-uppercase fw-bold mb-3">Add Tag</h6>
                <Form>
                    <Row className="gx-3">
                        <Col sm={12}>
                            <Form.Group className="mb-3" >
                                <HkTags
                                    options={multiSelectOpt}
                                    defaultValue={[multiSelectOpt[0], multiSelectOpt[1], multiSelectOpt[2], multiSelectOpt[3]]}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Button variant="primary" type="button" className="float-end" onClick={hide} >Add</Button>
                </Form>
            </Modal.Body>
        </Modal>
    )
}

export default AddTag
