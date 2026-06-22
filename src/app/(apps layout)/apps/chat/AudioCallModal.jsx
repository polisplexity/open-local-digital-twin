import { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import * as Icons from 'react-feather';

//Image
import avatar8 from '@/assets/img/avatar8.jpg';
import avatar13 from '@/assets/img/avatar13.jpg';
import Image from 'next/image';

const AudioCallModal = ({ show, hide }) => {
    const [fullScreen, setFullScreen] = useState(false);
    return (
        <Modal show={show} onHide={hide} fullscreen={fullScreen} centered size='xl' dialogClassName="chatapp-call-window" className="ps-0" >
            <Modal.Header className="header-wth-bg">
                <Modal.Title as="h6" className="text-muted">Jampack Audio Call</Modal.Title>
                <div className="modal-action">
                    <Button variant="flush-dark" size="xs" className="btn-icon btn-rounded flush-soft-hover modal-fullscreen-togglable" onClick={() => setFullScreen(!fullScreen)} >
                        <span className="icon">
                            <span className="feather-icon">
                                {fullScreen ? <Icons.Minimize /> : <Icons.Maximize />}
                            </span>
                        </span>
                    </Button>
                    <Button variant="flush-dark" size="xs" className="btn-icon btn-rounded flush-soft-hover">
                        <span className="icon">
                            <span className="feather-icon">
                                <Icons.HelpCircle />
                            </span>
                        </span>
                    </Button>
                </div>
            </Modal.Header>
            <Modal.Body >
                <div className="avatar avatar-xxxl avatar-rounded d-20">
                    <Image src={avatar8} alt="user" className="avatar-img" />
                </div>
                <h3 className="mt-3">Huma Therman</h3>
                <p>Audio Calling<span className="one">.</span><span className="two">.</span><span className="three">.</span></p>
            </Modal.Body>
            <Modal.Footer>
                <ul className="chatapp-call-action hk-list">
                    <li>
                        <Button variant="soft-light" className="btn-icon btn-lg btn-rounded">
                            <span className="icon">
                                <span className="feather-icon">
                                    <Icons.Mic />
                                </span>
                            </span>
                        </Button>
                    </li>
                    <li>
                        <Button variant="soft-light" className="btn-icon btn-lg btn-rounded">
                            <span className="icon">
                                <span className="feather-icon">
                                    <Icons.Video />
                                </span>
                            </span>
                        </Button>
                    </li>
                    <li>
                        <Button variant="danger" className="btn-icon btn-lg btn-rounded" onClick={hide} >
                            <span className="icon">
                                <span className="feather-icon">
                                    <Icons.Phone />
                                </span>
                            </span>
                        </Button>
                    </li>
                    <li>
                        <Button variant="soft-light" className="btn-icon btn-lg btn-rounded">
                            <span className="icon">
                                <span className="feather-icon">
                                    <Icons.UserPlus />
                                </span>
                            </span>
                        </Button>
                    </li>
                    <li>
                        <Button variant="soft-light" className="btn-icon btn-lg btn-rounded">
                            <span className="icon">
                                <span className="feather-icon">
                                    <Icons.MoreVertical />
                                </span>
                            </span>
                        </Button>
                    </li>
                </ul>
                <div className="avatar avatar-lg avatar-rounded chatapp-caller-img">
                    <Image src={avatar13} alt="user" className="avatar-img" />
                </div>
            </Modal.Footer>
        </Modal>
    )
}

export default AudioCallModal
