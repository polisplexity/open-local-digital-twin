import Image from 'next/image';
import { Button, Card, Dropdown, Form, Nav, Tab } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Briefcase, Mail, MapPin, MoreVertical, Phone } from 'react-feather';
import { faDropbox, faFacebook, faGithub, faGoogle, faGoogleDrive } from '@fortawesome/free-brands-svg-icons';
import HkCollapse from '@/components/@hk-collapse/@hk-collapse';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

//Images
import avatar1 from '@/assets/img/avatar1.jpg';
import avatar2 from '@/assets/img/avatar2.jpg';
import thumbImg from '@/assets/img/img-thumb1.jpg';

const ChatInfo = ({ infoToggle }) => {
    const { states } = useGlobalStateContext();

    return (
        <div className="chat-info">
            <SimpleBar style={{ height: "100%" }} className="nicescroll-bar">
                <Button bsPrefix="btn-close" className="info-close" onClick={infoToggle} >
                    <span aria-hidden="true">×</span>
                </Button>
                <div className="text-center">
                    {states.chatState.avatar.type === "img" && <div className="avatar avatar-xxl avatar-rounded">
                        <Image src={states.chatState.avatar.src} alt="user" className="avatar-img" />
                    </div>}
                    {states.chatState.avatar.type === "init" && <div className={`avatar avatar-${states.chatState.avatar.variant} avatar-rounded avatar-xxl`}>
                        <span className="initial-wrap">{states.chatState.avatar.title}</span>
                    </div>}
                    <div className="cp-name text-truncate mt-2">{states.chatState.userName}</div>
                    <p className="text-truncate">No phone calls Always busy</p>
                </div>
                <Tab.Container defaultActiveKey="info" >
                    <Nav justify className="nav-light nav-tabs nav-segmented-tabs active-theme mt-4">
                        <Nav.Item>
                            <Nav.Link eventKey="info" >
                                <span className="nav-link-text">Info</span>
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="files" >
                                <span className="nav-link-text">Files</span>
                            </Nav.Link>
                        </Nav.Item>
                    </Nav>
                    <Tab.Content className="mt-4">
                        <Tab.Pane eventKey="info" >
                            <Form role="search">
                                <Form.Control type="text" placeholder="Search in conversation" />
                            </Form>
                            <div className="collapse-simple mt-3">
                                <HkCollapse
                                    bsPrefix="a"
                                    href="#"
                                    targetId="gn_info"
                                    title="General Info"
                                    collapsed={false}
                                >
                                    <ul className="cp-info">
                                        <li>
                                            <a href="#">
                                                <span className="cp-icon-wrap"><span className="feather-icon">
                                                    <Briefcase />
                                                </span></span>
                                                Co-Founder
                                            </a>
                                        </li>
                                        <li>
                                            <a href="#">
                                                <span className="cp-icon-wrap"><span className="feather-icon">
                                                    <Mail />
                                                </span></span>
                                                <span className="text-primary">contact@hencework.com</span>
                                            </a>
                                        </li>
                                        <li>
                                            <a href="#">
                                                <span className="cp-icon-wrap"><span className="feather-icon">
                                                    <Phone />
                                                </span></span>
                                                +91-25-4125-2365
                                            </a>
                                        </li>
                                        <li>
                                            <a href="#">
                                                <span className="cp-icon-wrap"><span className="feather-icon">
                                                    <MapPin />
                                                </span></span>
                                                Oslo, Canada
                                            </a>
                                        </li>
                                    </ul>
                                </HkCollapse>
                                <HkCollapse
                                    bsPrefix="a"
                                    href="#"
                                    targetId="social_profile"
                                    title="Social Profile"
                                    collapsed={true}
                                >
                                    <ul className="hk-list hk-list-sm">
                                        <li>
                                            <Button variant="primary" className="btn-icon btn-rounded"><span className="icon">
                                                <FontAwesomeIcon icon={faFacebook} />
                                            </span></Button>
                                        </li>
                                        <li>
                                            <Button variant="warning" className="btn-icon btn-rounded"><span className="icon">
                                                <FontAwesomeIcon icon={faGoogleDrive} />
                                            </span></Button>
                                        </li>
                                        <li>
                                            <Button variant="info" className="btn-icon btn-rounded"><span className="icon">
                                                <FontAwesomeIcon icon={faDropbox} />
                                            </span></Button>
                                        </li>
                                        <li>
                                            <Button variant="dark" className="btn-icon btn-rounded"><span className="icon">
                                                <FontAwesomeIcon icon={faGithub} />
                                            </span></Button>
                                        </li>
                                        <li>
                                            <Button variant="danger" className="btn-icon btn-rounded"><span className="icon">
                                                <FontAwesomeIcon icon={faGoogle} />
                                            </span></Button>
                                        </li>
                                    </ul>
                                </HkCollapse>
                                <HkCollapse
                                    bsPrefix="a"
                                    href="#"
                                    targetId="biography"
                                    title="Biography"
                                    collapsed={false}
                                >
                                    <div>
                                        <p>Hello there, Huma Therman is a brilliant co-founder and a copy writer working for almost a decade for fortune 500 companies. I am well verse with multiple foreign languages and I love to produce good quality stuff. </p>
                                    </div>
                                </HkCollapse>
                                <HkCollapse
                                    bsPrefix="a"
                                    href="#"
                                    targetId="settings"
                                    title="Settings"
                                    collapsed={false}
                                >
                                    <ul className="cp-action">
                                        <li>
                                            <a href="#">
                                                Clear Chat
                                            </a>
                                        </li>
                                        <li>
                                            <a href="#">
                                                <span className="text-danger">Block Contact</span>
                                            </a>
                                        </li>
                                        <li>
                                            <a href="#">
                                                Somthing&apos;s Wrong
                                            </a>
                                        </li>
                                    </ul>
                                    <a href="#" className="d-block text-dark fs-7 mb-10">Give feedback and report conversation</a>
                                </HkCollapse>
                            </div>
                        </Tab.Pane>
                        <Tab.Pane eventKey="files" >
                            <Form role="search">
                                <Form.Control type="text" className="search-files" placeholder="Search files" />
                            </Form>
                            <div className="collapse-simple mt-3">
                                <HkCollapse
                                    bsPrefix="a"
                                    href="#"
                                    targetId="files_collapse"
                                    title="Yesterday"
                                    collapsed={false}
                                >
                                    <ul className="cp-files">
                                        <li>
                                            <div className="media">
                                                <div className="media-head">
                                                    <div className="avatar avatar-icon avatar-sm avatar-soft-blue">
                                                        <span className="initial-wrap fs-3">
                                                            <i className="ri-file-excel-2-fill" />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div>
                                                        <p className="file-name">website_content.exl</p>
                                                        <p className="file-size">2,635 KB</p>
                                                    </div>
                                                    <div>
                                                        <Dropdown>
                                                            <Dropdown.Toggle variant="flush-dark" size="sm" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" >
                                                                <span className="icon">
                                                                    <span className="feather-icon">
                                                                        <MoreVertical />
                                                                    </span>
                                                                </span>
                                                            </Dropdown.Toggle>
                                                            <Dropdown.Menu>
                                                                <Dropdown.Item>Download</Dropdown.Item>
                                                                <Dropdown.Item className="link-danger" >Delete</Dropdown.Item>
                                                            </Dropdown.Menu>
                                                        </Dropdown>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="media">
                                                <div className="media-head">
                                                    <div className="avatar avatar-icon avatar-sm avatar-soft-light">
                                                        <span className="initial-wrap fs-3">
                                                            <i className="ri-file-text-fill" />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div>
                                                        <p className="file-name">jampack.pdf</p>
                                                        <p className="file-size">1.3 GB</p>
                                                    </div>
                                                    <div>
                                                        <Dropdown>
                                                            <Dropdown.Toggle variant="flush-dark" size="sm" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" >
                                                                <span className="icon">
                                                                    <span className="feather-icon">
                                                                        <MoreVertical />
                                                                    </span>
                                                                </span>
                                                            </Dropdown.Toggle>
                                                            <Dropdown.Menu>
                                                                <Dropdown.Item>Download</Dropdown.Item>
                                                                <Dropdown.Item className="link-danger" >Delete</Dropdown.Item>
                                                            </Dropdown.Menu>
                                                        </Dropdown>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="media">
                                                <div className="media-head">
                                                    <div className="avatar avatar-icon avatar-sm avatar-soft-warning">
                                                        <span className="initial-wrap fs-3">
                                                            <i className="ri-file-zip-fill" />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div>
                                                        <p className="file-name">jampack.zip</p>
                                                        <p className="file-size">2.45 GB</p>
                                                    </div>
                                                    <div>
                                                        <Dropdown>
                                                            <Dropdown.Toggle variant="flush-dark" size="sm" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" >
                                                                <span className="icon">
                                                                    <span className="feather-icon">
                                                                        <MoreVertical />
                                                                    </span>
                                                                </span>
                                                            </Dropdown.Toggle>
                                                            <Dropdown.Menu>
                                                                <Dropdown.Item>Download</Dropdown.Item>
                                                                <Dropdown.Item className="link-danger" >Delete</Dropdown.Item>
                                                            </Dropdown.Menu>
                                                        </Dropdown>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="media">
                                                <div className="media-head">
                                                    <div className="avatar avatar-logo avatar-sm">
                                                        <span className="initial-wrap">
                                                            <Image src={avatar1} alt="user" />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div>
                                                        <p className="file-name">bruce-mars-fiEG-Pk6ZASFPk6ZASF</p>
                                                        <p className="file-size">4,178 KB</p>
                                                    </div>
                                                    <div>
                                                        <Dropdown>
                                                            <Dropdown.Toggle variant="flush-dark" size="sm" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" >
                                                                <span className="icon">
                                                                    <span className="feather-icon">
                                                                        <MoreVertical />
                                                                    </span>
                                                                </span>
                                                            </Dropdown.Toggle>
                                                            <Dropdown.Menu>
                                                                <Dropdown.Item>Download</Dropdown.Item>
                                                                <Dropdown.Item className="link-danger" >Delete</Dropdown.Item>
                                                            </Dropdown.Menu>
                                                        </Dropdown>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="media">
                                                <div className="media-head">
                                                    <div className="avatar avatar-logo avatar-sm">
                                                        <span className="initial-wrap">
                                                            <Image src={avatar2} alt="user" />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div>
                                                        <p className="file-name">jonas-kakaroto-KIPqvvTKIPqvvT</p>
                                                        <p className="file-size">951 KB</p>
                                                    </div>
                                                    <div>
                                                        <Dropdown>
                                                            <Dropdown.Toggle variant="flush-dark" size="sm" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" >
                                                                <span className="icon">
                                                                    <span className="feather-icon">
                                                                        <MoreVertical />
                                                                    </span>
                                                                </span>
                                                            </Dropdown.Toggle>
                                                            <Dropdown.Menu>
                                                                <Dropdown.Item>Download</Dropdown.Item>
                                                                <Dropdown.Item className="link-danger" >Delete</Dropdown.Item>
                                                            </Dropdown.Menu>
                                                        </Dropdown>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    </ul>
                                </HkCollapse>
                                <HkCollapse
                                    bsPrefix="a"
                                    href="#"
                                    targetId="files_collapse_1"
                                    title="23 April"
                                    collapsed={false}
                                >
                                    <ul className="cp-files">
                                        <li>
                                            <div className="media">
                                                <div className="media-head">
                                                    <div className="avatar avatar-icon avatar-sm avatar-soft-light">
                                                        <span className="initial-wrap fs-3">
                                                            <i className="ri-keynote-fill" />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div>
                                                        <p className="file-name">presentation.keynote</p>
                                                        <p className="file-size">20 KB</p>
                                                    </div>
                                                    <div>
                                                        <Dropdown>
                                                            <Dropdown.Toggle variant="flush-dark" size="sm" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" >
                                                                <span className="icon">
                                                                    <span className="feather-icon">
                                                                        <MoreVertical />
                                                                    </span>
                                                                </span>
                                                            </Dropdown.Toggle>
                                                            <Dropdown.Menu>
                                                                <Dropdown.Item>Download</Dropdown.Item>
                                                                <Dropdown.Item className="link-danger" >Delete</Dropdown.Item>
                                                            </Dropdown.Menu>
                                                        </Dropdown>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="media">
                                                <div className="media-head">
                                                    <div className="avatar avatar-icon avatar-sm avatar-soft-warning">
                                                        <span className="initial-wrap fs-3">
                                                            <i className="ri-file-zip-fill" />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div>
                                                        <p className="file-name">PACK-TRIAL.zip</p>
                                                        <p className="file-size">2.45 GB</p>
                                                    </div>
                                                    <div>
                                                        <Dropdown>
                                                            <Dropdown.Toggle variant="flush-dark" size="sm" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" >
                                                                <span className="icon">
                                                                    <span className="feather-icon">
                                                                        <MoreVertical />
                                                                    </span>
                                                                </span>
                                                            </Dropdown.Toggle>
                                                            <Dropdown.Menu>
                                                                <Dropdown.Item>Download</Dropdown.Item>
                                                                <Dropdown.Item className="link-danger" >Delete</Dropdown.Item>
                                                            </Dropdown.Menu>
                                                        </Dropdown>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="media">
                                                <div className="media-head">
                                                    <div className="avatar avatar-sm">
                                                        <Image src={thumbImg} alt="user" className="avatar-img" />
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div>
                                                        <p className="file-name">joel-mott-LaK153ghdigaghdi</p>
                                                        <p className="file-size">3,028 KB</p>
                                                    </div>
                                                    <div>
                                                        <Dropdown>
                                                            <Dropdown.Toggle variant="flush-dark" size="sm" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" >
                                                                <span className="icon">
                                                                    <span className="feather-icon">
                                                                        <MoreVertical />
                                                                    </span>
                                                                </span>
                                                            </Dropdown.Toggle>
                                                            <Dropdown.Menu>
                                                                <Dropdown.Item>Download</Dropdown.Item>
                                                                <Dropdown.Item className="link-danger" >Delete</Dropdown.Item>
                                                            </Dropdown.Menu>
                                                        </Dropdown>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    </ul>
                                </HkCollapse>
                            </div>
                        </Tab.Pane>
                    </Tab.Content>
                </Tab.Container>
            </SimpleBar >
        </div >
    )
}

export default ChatInfo;