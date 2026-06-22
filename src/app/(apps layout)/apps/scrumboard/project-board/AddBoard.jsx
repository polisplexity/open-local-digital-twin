import { Button, Modal } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';

const AddBoard = ({ show, hide }) => {
    return (
        <Modal show={show} onHide={hide}>
            <Modal.Header className="header-wth-bg-inv">
                <Modal.Title as="h5">Add Board</Modal.Title>
                <Button bsPrefix="btn-close" className="text-white" onClick={hide} >
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
                                <div className="form-check">
                                    <input type="checkbox" className="form-check-input" id="customCheck2" defaultChecked />
                                </div>
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
                                <div className="form-check">
                                    <input type="checkbox" className="form-check-input" id="customCheck3" defaultChecked />
                                </div>
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
                                <div className="form-check">
                                    <input type="checkbox" className="form-check-input" id="customCheck4" />
                                </div>
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
                                <div className="form-check">
                                    <input type="checkbox" className="form-check-input" id="customCheck5" defaultChecked />
                                </div>
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
                                <div className="form-check">
                                    <input type="checkbox" className="form-check-input" id="customCheck6" defaultChecked />
                                </div>
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
                                <div className="form-check">
                                    <input type="checkbox" className="form-check-input" id="customCheck7" defaultChecked />
                                </div>
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
                                <div className="form-check">
                                    <input type="checkbox" className="form-check-input" id="customCheck8" />
                                </div>
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
                                <div className="form-check">
                                    <input type="checkbox" className="form-check-input" id="customCheck9" />
                                </div>
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
                                <div className="form-check">
                                    <input type="checkbox" className="form-check-input" id="customCheck10" />
                                </div>
                            </li>
                        </ul>
                    </SimpleBar>
                </div>
            </Modal.Body>
            <Modal.Footer className="justify-content-center">
                <Button variant="light" className="flex-1" onClick={hide}>Cancel</Button>
                <Button variant="primary" className="flex-fill flex-1" onClick={hide}>Add Board</Button>
            </Modal.Footer>
        </Modal>
    )
}

export default AddBoard
