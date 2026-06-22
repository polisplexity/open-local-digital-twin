import { useState } from 'react';
import { Button, Col, Form, InputGroup, Modal, Row } from 'react-bootstrap';
import DateRangePicker from 'react-bootstrap-daterangepicker';

const CreateNewEvent = ({ show, hide, calendarRef }) => {

    const [title, setTitle] = useState("");
    const [start, setStart] = useState(new Date());
    const [end, setEnd] = useState(new Date());
    const [backgroundColor, setBackgroundColor] = useState("#009B84");

    const updateEventList = (e) => {
        e.preventDefault()
        let calendarApi = calendarRef.current.getApi();
        calendarApi.addEvent({
            backgroundColor: backgroundColor,
            borderColor: backgroundColor,
            title: title,
            start: start,
            end: end,
        });
        hide();
    }

    const hideCalender = (ev, picker) => {
        picker.container.find(".calendar-table").hide();
    };

    return (
        <Modal show={show} onHide={hide} size="lg" centered >
            <Modal.Body>
                <Button bsPrefix='btn-close' onClick={hide} >
                    <span aria-hidden="true">×</span>
                </Button>
                <h5 className="mb-4">Create New Event</h5>
                <Form>
                    <Row className="gx-3">
                        <Col sm={12} as={Form.Group} className="mb-3" >
                            <Form.Label>Name</Form.Label>
                            <Form.Control className="cal-event-name" type="text" value={title} onChange={e => setTitle(e.target.value)} />
                        </Col>
                    </Row>
                    <Row className="gx-3">
                        <Col sm={12} as={Form.Group} className="mb-3" >
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
                                        startDate: start,
                                    }}
                                    onApply={(event, picker) => {
                                        setStart(new Date(picker.startDate));
                                    }}
                                >
                                    <Form.Control type="text" name="single-date-pick1" />
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
                                    onShow={hideCalender}
                                >
                                    <Form.Control className="input-timepicker" type="text" name="time" />
                                </DateRangePicker>
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row className="gx-3">
                        <Col sm={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>End Date</Form.Label>
                                <DateRangePicker
                                    initialSettings={{
                                        singleDatePicker: true,
                                        showDropdowns: true,
                                        startDate: end,
                                    }}
                                    onApply={(event, picker) => {
                                        setEnd(new Date(picker.startDate));
                                    }}
                                >
                                    <Form.Control type="text" name="single-date-pick2" />
                                </DateRangePicker>
                            </Form.Group>
                        </Col>
                        <Col sm={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>End Time</Form.Label>
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
                                    onShow={hideCalender}
                                >
                                    <Form.Control className="input-timepicker" type="text" name="time" />
                                </DateRangePicker>
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row className="gx-3">
                        <Col sm={12}>
                            <Form.Label>Location</Form.Label>
                            <Form.Group className="mb-3" >
                                <Form.Control type="text" />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row className="gx-3">
                        <Col sm={5}>
                            <Form.Group className="mb-3">
                                <Form.Label>Category</Form.Label>
                                <Form.Control type="text" />
                            </Form.Group>
                        </Col>
                        <Col sm={7}>
                            <Form.Group className="mb-3">
                                <Form.Label>Visibility</Form.Label>
                                <div className="d-flex">
                                    <Form.Select className="me-3" >
                                        <option value={1}>Public</option>
                                        <option value={2}>Private</option>
                                    </Form.Select>
                                    <InputGroup className="color-picker w-auto">
                                        <span className="input-group-text colorpicker-input-addon rounded-3">
                                            <Form.Control
                                                type="color"
                                                id="exampleColorInput"
                                                value={backgroundColor}
                                                title="Choose your color"
                                                onChange={e => setBackgroundColor(e.target.value)}
                                            />
                                        </span>
                                    </InputGroup>
                                </div>
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row className="gx-3">
                        <Col sm={12}>
                            <Form.Group className="mt-3">
                                <Form.Label className="me-3">Set priority:</Form.Label>
                                <Form.Check
                                    inline
                                    label="Urgent"
                                    name="group1"
                                    type="radio"
                                    id="urgent"
                                    defaultChecked
                                />
                                <Form.Check
                                    inline
                                    label="High"
                                    name="group1"
                                    type="radio"
                                    id="high"
                                />
                                <Form.Check
                                    inline
                                    label="Low"
                                    name="group1"
                                    type="radio"
                                    id="low"
                                />
                                <Form.Check
                                    inline
                                    label="Medium"
                                    name="group1"
                                    type="radio"
                                    id="medium"
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                </Form>
            </Modal.Body>
            <Modal.Footer className="align-items-center">
                <Button variant="secondary" onClick={hide} >Discard</Button>
                <Button variant="primary" className="fc-addEventButton-button" onClick={updateEventList} >Add</Button>
            </Modal.Footer>
        </Modal>
    )
}

export default CreateNewEvent
