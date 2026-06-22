import Link from 'next/link';
import { Button, Card, Col, Dropdown, Form, Modal, Nav, Row, Tab } from 'react-bootstrap';
import { Rating } from 'react-simple-star-rating';
import { Activity, Archive, CheckSquare, ChevronLeft, ChevronRight, Clock, Edit2, Edit3, Heart, Mail, MoreVertical, Phone, Plus, Shield, Slash, Star, Trash, Upload, Video, XSquare, Zap } from 'react-feather';
import SimpleBar from 'simplebar-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBehance, faDropbox, faGithub, faGoogleDrive } from '@fortawesome/free-brands-svg-icons';
import HkAvatarUploader from '@/components/@hk-avatar-uploader/@hk-avatar-uploader';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';

//Image
import avatar2 from '@/assets/img/avatar2.jpg';

const ContactDetails = ({ show, onHide }) => {
    return (
        <Modal show={show} onHide={onHide} centered size="xl" dialogClassName="contact-detail-modal" >
            <Modal.Body className="p-0">
                <header className="contact-header">
                    <div className="d-flex align-items-center">
                        <span className="me-3">
                            <HkAvatarUploader
                                defaultImg={avatar2}
                            />
                        </span>
                        <div>
                            <div className="cp-name text-truncate">Mendaline Shane</div>
                            <p>No phone calls Always busy</p>
                            <Rating initialValue={3} readonly size="20" />
                        </div>
                    </div>
                    <div className="contact-options-wrap">
                        <ul className="hk-list hk-list-sm justify-content-center d-xl-flex d-none">
                            <li>
                                <a className="btn btn-icon btn-soft-primary btn-rounded" href="#some">
                                    <span className="btn-icon-wrap">
                                        <span className="feather-icon">
                                            <Mail />
                                        </span>
                                    </span>
                                </a>
                            </li>
                            <li>
                                <a className="btn btn-icon btn-soft-success btn-rounded" href="#some">
                                    <span className="btn-icon-wrap">
                                        <span className="feather-icon">
                                            <Phone />
                                        </span>
                                    </span>
                                </a>
                            </li>
                            <li>
                                <a className="btn btn-icon btn-soft-danger btn-rounded" href="#some">
                                    <span className="btn-icon-wrap">
                                        <span className="feather-icon">
                                            <Video />
                                        </span>
                                    </span>
                                </a>
                            </li>
                        </ul>
                        <Dropdown className="mx-3  d-xl-block d-none">
                            <Dropdown.Toggle variant="light" type="button">Action</Dropdown.Toggle>
                            <Dropdown.Menu>
                                <Dropdown.Item>Action</Dropdown.Item>
                                <Dropdown.Item>Another action</Dropdown.Item>
                                <Dropdown.Item>Something else here</Dropdown.Item>
                                <div className="dropdown-divider" />
                                <Dropdown.Item>Separated link</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                        <div className="align-items-center d-xl-flex d-none">1 - 10 of 30</div>
                        <Link href="#" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover contactapp-info-toggle  d-xl-inline-block d-none">
                            <HkTooltip placement="top" title="Previous">
                                <span className="btn-icon-wrap">
                                    <span className="feather-icon">
                                        <ChevronLeft />
                                    </span>
                                </span>
                            </HkTooltip>
                        </Link>
                        <Link href="#" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover contactapp-info-toggle  d-xl-inline-block d-none">
                            <HkTooltip placement="top" title="Previous">
                                <span className="btn-icon-wrap">
                                    <span className="feather-icon">
                                        <ChevronRight />
                                    </span>
                                </span>
                            </HkTooltip>
                        </Link>
                        <Dropdown as="a" href="#some" >
                            <Dropdown.Toggle className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover dropdown-toggle no-caret  d-xl-inline-block d-nonet" >
                                <span className="btn-icon-wrap">
                                    <span className="feather-icon">
                                        <MoreVertical />
                                    </span>
                                </span>
                            </Dropdown.Toggle>
                            <Dropdown.Menu align="end" >
                                <Dropdown.Item>
                                    <span className="feather-icon dropdown-icon">
                                        <Star />
                                    </span>
                                    <span>Stared Messages</span>
                                </Dropdown.Item>
                                <Dropdown.Item>
                                    <span className="feather-icon dropdown-icon">
                                        <Archive />
                                    </span>
                                    <span>Archive Messages</span>
                                </Dropdown.Item>
                                <Dropdown.Divider as="div" />
                                <Dropdown.Item>
                                    <span className="feather-icon dropdown-icon">
                                        <Slash />
                                    </span>
                                    <span>Block Content</span>
                                </Dropdown.Item>
                                <Dropdown.Item as={Link} to="/apps/email">
                                    <span className="feather-icon dropdown-icon">
                                        <XSquare />
                                    </span>
                                    <span>Close</span>
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </div>
                </header>
                <div className="contact-body contact-detail-body">
                    <SimpleBar className='nicescroll-bar' >
                        <div className="d-flex flex-xl-nowrap flex-wrap">
                            <div className="contact-info w-xl-35 w-100">
                                <Dropdown className="action-btn">
                                    <Dropdown.Toggle className="btn btn-light dropdown-toggle " type="button">Action</Dropdown.Toggle>
                                    <Dropdown.Menu>
                                        <Dropdown.Item>Action</Dropdown.Item>
                                        <Dropdown.Item>Another action</Dropdown.Item>
                                        <Dropdown.Item>Something else here</Dropdown.Item>
                                        <Dropdown.Divider as="div" />
                                        <Dropdown.Item>Separated link</Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                                <Card>
                                    <Card.Header>
                                        <a href="#some">Profile Information</a>
                                        <Button size="xs" variant="light" className="btn-icon btn-rounded">
                                            <HkTooltip placement="top" title="Edit">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <Edit2 />
                                                    </span>
                                                </span>
                                            </HkTooltip>
                                        </Button>
                                    </Card.Header>
                                    <Card.Body>
                                        <ul className="cp-info">
                                            <li>
                                                <span>First name</span>
                                                <span>Morgan</span>
                                            </li>
                                            <li>
                                                <span>Last name</span>
                                                <span>Freeman</span>
                                            </li>
                                            <li>
                                                <span>Email</span>
                                                <span>morgan@flights.com</span>
                                            </li>
                                            <li>
                                                <span>Phone</span>
                                                <span>+912-4532-1234</span>
                                            </li>
                                            <li>
                                                <span>Location</span>
                                                <span>Newyork</span>
                                            </li>
                                        </ul>
                                    </Card.Body>
                                </Card>
                                <div className="separator-full" />
                                <Card>
                                    <Card.Header>
                                        <a href="#some">More Info</a>
                                        <Button size="xs" variant="light" className="btn-icon btn-rounded">
                                            <HkTooltip placement="top" title="Edit">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <Edit2 />
                                                    </span>
                                                </span>
                                            </HkTooltip>
                                        </Button>
                                    </Card.Header>
                                    <Card.Body>
                                        <ul className="cp-info">
                                            <li>
                                                <span>Designation</span>
                                                <span>Morgan</span>
                                            </li>
                                            <li>
                                                <span>Company</span>
                                                <span>Freeman</span>
                                            </li>
                                            <li>
                                                <span>Language</span>
                                                <span>morgan@flights.com</span>
                                            </li>
                                            <li>
                                                <span>Birthday</span>
                                                <span>-</span>
                                            </li>
                                            <li>
                                                <span>Location</span>
                                                <span>Newyork</span>
                                            </li>
                                        </ul>
                                    </Card.Body>
                                </Card>
                                <div className="separator-full" />
                                <Card>
                                    <Card.Header>
                                        <a href="#some">Tags</a>
                                        <Button variant="light" size="xs" className="btn-icon btn-rounded">
                                            <HkTooltip placement="top" title="Add Tags">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <Plus />
                                                    </span>
                                                </span>
                                            </HkTooltip>
                                        </Button>
                                    </Card.Header>
                                    <Card.Body>
                                        <span className="badge badge-soft-violet">Collaboration</span>
                                        <span className="badge badge-soft-danger">React Developer</span>
                                    </Card.Body>
                                </Card>
                                <div className="separator-full" />
                                <Card>
                                    <Card.Header>
                                        <a href="#some">Social Profile</a>
                                    </Card.Header>
                                    <Card.Body>
                                        <ul className="hk-list hk-list-sm">
                                            <li>
                                                <Button variant="primary" className="btn-icon btn-rounded btn-primary">
                                                    <span className="icon">
                                                        <FontAwesomeIcon icon={faBehance} />
                                                    </span>
                                                </Button>
                                            </li>
                                            <li>
                                                <Button variant="warning" className="btn-icon btn-rounded">
                                                    <span className="icon">
                                                        <FontAwesomeIcon icon={faGoogleDrive} />
                                                    </span>
                                                </Button>
                                            </li>
                                            <li>
                                                <Button variant="info" className="btn-icon btn-rounded">
                                                    <span className="icon">
                                                        <FontAwesomeIcon icon={faDropbox} />
                                                    </span>
                                                </Button>
                                            </li>
                                            <li>
                                                <Button variant="dark" className="btn-icon btn-rounded">
                                                    <span className="icon">
                                                        <FontAwesomeIcon icon={faGithub} />
                                                    </span>
                                                </Button>
                                            </li>
                                        </ul>
                                    </Card.Body>
                                </Card>
                                <div className="separator-full" />
                                <Card>
                                    <Card.Header>
                                        <a href="#some">Biography</a>
                                        <Button size="xs" variant="light" className="btn-icon btn-rounded">
                                            <HkTooltip placement="top" title="Edit">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <Edit2 />
                                                    </span>
                                                </span>
                                            </HkTooltip>
                                        </Button>
                                    </Card.Header>
                                    <Card.Body>
                                        <p>Hello there, Morgan Freeman is a full-stack frontend developer working under pressure is his quality.</p>
                                    </Card.Body>
                                </Card>
                                <div className="separator-full" />
                                <Card>
                                    <Card.Header>
                                        <a href="#some">Settings</a>
                                    </Card.Header>
                                    <Card.Body>
                                        <ul className="cp-action">
                                            <li>
                                                <Link href="#">
                                                    <span className="cp-icon-wrap">
                                                        <span className="feather-icon">
                                                            <Upload />
                                                        </span>
                                                    </span>
                                                    Share Contact
                                                </Link>
                                            </li>
                                            <li>
                                                <Link href="#">
                                                    <span className="cp-icon-wrap">
                                                        <span className="feather-icon">
                                                            <Heart />
                                                        </span>
                                                    </span>
                                                    Add to Favourites
                                                </Link>
                                            </li>
                                            <li>
                                                <Link href="#" className="link-danger">
                                                    <span className="cp-icon-wrap">
                                                        <span className="feather-icon">
                                                            <Trash />
                                                        </span>
                                                    </span>
                                                    Delete Contact
                                                </Link>
                                            </li>
                                        </ul>
                                    </Card.Body>
                                </Card>
                            </div>
                            <div className="contact-more-info">
                                <Tab.Container defaultActiveKey="tab_summery">
                                    <Nav variant="tabs" className="nav-line nav-icon nav-light">
                                        <Nav.Item>
                                            <Nav.Link eventKey="tab_summery">
                                                <span className="nav-icon-wrap">
                                                    <span className="feather-icon">
                                                        <Zap />
                                                    </span>
                                                </span>
                                                <span className="nav-link-text">Summery</span>
                                            </Nav.Link>
                                        </Nav.Item>
                                        <Nav.Item>
                                            <Nav.Link>
                                                <span className="nav-icon-wrap">
                                                    <span className="feather-icon">
                                                        <Activity />
                                                    </span>
                                                </span>
                                                <span className="nav-link-text">Activity</span>
                                            </Nav.Link>
                                        </Nav.Item>
                                        <Nav.Item>
                                            <Nav.Link>
                                                <span className="nav-icon-wrap">
                                                    <span className="feather-icon">
                                                        <Edit3 />
                                                    </span>
                                                </span>
                                                <span className="nav-link-text">Notes</span>
                                            </Nav.Link>
                                        </Nav.Item>
                                        <Nav.Item>
                                            <Nav.Link>
                                                <span className="nav-icon-wrap">
                                                    <span className="feather-icon">
                                                        <Mail />
                                                    </span>
                                                </span>
                                                <span className="nav-link-text">Email</span>
                                            </Nav.Link>
                                        </Nav.Item>
                                        <Nav.Item>
                                            <Nav.Link>
                                                <span className="nav-icon-wrap">
                                                    <span className="feather-icon">
                                                        <Phone />
                                                    </span>
                                                </span>
                                                <span className="nav-link-text">Calls</span>
                                            </Nav.Link>
                                        </Nav.Item>
                                        <Nav.Item>
                                            <Nav.Link>
                                                <span className="nav-icon-wrap">
                                                    <span className="feather-icon">
                                                        <CheckSquare />
                                                    </span>
                                                </span>
                                                <span className="nav-link-text">Tasks</span>
                                            </Nav.Link>
                                        </Nav.Item>
                                        <Nav.Item>
                                            <Nav.Link>
                                                <span className="nav-icon-wrap">
                                                    <span className="feather-icon">
                                                        <Clock />
                                                    </span>
                                                </span>
                                                <span className="nav-link-text">Schedule</span>
                                            </Nav.Link>
                                        </Nav.Item>
                                        <Nav.Item>
                                            <Nav.Link>
                                                <span className="nav-icon-wrap">
                                                    <span className="feather-icon">
                                                        <Shield />
                                                    </span>
                                                </span>
                                                <span className="nav-link-text">Sales</span>
                                            </Nav.Link>
                                        </Nav.Item >
                                    </Nav >
                                    <Tab.Content className="mt-7">
                                        <Tab.Pane eventKey="tab_summery">
                                            <Form>
                                                <Row>
                                                    <Col md={12} as={Form.Group} className="mb-3">
                                                        <div className="form-label-group">
                                                            <Form.Label>Write a Note</Form.Label>
                                                            <small className="text-muted">1200</small>
                                                        </div>
                                                        <Form.Control as="textarea" rows={8} placeholder="Write an internal note" />
                                                    </Col>
                                                </Row>
                                                <Button variant="outline-light">Add Note</Button>
                                            </Form>
                                        </Tab.Pane>
                                    </Tab.Content>
                                </Tab.Container>
                                <div className="pipeline-status-wrap mt-7">
                                    <div className="title-lg mb-3">Lead Pipeline Status</div>
                                    <ul className="pipeline-stutus">
                                        <li className="completed"><span>In Pipeline</span></li>
                                        <li className="active"><span>Follow Up</span></li>
                                        <li><span>Scheduled Service</span></li>
                                        <li><span>Conversation</span></li>
                                        <li><span>Win/Lost</span></li>
                                    </ul>
                                    <div className="clearfix" />
                                </div>
                                <div className="activity-wrap mt-7">
                                    <div className="d-flex align-items-center justify-content-between mb-4">
                                        <div className="title-lg mb-0">Activity</div>
                                        <Form.Select className="mw-150p">
                                            <option value={0}>All Activity</option>
                                            <option value={1}>One</option>
                                            <option value={2}>Two</option>
                                            <option value={3}>Three</option>
                                        </Form.Select>
                                    </div>
                                    <div className="title-sm text-primary mb-3">June 24</div>
                                    <ul className="activity-thread">
                                        <li>
                                            <div className="media">
                                                <div className="media-head">
                                                    <div className="avatar avatar-icon avatar-sm avatar-primary avatar-rounded">
                                                        <span className="initial-wrap"><span className="feather-icon">
                                                            <Mail />
                                                        </span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div>
                                                        <div className="activity-text">You sent <span className="text-dark text-capitalize">1 message</span> to the contact.</div>
                                                        <div className="activity-time">10.00 pm</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="media">
                                                <div className="media-head">
                                                    <div className="avatar avatar-sm avatar-soft-danger avatar-rounded">
                                                        <span className="initial-wrap">M</span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div>
                                                        <div className="activity-text"><span className="text-dark text-capitalize">Morgan Freeman</span> as it is sometimes known, is dummy text used in laying out print, graphic or web designs. The passage is attributed to an unknown typesetter in the 15th century who is thought to have scrambled.</div>
                                                        <div className="activity-time">10.00 pm</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="media">
                                                <div className="media-head">
                                                    <div className="avatar  avatar-icon avatar-sm avatar-info avatar-rounded">
                                                        <span className="initial-wrap"><span className="feather-icon">
                                                            <Shield />
                                                        </span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div>
                                                        <div className="activity-text">Your deal value <span className="text-dark">$208.15</span> is paid through PayU Money online on <span className="text-dark">02.12.18</span> at <span className="text-dark">15:30, Monday</span></div>
                                                        <div className="activity-time">10.00 pm</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    </ul>
                                    <div className="title-sm text-primary mt-5 mb-3">June 25</div>
                                    <ul className="activity-thread">
                                        <li>
                                            <div className="media">
                                                <div className="media-head">
                                                    <div className="avatar avatar-sm avatar-soft-danger avatar-rounded">
                                                        <span className="initial-wrap">M</span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div>
                                                        <div className="activity-text"><span className="text-dark">Morgan Freeman</span> responded to your appointment schedule question. </div>
                                                        <div className="activity-time">10.00 pm</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    </ul>
                                </div>
                            </div >
                        </div >
                    </SimpleBar >
                </div >
            </Modal.Body >
        </Modal >
    )
}

export default ContactDetails
