import { useState } from 'react';
import { Badge, Button, Col, Form, Modal, Nav, Row } from 'react-bootstrap';
import { Archive, Book, Edit, Inbox, Plus, Send, Settings, Star, Trash2 } from 'react-feather';
import SimpleBar from 'simplebar-react';
import ComposeEmail from './ComposeEmail';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';


const EmailSidebar = () => {
    const { states, dispatch } = useGlobalStateContext();
    const [addCategory, setAddCategory] = useState(false);

    return (
        <>
            <Nav className="emailapp-sidebar">
                <SimpleBar className="nicescroll-bar">
                    <div className="menu-content-wrap">
                        <Button variant="primary" className="btn-rounded btn-block mb-4 show-compose-popup" onClick={() => dispatch({ type: "compose_email", composeEmail: !states.emailState.composeEmail })} >
                            Compose email
                        </Button>
                        <div className="menu-group">
                            <Nav className="nav-light navbar-nav flex-column" defaultActiveKey="inbox" >
                                <Nav.Item>
                                    <Nav.Link eventKey="inbox" >
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Inbox />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Inbox</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Star />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Important</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Send />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Sent</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Archive />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Archive</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Edit />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Draft</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Trash2 />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Trash</span>
                                    </Nav.Link>
                                </Nav.Item>
                            </Nav>
                        </div>
                        <div className="separator separator-light" />
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <div className="title-sm text-primary mb-0">Categories</div>
                            <Button size="xs" variant="light" className="btn-icon btn-rounded" onClick={() => setAddCategory(!addCategory)} >
                                <HkTooltip id="tooltip1" placement="top" title="Add Category" >
                                    <span className="feather-icon">
                                        <Plus />
                                    </span>
                                </HkTooltip>
                            </Button>
                        </div>
                        <div className="menu-group">
                            <Nav as="ul" className="nav-light navbar-nav flex-column">
                                <Nav.Item as="li">
                                    <Nav.Link>
                                        <Badge bg="primary" className="badge-indicator badge-indicator-lg me-2" />
                                        <span className="nav-link-text">Team</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link>
                                        <Badge bg="success" className="badge-indicator badge-indicator-lg me-2" />
                                        <span className="nav-link-text">Support</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link>
                                        <Badge bg="orange" className="badge-indicator badge-indicator-lg me-2" />
                                        <span className="nav-link-text">Updates</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link>
                                        <Badge bg="pink" className="badge-indicator badge-indicator-lg me-2" />
                                        <span className="nav-link-text">Primary</span>
                                    </Nav.Link>
                                </Nav.Item>
                            </Nav>
                        </div>
                    </div>
                </SimpleBar>
                {/*Sidebar Fixnav*/}
                <div className="emailapp-fixednav">
                    <div className="hk-toolbar">
                        <Nav className="nav-light">
                            <Nav.Item className="nav-link">
                                <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                                    <HkTooltip id="tooltip2" placement="top" title="Settings" >
                                        <span className="icon">
                                            <span className="feather-icon">
                                                <Settings />
                                            </span>
                                        </span>
                                    </HkTooltip>
                                </Button>
                            </Nav.Item>
                            <Nav.Item className="nav-link">
                                <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                                    <HkTooltip id="tooltip3" placement="top" title="Archive" >
                                        <span className="icon">
                                            <span className="feather-icon">
                                                <Archive />
                                            </span>
                                        </span>
                                    </HkTooltip>
                                </Button>
                            </Nav.Item>
                            <Nav.Item className="nav-link">
                                <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                                    <HkTooltip id="tooltip2" placement="top" title="Help" >
                                        <span className="icon">
                                            <span className="feather-icon">
                                                <Book />
                                            </span>
                                        </span>
                                    </HkTooltip>
                                </Button>
                            </Nav.Item>
                        </Nav>
                    </div>
                </div>
                {/*/ Sidebar Fixnav*/}
            </Nav>

            {/* Add Category Modal*/}
            <Modal show={addCategory} onHide={() => setAddCategory(!addCategory)} centered size="sm" >
                <div className="modal-content">
                    <Modal.Body>
                        <Button bsPrefix="btn-close" onClick={() => setAddCategory(!addCategory)}>
                            <span aria-hidden="true">×</span>
                        </Button>
                        <h6 className="text-uppercase fw-bold mb-3">Add Category</h6>
                        <Form>
                            <Row className="gx-3">
                                <Col sm={12}>
                                    <Form.Group className="mb-3" >
                                        <Form.Control type="text" placeholder="Category Name" />
                                    </Form.Group>
                                </Col>
                            </Row>
                            <Button variant="primary" className="float-end" onClick={() => setAddCategory(!addCategory)} >Add</Button>
                        </Form>
                    </Modal.Body>
                </div>
            </Modal>

            {/* Compose email */}
            <ComposeEmail show={states.emailState.composeEmail} onClose={() => dispatch({ type: "compose_email" })} />
        </>
    )
}


export default EmailSidebar;