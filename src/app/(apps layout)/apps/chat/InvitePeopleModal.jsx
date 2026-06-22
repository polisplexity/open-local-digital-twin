import Image from 'next/image';
import { Button, Form, Modal } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';
//Images
import avatar1 from '@/assets/img/avatar1.jpg';
import avatar2 from '@/assets/img/avatar2.jpg';
import avatar3 from '@/assets/img/avatar3.jpg';
import avatar5 from '@/assets/img/avatar5.jpg';
import avatar6 from '@/assets/img/avatar6.jpg';
import avatar7 from '@/assets/img/avatar7.jpg';

const InvitePeopleModal = ({ show, onClose }) => {
    return (
        <Modal show={show} onHide={onClose} centered dialogClassName="mw-400p" >
            <Modal.Header className="header-wth-bg-inv">
                <Modal.Title as="h5">Invite People</Modal.Title>
                <Button bsPrefix="btn-close" className="text-white" onClick={onClose} >
                    <span aria-hidden="true">×</span>
                </Button>
            </Modal.Header>
            <Modal.Body className="p-0">
                <Form className="m-3" role="search">
                    <Form.Control type="text" className="rounded-input user-search" placeholder="Search People" />
                </Form>
                <div className="h-350p">
                    <SimpleBar style={{ height: "100%" }} className="nicescroll-bar">
                        <ul className="invite-user-list">
                            <li>
                                <div className="media d-flex align-items-center">
                                    <div className="media-head me-3">
                                        <div className="avatar avatar-sm avatar-rounded">
                                            <Image src={avatar2} alt="user" className="avatar-img" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="user-name">Morgan Freeman</div>
                                    </div>
                                </div>
                                <div>
                                    <Form.Check type="checkbox" id="customCheck2" />
                                </div>
                            </li>
                            <li>
                                <div className="media d-flex align-items-center me-3 mb-2">
                                    <div className="media-head me-3">
                                        <div className="avatar avatar-sm avatar-rounded">
                                            <Image src={avatar7} alt="user" className="avatar-img" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="user-name">Huma Therman</div>
                                    </div>
                                </div>
                                <div>
                                    <Form.Check type="checkbox" id="customCheck3" />
                                </div>
                            </li>
                            <li>
                                <div className="media d-flex align-items-center me-3 mb-2">
                                    <div className="media-head me-3">
                                        <div className="avatar avatar-sm avatar-rounded">
                                            <Image src={avatar3} alt="user" className="avatar-img" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="user-name">Charlie Chaplin</div>
                                    </div>
                                </div>
                                <div>
                                    <Form.Check type="checkbox" id="customCheck4" />
                                </div>
                            </li>
                            <li>
                                <div className="media d-flex align-items-center me-3 mb-2">
                                    <div className="media-head me-3">
                                        <div className="avatar avatar-sm avatar-soft-danger avatar-rounded">
                                            <span className="initial-wrap">W</span>
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="user-name">Winston Churchil</div>
                                    </div>
                                </div>
                                <div>
                                    <Form.Check type="checkbox" id="customCheck5" />
                                </div>

                            </li>
                            <li>
                                <div className="media d-flex align-items-center me-3 mb-2">
                                    <div className="media-head me-3">
                                        <div className="avatar avatar-sm avatar-rounded">
                                            <Image src={avatar1} alt="user" className="avatar-img" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="user-name">Office Board</div>
                                    </div>
                                </div>
                                <div>
                                    <Form.Check type="checkbox" id="customCheck6" />
                                </div>

                            </li>
                            <li>
                                <div className="media d-flex align-items-center me-3 mb-2">
                                    <div className="media-head me-3">
                                        <div className="avatar avatar-sm avatar-rounded">
                                            <Image src={avatar6} alt="user" className="avatar-img" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="user-name">Boss Baby</div>
                                    </div>
                                </div>
                                <div>
                                    <Form.Check type="checkbox" id="customCheck7" />
                                </div>

                            </li>
                            <li>
                                <div className="media d-flex align-items-center me-3 mb-2">
                                    <div className="media-head me-3">
                                        <div className="avatar avatar-sm avatar-rounded">
                                            <Image src={avatar5} alt="user" className="avatar-img" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="user-name">Jaquiline Joker</div>
                                    </div>
                                </div>
                                <div>
                                    <Form.Check type="checkbox" id="customCheck8" />
                                </div>

                            </li>
                        </ul>
                    </SimpleBar>
                </div>
            </Modal.Body>
            <Modal.Footer className="justify-content-center">
                <Button variant='light' className="flex-fill flex-1" onClick={onClose} >Cancel</Button>
                <Button variant="primary" className="flex-fill flex-1">Invite for chat</Button>
            </Modal.Footer>
        </Modal>

    )
}

export default InvitePeopleModal
