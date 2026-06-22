import { Button, Col, Form, Modal, Row } from 'react-bootstrap';
import DateRangePicker from 'react-bootstrap-daterangepicker';

const SetReminder = ({ show, hide }) => {
    return (
        <Modal show={show} onHide={hide} centered >
            <Modal.Body>
                <Button bsPrefix="btn-close" onClick={hide} >
                    <span aria-hidden="true">×</span>
                </Button>
                <h5 className="mb-4">Create a Reminder</h5>
                <Form>
                    <Row className="gx-3">
                        <Col sm={12} as={Form.Group} className="mb-3" >
                            <Form.Label>Name</Form.Label>
                            <Form.Control type="text" />
                        </Col>
                    </Row>
                    <Row className="gx-3">
                        <Col sm={12} as={Form.Group} className="mb-3">
                            <div className="form-label-group">
                                <Form.Label>Note/Description</Form.Label>
                                <small className="text-muted">200</small>
                            </div>
                            <Form.Control as="textarea" rows={3} />
                        </Col>
                    </Row>
                    <Row className="gx-3">
                        <Col sm={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Start Date</Form.Label>
                                <DateRangePicker
                                    initialSettings={{
                                        singleDatePicker: true,
                                        showDropdowns: true,
                                        startDate: new Date(),
                                    }}
                                >
                                    <Form.Control type="text" name="single-date-pick" />
                                </DateRangePicker>
                            </Form.Group>
                        </Col>
                        <Col sm={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Start Time</Form.Label>
                                <DateRangePicker
                                    initialSettings={{
                                        singleDatePicker: true,
                                        timePicker: true,
                                        timePicker24Hour: true,
                                        timePickerIncrement: 1,
                                        timePickerSeconds: true,
                                        locale: {
                                            format: 'HH:mm:ss'
                                        }
                                    }}
                                    onShow={function (ev, picker) {
                                        picker.container.find(".calendar-table").hide();
                                    }}
                                >
                                    <Form.Control className="input-timepicker" type="text" name="time" />
                                </DateRangePicker>
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row className="gx-3">
                        <Col sm={12}>
                            <Form.Group className="mb-3">
                                <Form.Label>Remind</Form.Label>
                                <Form.Select className="me-20">
                                    <option value={0}>Daily</option>
                                    <option value={1}>Monthly</option>
                                    <option value={2}>Weekly</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                    </Row>
                </Form>
            </Modal.Body>
            <Modal.Footer className="align-items-center">
                <Button variant="secondary" onClick={hide} >Discard</Button>
                <Button variant="primary" onClick={hide}>Add</Button>
            </Modal.Footer>
        </Modal >
    )
}

export default SetReminder
