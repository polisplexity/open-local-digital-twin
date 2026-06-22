import { Button, Form, Modal } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';

const AddNewFavBoard = ({ show, onHide }) => {
    return (
        <Modal show={show} onHide={onHide} centered dialogClassName="mw-400p" >
            <Modal.Header className="header-wth-bg-inv">
                <Modal.Title as="h5">Add Board</Modal.Title>
                <Button bsPrefix="btn-close" className="text-white" onClick={onHide} >
                    <span aria-hidden="true">×</span>
                </Button>
            </Modal.Header>
            <Modal.Body className="p-0">
                <div>
                    <SimpleBar className="nicescroll-bar h-350p">
                        <ul className="p-3 pb-0">
                            <li className="d-flex align-items-center justify-content-between mb-3">
                                <div className="media d-flex align-items-center">
                                    <div className="media-head me-2">
                                        <div className="avatar avatar-xs avatar-primary avatar-rounded">
                                            <span className="initial-wrap">J</span>
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="name">Jampack</div>
                                    </div>
                                </div>
                                <Form.Check
                                    type="checkbox"
                                    id="customCheck2"
                                    defaultChecked
                                />
                            </li>
                            <li className="d-flex align-items-center justify-content-between mb-3">
                                <div className="media d-flex align-items-center">
                                    <div className="media-head me-2">
                                        <div className="avatar avatar-xs avatar-danger avatar-rounded">
                                            <span className="initial-wrap">H</span>
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="name">Hencework</div>
                                    </div>
                                </div>
                                <Form.Check
                                    type="checkbox"
                                    id="customCheck3"
                                    defaultChecked
                                />
                            </li>
                            <li className="d-flex align-items-center justify-content-between mb-3">
                                <div className="media d-flex align-items-center">
                                    <div className="media-head me-2">
                                        <div className="avatar avatar-xs avatar-info avatar-rounded">
                                            <span className="initial-wrap">G</span>
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="name">Griffin</div>
                                    </div>
                                </div>
                                <Form.Check
                                    type="checkbox"
                                    id="customCheck4"
                                />
                            </li>
                            <li className="d-flex align-items-center justify-content-between mb-3">
                                <div className="media d-flex align-items-center">
                                    <div className="media-head me-2">
                                        <div className="avatar avatar-xs avatar-warning avatar-rounded">
                                            <span className="initial-wrap">R</span>
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="name">React - Jampack</div>
                                    </div>
                                </div>
                                <Form.Check
                                    type="checkbox"
                                    id="customCheck5"
                                    defaultChecked
                                />
                            </li>
                            <li className="d-flex align-items-center justify-content-between mb-3">
                                <div className="media d-flex align-items-center">
                                    <div className="media-head me-2">
                                        <div className="avatar avatar-xs avatar-primary avatar-rounded">
                                            <span className="initial-wrap">P</span>
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="name">Pangong</div>
                                    </div>
                                </div>
                                <Form.Check
                                    type="checkbox"
                                    id="customCheck6"
                                    defaultChecked
                                />
                            </li>
                            <li className="d-flex align-items-center justify-content-between mb-3">
                                <div className="media d-flex align-items-center">
                                    <div className="media-head me-2">
                                        <div className="avatar avatar-xs avatar-success avatar-rounded">
                                            <span className="initial-wrap">A</span>
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="name">Angular - Jampack</div>
                                    </div>
                                </div>
                                <Form.Check
                                    type="checkbox"
                                    id="customCheck7"
                                    defaultChecked
                                />
                            </li>
                            <li className="d-flex align-items-center justify-content-between mb-3">
                                <div className="media d-flex align-items-center">
                                    <div className="media-head me-2">
                                        <div className="avatar avatar-xs avatar-warning avatar-rounded">
                                            <span className="initial-wrap">R</span>
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="name">React - Jampack</div>
                                    </div>
                                </div>
                                <Form.Check
                                    type="checkbox"
                                    id="customCheck8"
                                />
                            </li>
                            <li className="d-flex align-items-center justify-content-between mb-3">
                                <div className="media d-flex align-items-center">
                                    <div className="media-head me-2">
                                        <div className="avatar avatar-xs avatar-primary avatar-rounded">
                                            <span className="initial-wrap">P</span>
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="name">Pangong</div>
                                    </div>
                                </div>
                                <Form.Check
                                    type="checkbox"
                                    id="customCheck9"
                                />
                            </li>
                            <li className="d-flex align-items-center justify-content-between mb-3">
                                <div className="media d-flex align-items-center">
                                    <div className="media-head me-2">
                                        <div className="avatar avatar-xs avatar-success avatar-rounded">
                                            <span className="initial-wrap">A</span>
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="name">Angular - Jampack</div>
                                    </div>
                                </div>
                                <Form.Check
                                    type="checkbox"
                                    id="customCheck10"
                                />
                            </li>
                        </ul>
                    </SimpleBar>
                </div>
            </Modal.Body>
            <Modal.Footer className="justify-content-center">
                <Button variant="light" className="flex-1" onClick={onHide}>Cancel</Button>
                <Button variant="primary" className="flex-fill flex-1" onClick={onHide}>Add Board</Button>
            </Modal.Footer>
        </Modal>

    )
}

export default AddNewFavBoard
