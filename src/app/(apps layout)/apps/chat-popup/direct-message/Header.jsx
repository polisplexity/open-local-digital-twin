import Image from 'next/image';
import classNames from 'classnames';
import { Button, Dropdown, Form, InputGroup } from 'react-bootstrap';
import { MoreVertical, Users, X } from 'react-feather';

//Image
import avatar8 from '@/assets/img/avatar8.jpg';

const ChatPopupHeader = ({ show, onClose, showContact, onHideContact }) => {
    return (
        <header>
            <InputGroup className={classNames("contact-search-wrap", { "d-none": !showContact })} >
                <Form.Control type="text" className="contact-search shadow-none" placeholder="Search contact" />
                <Button variant="dark" size="sm" id="contact_list_close" className="btn-icon btn-rounded" onClick={onHideContact} >
                    <span className="icon">
                        <span className="feather-icon">
                            <X />
                        </span>
                    </span>
                </Button>
            </InputGroup>
            <div className={classNames("media-wrap", { "d-none": showContact })}>
                <div className="media">
                    <div className="media-head">
                        <div className="avatar avatar-sm avatar-rounded position-relative">
                            <Image src={avatar8} alt="user" className="avatar-img" />
                            <span className="badge badge-success badge-indicator badge-indicator-lg badge-indicator-nobdr position-bottom-end-overflow-1" />
                        </div>
                    </div>
                    <div className="media-body">
                        <div className="user-name">Evie Ono</div>
                        <div className="user-status">assistant manager</div>
                    </div>
                </div>
            </div>
            <div className={classNames("chat-popup-action d-flex", { "d-none": showContact })}>
                <Dropdown>
                    <Dropdown.Toggle variant="dark" size="sm" className="btn-icon btn-rounded no-caret">
                        <span className="icon">
                            <span className="feather-icon">
                                <MoreVertical />
                            </span>
                        </span>
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        <Dropdown.Item>
                            <i className="dropdown-icon zmdi zmdi-notifications-active" />
                            <span>Send push notifications</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <i className="dropdown-icon zmdi zmdi-volume-off" />
                            <span>Mute Chat</span>
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
                <Button variant="dark" size="sm" id="user_list" className="btn-icon btn-rounded" onClick={onHideContact} >
                    <span className="icon">
                        <span className="feather-icon">
                            <Users />
                        </span>
                    </span>
                </Button>
                <Button variant="dark" size="sm" id="close_popup" className="btn-icon btn-rounded" onClick={onClose} >
                    <span className="icon">
                        <span className="feather-icon">
                            <X />
                        </span>
                    </span>
                </Button>
            </div>
        </header>
    )
}

export default ChatPopupHeader
