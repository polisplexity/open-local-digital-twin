import { useState } from 'react';
import { Button, ButtonGroup, Card, Form, InputGroup } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';

const SettingPannel = ({ onHide }) => {

    const [accentClr, setAccentClr] = useState("#007D88");
    const [headingClr, setHeadingClr] = useState("#1F2327");
    const [textClr, setTextClr] = useState("#646A71")

    return (
        <div className="invoice-settings">
            <SimpleBar className="nicescroll-bar">
                <Button bsPrefix="btn-close" className="info-close" onClick={onHide}>
                    <span aria-hidden="true">×</span>
                </Button>
                <div className="collapse-simple mt-lg-0 mt-2">
                    <Card>
                        <Card.Header>
                            <a role="button" data-bs-toggle="collapse" href="#currency" aria-expanded="true">Currency</a>
                        </Card.Header>
                        <div id="currency" className="collapse show">
                            <Form.Group className="mt-2 mb-3">
                                <Form.Label>Currency Symbol</Form.Label>
                                <Form.Select>
                                    <option value={0}>US Dollar ($ USD)</option>
                                    <option value={1}>IND Rupees (₹ USD)</option>
                                </Form.Select>
                            </Form.Group>
                        </div>
                    </Card>
                    <Card>
                        <Card.Header>
                            <a role="button" data-bs-toggle="collapse" href="#typography" aria-expanded="true">Typography</a>
                        </Card.Header>
                        <div id="typography" className="collapse show">
                            <div className="form-group mt-2">
                                <Form.Label>Font</Form.Label>
                                <Form.Select>
                                    <option value={0}>Arial</option>
                                    <option value={1}>Times New Roman</option>
                                </Form.Select>
                            </div>
                            <Form.Group className="mb-3">
                                <Form.Label>Size</Form.Label>
                                <Form.Select>
                                    <option value={0}>16px</option>
                                    <option value={1}>20px</option>
                                    <option value={2}>24px</option>
                                </Form.Select>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Align</Form.Label>
                                <div>
                                    <ButtonGroup role="group">
                                        <Button variant="outline-secondary"><i className="fa fa-align-left text-primary" /></Button>
                                        <Button variant="outline-secondary"><i className="fa fa-align-center" /></Button>
                                        <Button variant="outline-secondary"><i className="fa fa-align-right" /></Button>
                                        <Button variant="outline-secondary"><i className="fa fa-align-justify" /></Button>
                                    </ButtonGroup>
                                </div>
                            </Form.Group>
                        </div>
                    </Card>
                    <Card>
                        <Card.Header>
                            <a role="button" data-bs-toggle="collapse" href="#color" aria-expanded="true">Color</a>
                        </Card.Header>
                        <div id="color" className="collapse show">
                            <div className="form-group mt-2">
                                <Form.Label>Accent</Form.Label>
                                <InputGroup className="input-group color-picker" title="Using horizontal option">
                                    <InputGroup.Text className="colorpicker-input-addon">
                                        <Form.Control
                                            type="color"
                                            id="exampleColorInput1"
                                            title="Choose your color"
                                            value={accentClr}
                                            onChange={e => setAccentClr(e.target.value)}
                                        />
                                    </InputGroup.Text>
                                    <Form.Control type="text" value={accentClr} onChange={() => setAccentClr(accentClr)} />
                                </InputGroup>
                            </div>
                            <Form.Group className="mb-3">
                                <Form.Label>Heading Color</Form.Label>
                                <InputGroup className="input-group color-picker" title="Using horizontal option">
                                    <InputGroup.Text className="colorpicker-input-addon">
                                        <Form.Control
                                            type="color"
                                            id="exampleColorInput2"
                                            title="Choose your color"
                                            value={headingClr}
                                            onChange={e => setHeadingClr(e.target.value)}
                                        />
                                    </InputGroup.Text>
                                    <Form.Control type="text" value={headingClr} onChange={() => setHeadingClr(headingClr)} />
                                </InputGroup>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Text Color</Form.Label>
                                <InputGroup className="input-group color-picker" title="Using horizontal option">
                                    <InputGroup.Text className="colorpicker-input-addon">
                                        <Form.Control
                                            type="color"
                                            id="exampleColorInput3"
                                            title="Choose your color"
                                            value={textClr}
                                            onChange={e => setTextClr(e.target.value)}
                                        />
                                    </InputGroup.Text>
                                    <Form.Control type="text" value={textClr} onChange={() => setTextClr(textClr)} />
                                </InputGroup>
                            </Form.Group>
                        </div>
                    </Card>
                    <Card>
                        <Card.Header>
                            <a role="button" data-bs-toggle="collapse" href="#action" aria-expanded="true">Actions</a>
                        </Card.Header>
                        <div id="action" className="collapse show">
                            <Form.Group className="mt-2 mb-3">
                                <Form.Label>Schedule send</Form.Label>
                                <input type="text" className="form-control" />
                            </Form.Group>
                        </div>
                    </Card>
                    <Card>
                        <Card.Header>
                            <a role="button" data-bs-toggle="collapse" href="#option" aria-expanded="true">Options</a>
                        </Card.Header>
                        <div id="option" className="collapse show">
                            <div className="button-list">
                                <Button variant='light'  className="btn-block">Get Link</Button>
                                <Button variant="light"  className="btn-block">Download Invoice</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </SimpleBar>
        </div>
    )
}

export default SettingPannel
