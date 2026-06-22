import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge, Button, Card, Col, Container, Dropdown, Form, Nav, Row, Tab } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';
import classNames from 'classnames';
import { Globe, MoreHorizontal, Plus } from 'react-feather';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import AddBoard from './AddBoard';
import AddNewMember from './AddNewMember';
import AddNewBoard from '../AddNewBoard';
//Images
import avatar2 from '@/assets/img/avatar2.jpg';
import avatar3 from '@/assets/img/avatar3.jpg';
import avatar5 from '@/assets/img/avatar5.jpg';
import avatar6 from '@/assets/img/avatar6.jpg';
import avatar7 from '@/assets/img/avatar7.jpg';
import avatar8 from '@/assets/img/avatar8.jpg';
import avatar9 from '@/assets/img/avatar9.jpg';
import avatar10 from '@/assets/img/avatar10.jpg';
import avatar11 from '@/assets/img/avatar11.jpg';
import avatar13 from '@/assets/img/avatar13.jpg';
import avatar14 from '@/assets/img/avatar14.jpg';

const TaskBoard = ({ showSidebar, toggleSidebar }) => {

    const [addNewBoard, setAddNewBoard] = useState(false);
    const [addNewMember, setAddNewMember] = useState(false);

    return (
        <div className="taskboardapp-content">
            <div className="taskboardapp-detail-wrap">
                <Tab.Container defaultActiveKey="tab_boards" >
                    <header className="taskboard-header">
                        <Nav justify variant="tabs" className="nav-light nav-segmented-tabs active-theme mx-auto w-350p">
                            <Nav.Item>
                                <Nav.Link eventKey="tab_boards" >
                                    <span className="nav-link-text">Boards</span>
                                </Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="tab_team" >
                                    <span className="nav-link-text badge-on-text">Team</span>
                                </Nav.Link>
                            </Nav.Item>
                        </Nav>
                        <div className={classNames("hk-sidebar-togglable", { "active": !showSidebar })} onClick={toggleSidebar} />
                    </header>
                    <div className="taskboard-body">
                        <SimpleBar className="nicescroll-bar">
                            <Container fluid>
                                <Row className="justify-content-center board-team-wrap">
                                    <Col md={8} sm={12}>
                                        <Tab.Content>
                                            <Tab.Pane eventKey="tab_boards">
                                                <h5 className="mb-5">Frequent Boards</h5>
                                                <Row>
                                                    <Col lg={6}>
                                                        <Card className="board-card card-border">
                                                            <Card.Body>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-sm avatar-pink">
                                                                            <span className="initial-wrap">J</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="media-body">
                                                                        <span>Jampack</span>
                                                                    </div>
                                                                </div>
                                                            </Card.Body>
                                                            <Card.Footer className="text-muted justify-content-between">
                                                                <div>
                                                                    <div className="avatar-group avatar-group-sm avatar-group-overlapped me-3">
                                                                        <HkTooltip title="Katharine" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar8} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Dean" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar13} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Morgan" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar2} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Tooltip text" placement="top">
                                                                            <div className="avatar avatar-soft-danger avatar-rounded">
                                                                                <span className="initial-wrap">3+</span>
                                                                            </div>
                                                                        </HkTooltip>
                                                                    </div>
                                                                </div>
                                                                <div className="d-flex align-items-center">
                                                                    <p className="p-xs me-2">Updated 25 min ago</p>
                                                                    <div className="flex-shrink-0">
                                                                        <Link href="#" className="btn btn-xs btn-icon btn-flush-primary btn-rounded flush-soft-hover">
                                                                            <HkTooltip placement="top" title="Public" >
                                                                                <span className="icon">
                                                                                    <span className="feather-icon">
                                                                                        <Globe />
                                                                                    </span>
                                                                                </span>
                                                                            </HkTooltip>
                                                                        </Link>
                                                                        <Dropdown as="div" className="d-inline" >
                                                                            <Dropdown.Toggle size="xs" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                                                                <span className="icon">
                                                                                    <span className="feather-icon">
                                                                                        <MoreHorizontal />
                                                                                    </span>
                                                                                </span>
                                                                            </Dropdown.Toggle>
                                                                            <Dropdown.Menu align="end" >
                                                                                <Dropdown.Item>Edit</Dropdown.Item>
                                                                                <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                                <Dropdown.Item>Delete</Dropdown.Item>
                                                                            </Dropdown.Menu>
                                                                        </Dropdown>
                                                                    </div>
                                                                </div>
                                                            </Card.Footer>
                                                        </Card>
                                                    </Col>
                                                    <Col lg={6}>
                                                        <Card className="board-card card-border">
                                                            <Card.Body>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-sm avatar-pumpkin">
                                                                            <span className="initial-wrap">A</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="media-body">
                                                                        <span>Angular - Jampack</span>
                                                                    </div>
                                                                </div>
                                                            </Card.Body>
                                                            <Card.Footer className="text-muted justify-content-between">
                                                                <div>
                                                                    <div className="avatar-group avatar-group-sm avatar-group-overlapped me-3">
                                                                        <HkTooltip title="Katharine" placement="top">
                                                                            <div className="avatar avatar-rounded" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Katharine">
                                                                                <Image src={avatar9} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Dean" placement="top">
                                                                            <div className="avatar avatar-rounded" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Dean">
                                                                                <Image src={avatar13} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                    </div>
                                                                </div>
                                                                <div className="d-flex align-items-center">
                                                                    <p className="p-xs me-2">Updated 5 min ago</p>
                                                                    <div className="flex-shrink-0">
                                                                        <Button as="a" size="xs" variant="flush-primary" className="btn-icon btn-rounded flush-soft-hover">
                                                                            <HkTooltip title="Public" placement="top">
                                                                                <span className="icon">
                                                                                    <span className="feather-icon">
                                                                                        <Globe />
                                                                                    </span>
                                                                                </span>
                                                                            </HkTooltip>
                                                                        </Button>
                                                                        <Dropdown as="div" className="d-inline" >
                                                                            <Dropdown.Toggle size="xs" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                                                                <span className="icon">
                                                                                    <span className="feather-icon">
                                                                                        <MoreHorizontal />
                                                                                    </span>
                                                                                </span>
                                                                            </Dropdown.Toggle>
                                                                            <Dropdown.Menu align="end" >
                                                                                <Dropdown.Item>Edit</Dropdown.Item>
                                                                                <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                                <Dropdown.Item>Delete</Dropdown.Item>
                                                                            </Dropdown.Menu>
                                                                        </Dropdown>
                                                                    </div>
                                                                </div>
                                                            </Card.Footer>
                                                        </Card>
                                                    </Col>
                                                </Row>
                                                <div className="d-flex justify-content-between align-items-center mb-5">
                                                    <h5 className="mb-0">All Boards</h5>
                                                    <Button variant="light" className="btn-icon">
                                                        <span className="icon">
                                                            <span className="feather-icon">
                                                                <Plus />
                                                            </span>
                                                        </span>
                                                    </Button>
                                                </div>
                                                <Row>
                                                    <Col lg={6}>
                                                        <Card className="board-card card-border">
                                                            <Card.Body>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-sm avatar-violet">
                                                                            <span className="initial-wrap">R</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="media-body">
                                                                        <span>React - Jampack</span>
                                                                    </div>
                                                                </div>
                                                            </Card.Body>
                                                            <div className="card-footer text-muted justify-content-between">
                                                                <div>
                                                                    <div className="avatar-group avatar-group-sm avatar-group-overlapped me-3">
                                                                        <HkTooltip title="Katharine" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar10} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Dean" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar13} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Morgan" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar2} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Tooltip text" placement="top">
                                                                            <div className="avatar avatar-soft-danger avatar-rounded">
                                                                                <span className="initial-wrap">4+</span>
                                                                            </div>
                                                                        </HkTooltip>
                                                                    </div>
                                                                </div>
                                                                <div className="d-flex align-items-center">
                                                                    <p className="p-xs me-2">Updated Yesterday</p>
                                                                    <div className="flex-shrink-0">
                                                                        <Button as="a" size="xs" variant="flush-primary" className="btn-icon btn-rounded flush-soft-hover">
                                                                            <HkTooltip title="Public" placement="top">
                                                                                <span className="icon">
                                                                                    <span className="feather-icon">
                                                                                        <Globe />
                                                                                    </span>
                                                                                </span>
                                                                            </HkTooltip>
                                                                        </Button>
                                                                        <Dropdown as="div" className="d-inline" >
                                                                            <Dropdown.Toggle size="xs" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                                                                <span className="icon">
                                                                                    <span className="feather-icon">
                                                                                        <MoreHorizontal />
                                                                                    </span>
                                                                                </span>
                                                                            </Dropdown.Toggle>
                                                                            <Dropdown.Menu align="end" >
                                                                                <Dropdown.Item>Edit</Dropdown.Item>
                                                                                <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                                <Dropdown.Item>Delete</Dropdown.Item>
                                                                            </Dropdown.Menu>
                                                                        </Dropdown>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </Card>
                                                    </Col>
                                                    <Col lg={6}>
                                                        <Card className="board-card card-border">
                                                            <Card.Body>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-sm avatar-orange">
                                                                            <span className="initial-wrap">G</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="media-body">
                                                                        <span>Griffin</span>
                                                                    </div>
                                                                </div>
                                                            </Card.Body>
                                                            <Card.Footer className="text-muted justify-content-between">
                                                                <div>
                                                                    <div className="avatar-group avatar-group-sm avatar-group-overlapped me-3">
                                                                        <HkTooltip title="Katharine" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar11} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Dean" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar8} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Morgan" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar7} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Tooltip text" placement="top">
                                                                            <div className="avatar avatar-soft-danger avatar-rounded">
                                                                                <span className="initial-wrap">W</span>
                                                                            </div>
                                                                        </HkTooltip>
                                                                    </div>
                                                                </div>
                                                                <div className="d-flex align-items-center">
                                                                    <p className="p-xs me-2">Updated 10 min ago</p>
                                                                    <div className="flex-shrink-0">
                                                                        <Button as="a" size="xs" variant="flush-primary" className="btn-icon btn-rounded flush-soft-hover">
                                                                            <HkTooltip title="Public" placement="top">
                                                                                <span className="icon">
                                                                                    <span className="feather-icon">
                                                                                        <Globe />
                                                                                    </span>
                                                                                </span>
                                                                            </HkTooltip>
                                                                        </Button>
                                                                        <Dropdown as="div" className="d-inline" >
                                                                            <Dropdown.Toggle size="xs" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                                                                <span className="icon">
                                                                                    <span className="feather-icon">
                                                                                        <MoreHorizontal />
                                                                                    </span>
                                                                                </span>
                                                                            </Dropdown.Toggle>
                                                                            <Dropdown.Menu align="end" >
                                                                                <Dropdown.Item>Edit</Dropdown.Item>
                                                                                <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                                <Dropdown.Item>Delete</Dropdown.Item>
                                                                            </Dropdown.Menu>
                                                                        </Dropdown>
                                                                    </div>
                                                                </div>
                                                            </Card.Footer>
                                                        </Card>
                                                    </Col>
                                                    <Col lg={6}>
                                                        <Card className="board-card card-border">
                                                            <Card.Body>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-sm avatar-primary">
                                                                            <span className="initial-wrap">P</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="media-body">
                                                                        <span>Pangong</span>
                                                                    </div>
                                                                </div>
                                                            </Card.Body>
                                                            <div className="card-footer text-muted justify-content-between">
                                                                <div>
                                                                    <div className="avatar-group avatar-group-sm avatar-group-overlapped me-3">
                                                                        <HkTooltip title="Katharine" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar8} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Dean" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar13} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                    </div>
                                                                </div>
                                                                <div className="d-flex align-items-center">
                                                                    <p className="p-xs me-2">Updated 1 hour ago</p>
                                                                    <div className="flex-shrink-0">
                                                                        <Button as="a" size="xs" variant="flush-primary" className="btn-icon btn-rounded flush-soft-hover">
                                                                            <HkTooltip title="Public" placement="top">
                                                                                <span className="icon">
                                                                                    <span className="feather-icon">
                                                                                        <Globe />
                                                                                    </span>
                                                                                </span>
                                                                            </HkTooltip>
                                                                        </Button>
                                                                        <Dropdown as="div" className="d-inline" >
                                                                            <Dropdown.Toggle size="xs" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                                                                <span className="icon">
                                                                                    <span className="feather-icon">
                                                                                        <MoreHorizontal />
                                                                                    </span>
                                                                                </span>
                                                                            </Dropdown.Toggle>
                                                                            <Dropdown.Menu align="end" >
                                                                                <Dropdown.Item>Edit</Dropdown.Item>
                                                                                <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                                <Dropdown.Item>Delete</Dropdown.Item>
                                                                            </Dropdown.Menu>
                                                                        </Dropdown>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </Card>
                                                    </Col>
                                                    <Col lg={6}>
                                                        <Card className="board-card card-border">
                                                            <Card.Body>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-sm avatar-info">
                                                                            <span className="initial-wrap">D</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="media-body">
                                                                        <span>Doodle</span>
                                                                    </div>
                                                                </div>
                                                            </Card.Body>
                                                            <Card.Footer className="text-muted justify-content-between">
                                                                <div>
                                                                    <div className="avatar-group avatar-group-sm avatar-group-overlapped me-3">
                                                                        <HkTooltip title="Katharine" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar9} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Dean" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar10} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Morgan" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar11} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Tooltip text" placement="top">
                                                                            <div className="avatar avatar-soft-danger avatar-rounded">
                                                                                <span className="initial-wrap">3+</span>
                                                                            </div>
                                                                        </HkTooltip>
                                                                    </div>
                                                                </div>
                                                                <div className="d-flex align-items-center">
                                                                    <p className="p-xs me-2">Updated 20 min ago</p>
                                                                    <div className="flex-shrink-0">
                                                                        <Button as="a" size="xs" variant="flush-primary" className="btn-icon btn-rounded flush-soft-hover">
                                                                            <HkTooltip title="Public" placement="top">
                                                                                <span className="icon">
                                                                                    <span className="feather-icon">
                                                                                        <Globe />
                                                                                    </span>
                                                                                </span>
                                                                            </HkTooltip>
                                                                        </Button>
                                                                        <Dropdown as="div" className="d-inline" >
                                                                            <Dropdown.Toggle size="xs" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                                                                <span className="icon">
                                                                                    <span className="feather-icon">
                                                                                        <MoreHorizontal />
                                                                                    </span>
                                                                                </span>
                                                                            </Dropdown.Toggle>
                                                                            <Dropdown.Menu align="end" >
                                                                                <Dropdown.Item>Edit</Dropdown.Item>
                                                                                <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                                <Dropdown.Item>Delete</Dropdown.Item>
                                                                            </Dropdown.Menu>
                                                                        </Dropdown>
                                                                    </div>
                                                                </div>
                                                            </Card.Footer>
                                                        </Card>
                                                    </Col>
                                                    <Col lg={6}>
                                                        <Card className="board-card card-border">
                                                            <Card.Body>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-sm avatar-pink">
                                                                            <span className="initial-wrap">P</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="media-body">
                                                                        <span>Pogody</span>
                                                                    </div>
                                                                </div>
                                                            </Card.Body>
                                                            <Card.Footer className="text-muted justify-content-between">
                                                                <div>
                                                                    <div className="avatar-group avatar-group-sm avatar-group-overlapped me-3">
                                                                        <HkTooltip title="Katharine" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar5} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Dean" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar6} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Morgan" placement="top">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar7} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </HkTooltip>
                                                                        <HkTooltip title="Tooltip text" placement="top">
                                                                            <div className="avatar avatar-soft-danger avatar-rounded">
                                                                                <span className="initial-wrap">5+</span>
                                                                            </div>
                                                                        </HkTooltip>
                                                                    </div>
                                                                </div>
                                                                <div className="d-flex align-items-center">
                                                                    <p className="p-xs me-2">Updated 2 days ago</p>
                                                                    <div className="flex-shrink-0">
                                                                        <Button as="a" size="xs" variant="flush-primary" className="btn-icon btn-rounded flush-soft-hover">
                                                                            <HkTooltip title="Public" placement="top">
                                                                                <span className="icon">
                                                                                    <span className="feather-icon">
                                                                                        <Globe />
                                                                                    </span>
                                                                                </span>
                                                                            </HkTooltip>
                                                                        </Button>
                                                                        <Dropdown as="div" className="d-inline" >
                                                                            <Dropdown.Toggle size="xs" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                                                                <span className="icon">
                                                                                    <span className="feather-icon">
                                                                                        <MoreHorizontal />
                                                                                    </span>
                                                                                </span>
                                                                            </Dropdown.Toggle>
                                                                            <Dropdown.Menu align="end" >
                                                                                <Dropdown.Item>Edit</Dropdown.Item>
                                                                                <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                                <Dropdown.Item>Delete</Dropdown.Item>
                                                                            </Dropdown.Menu>
                                                                        </Dropdown>
                                                                    </div>
                                                                </div>
                                                            </Card.Footer>
                                                        </Card>
                                                    </Col>
                                                    <Col lg={6}>
                                                        <Card className="card-border border-dashed h-100">
                                                            <div className="card-body d-flex align-items-center justify-content-center">
                                                                <Button variant="outline-light" className="btn-block" onClick={() => setAddNewBoard(!addNewBoard)} >
                                                                    <HkTooltip placement="top" title="Add New Member" >
                                                                        <span className="feather-icon">
                                                                            <Plus />
                                                                        </span>
                                                                    </HkTooltip>
                                                                </Button>
                                                            </div>
                                                        </Card>
                                                    </Col>
                                                </Row>
                                            </Tab.Pane>

                                            <Tab.Pane eventKey="tab_team">
                                                <div className="d-flex justify-content-between align-items-center mb-5">
                                                    <div className="d-flex align-items-center form-group mb-0">
                                                        <h5 className="mb-0 me-4">Members</h5>
                                                        <label className="flex-shrink-0 mb-0 me-2">Sort by:</label>
                                                        <Form.Select size="sm" className="w-130p">
                                                            <option value={1}>Date Created</option>
                                                            <option value={2}>A - Z</option>
                                                            <option value={3}>Z - A</option>
                                                        </Form.Select>
                                                    </div>
                                                    <Button variant="light" className="btn-icon" onClick={() => setAddNewMember(!addNewMember)} >
                                                        <HkTooltip placement="top" title="Add New Member" >
                                                            <span className="feather-icon">
                                                                <Plus />
                                                            </span>
                                                        </HkTooltip>
                                                    </Button>
                                                </div>
                                                <Row>
                                                    <Col xl={6} md={12}>
                                                        <Card className="team-card card-border">
                                                            <Card.Body>
                                                                <div className="card-action-wrap">
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" aria-expanded="false" data-bs-toggle="dropdown">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <MoreHorizontal />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end">
                                                                            <Dropdown.Item>Invite for project</Dropdown.Item>
                                                                            <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                            <Dropdown.Item>Mail preferences</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-rounded">
                                                                            <Image src={avatar2} alt="user" className="avatar-img" />
                                                                        </div>
                                                                    </div>
                                                                    <HkTooltip title="Designer" >
                                                                        <div className="media-body">
                                                                            <div data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Designer">
                                                                                <span>Morgan Freeman</span>
                                                                                <Badge bg="primary" className="badge-indicator badge-indicator-nobdr" />
                                                                            </div>
                                                                            <div className="text-truncate">morgan@jampack.com</div>
                                                                        </div>
                                                                    </HkTooltip>
                                                                </div>
                                                            </Card.Body>
                                                        </Card>
                                                    </Col>
                                                    <Col xl={6} md={12}>
                                                        <Card className="team-card card-border">
                                                            <Card.Body>
                                                                <div className="card-action-wrap">
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" aria-expanded="false" data-bs-toggle="dropdown">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <MoreHorizontal />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end">
                                                                            <Dropdown.Item>Invite for project</Dropdown.Item>
                                                                            <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                            <Dropdown.Item>Mail preferences</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-rounded">
                                                                            <Image src={avatar9} alt="user" className="avatar-img" />
                                                                        </div>
                                                                    </div>
                                                                    <HkTooltip title="Designer" >
                                                                        <div className="media-body">
                                                                            <div data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Designer">
                                                                                <span>Huma Therman</span>
                                                                                <Badge bg="primary" className="badge-indicator badge-indicator-nobdr" />
                                                                            </div>
                                                                            <div className="text-truncate">huma@clariesup.au@jampack.com</div>
                                                                        </div>
                                                                    </HkTooltip>
                                                                </div>
                                                            </Card.Body>
                                                        </Card>
                                                    </Col>
                                                    <Col xl={6} md={12}>
                                                        <Card className="team-card card-border">
                                                            <Card.Body>
                                                                <div className="card-action-wrap">
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" aria-expanded="false" data-bs-toggle="dropdown">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <MoreHorizontal />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end">
                                                                            <Dropdown.Item>Invite for project</Dropdown.Item>
                                                                            <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                            <Dropdown.Item>Mail preferences</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-rounded">
                                                                            <Image src={avatar7} alt="user" className="avatar-img" />
                                                                        </div>
                                                                    </div>
                                                                    <HkTooltip title="Designer" >
                                                                        <div className="media-body">
                                                                            <div data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Designer">
                                                                                <span>Tom Cruz</span>
                                                                                <Badge bg="danger" className="badge-indicator badge-indicator-nobdr" />
                                                                            </div>
                                                                            <div className="text-truncate">tomcz@jampack.com</div>
                                                                        </div>
                                                                    </HkTooltip>
                                                                </div>
                                                            </Card.Body>
                                                        </Card>
                                                    </Col>
                                                    <Col xl={6} md={12} className="col-xl-6 col-md-12">
                                                        <Card className="team-card card-border">
                                                            <Card.Body>
                                                                <div className="card-action-wrap">
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" aria-expanded="false" data-bs-toggle="dropdown">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <MoreHorizontal />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end">
                                                                            <Dropdown.Item>Invite for project</Dropdown.Item>
                                                                            <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                            <Dropdown.Item>Mail preferences</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-soft-danger avatar-rounded">
                                                                            <span className="initial-wrap">D</span>
                                                                        </div>
                                                                    </div>
                                                                    <HkTooltip title="Designer" >
                                                                        <div className="media-body">
                                                                            <div data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Designer">
                                                                                <span>Danial Craig</span>
                                                                                <Badge bg="primary" className="badge-indicator badge-indicator-nobdr" />
                                                                            </div>
                                                                            <div className="text-truncate">danialc@jampack.com</div>
                                                                        </div>
                                                                    </HkTooltip>
                                                                </div>
                                                            </Card.Body>
                                                        </Card>
                                                    </Col>
                                                    <Col xl={6} md={12}>
                                                        <Card className="team-card card-border">
                                                            <Card.Body>
                                                                <div className="card-action-wrap">
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" aria-expanded="false" data-bs-toggle="dropdown">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <MoreHorizontal />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end">
                                                                            <Dropdown.Item>Invite for project</Dropdown.Item>
                                                                            <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                            <Dropdown.Item>Mail preferences</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-rounded">
                                                                            <Image src={avatar10} alt="user" className="avatar-img" />
                                                                        </div>
                                                                    </div>
                                                                    <HkTooltip title="Inventory" >
                                                                        <div className="media-body">
                                                                            <div>
                                                                                <span>Winston Churchil</span>
                                                                                <Badge bg="primary" className="badge-indicator badge-indicator-nobdr" />
                                                                            </div>
                                                                            <div className="text-truncate">winston@worthniza.ga</div>
                                                                        </div>
                                                                    </HkTooltip>
                                                                </div>
                                                            </Card.Body>
                                                        </Card>
                                                    </Col>
                                                    <Col xl={6} md={12}>
                                                        <Card className="team-card card-border">
                                                            <Card.Body>
                                                                <div className="card-action-wrap">
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" aria-expanded="false" data-bs-toggle="dropdown">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <MoreHorizontal />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end">
                                                                            <Dropdown.Item>Invite for project</Dropdown.Item>
                                                                            <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                            <Dropdown.Item>Mail preferences</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="media-head">
                                                                            <div className="avatar avatar-rounded">
                                                                                <Image src={avatar8} alt="user" className="avatar-img" />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <HkTooltip title="Inventory" >
                                                                        <div className="media-body">
                                                                            <div>
                                                                                <span>Katharine Jones</span>
                                                                                <Badge bg="primary" className="badge-indicator badge-indicator-nobdr" />
                                                                            </div>
                                                                            <div className="text-truncate">joneskath@jampack.com</div>
                                                                        </div>
                                                                    </HkTooltip>
                                                                </div>
                                                            </Card.Body>
                                                        </Card>
                                                    </Col>
                                                    <Col xl={6} md={12}>
                                                        <Card className="team-card card-border">
                                                            <Card.Body>
                                                                <div className="card-action-wrap">
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" aria-expanded="false" data-bs-toggle="dropdown">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <MoreHorizontal />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end">
                                                                            <Dropdown.Item>Invite for project</Dropdown.Item>
                                                                            <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                            <Dropdown.Item>Mail preferences</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-rounded">
                                                                            <Image src={avatar3} alt="user" className="avatar-img" />
                                                                        </div>
                                                                    </div>
                                                                    <HkTooltip title="Hr Manager" >
                                                                        <div className="media-body">
                                                                            <div>
                                                                                <span>Jaquiline Joker</span>
                                                                                <Badge bg="danger" className="badge-indicator badge-indicator-nobdr" />
                                                                            </div>
                                                                            <div className="text-truncate">jaquljoker@jampack.com</div>
                                                                        </div>
                                                                    </HkTooltip>
                                                                </div>
                                                            </Card.Body>
                                                        </Card>
                                                    </Col>
                                                    <Col xl={6} md={12}>
                                                        <Card className="team-card card-border">
                                                            <Card.Body>
                                                                <div className="card-action-wrap">
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" aria-expanded="false" data-bs-toggle="dropdown">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <MoreHorizontal />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end">
                                                                            <Dropdown.Item>Invite for project</Dropdown.Item>
                                                                            <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                            <Dropdown.Item>Mail preferences</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-light avatar-rounded">
                                                                            <span className="initial-wrap">J</span>
                                                                        </div>
                                                                    </div>
                                                                    <HkTooltip title="Designer" >
                                                                        <div className="media-body">
                                                                            <div>
                                                                                <span>John Brother</span>
                                                                                <Badge bg="primary" className="badge-indicator badge-indicator-nobdr" />
                                                                            </div>
                                                                            <div className="text-truncate">john@cryodrakon.info</div>
                                                                        </div>
                                                                    </HkTooltip>
                                                                </div>
                                                            </Card.Body>
                                                        </Card>
                                                    </Col>
                                                    <Col xl={6} md={12}>
                                                        <Card className="team-card card-border">
                                                            <Card.Body>
                                                                <div className="card-action-wrap">
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" aria-expanded="false" data-bs-toggle="dropdown">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <MoreHorizontal />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end">
                                                                            <Dropdown.Item>Invite for project</Dropdown.Item>
                                                                            <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                            <Dropdown.Item>Mail preferences</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-rounded">
                                                                            <Image src={avatar14} alt="user" className="avatar-img" />
                                                                        </div>
                                                                    </div>
                                                                    <HkTooltip title="Designer" >
                                                                        <div className="media-body">
                                                                            <div>
                                                                                <span>John Brother</span>
                                                                                <Badge bg="primary" className="badge-indicator badge-indicator-nobdr" />
                                                                            </div>
                                                                            <div className="text-truncate">john@cryodrakon.info</div>
                                                                        </div>
                                                                    </HkTooltip>
                                                                </div>
                                                            </Card.Body>
                                                        </Card>
                                                    </Col>
                                                    <Col xl={6} md={12}>
                                                        <Card className="team-card card-border">
                                                            <Card.Body>
                                                                <div className="card-action-wrap">
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret" aria-expanded="false" data-bs-toggle="dropdown">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <MoreHorizontal />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end">
                                                                            <Dropdown.Item>Invite for project</Dropdown.Item>
                                                                            <Dropdown.Item>Copy Link</Dropdown.Item>
                                                                            <Dropdown.Item>Mail preferences</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                                <div className="media align-items-center">
                                                                    <div className="media-head">
                                                                        <div className="avatar avatar-soft-success avatar-rounded">
                                                                            <span className="initial-wrap">C</span>
                                                                        </div>
                                                                    </div>
                                                                    <HkTooltip title="Developer" >
                                                                        <div className="media-body">
                                                                            <div>
                                                                                <span>Charlie Chaplin</span>
                                                                                <Badge bg="danger" className="badge-indicator badge-indicator-nobdr" />
                                                                            </div>
                                                                            <div className="text-truncate">charlie@leernoca.monster</div>
                                                                        </div>
                                                                    </HkTooltip>
                                                                </div>
                                                            </Card.Body>
                                                        </Card>
                                                    </Col>
                                                    <Col xl={6} md={12}>
                                                        <Card className="card-border border-dashed h-100">
                                                            <Card.Body className="d-flex align-items-center justify-content-center">
                                                                <Button variant="outline-light" className="btn-icon" onClick={() => setAddNewMember(!addNewMember)}>
                                                                    <HkTooltip placement="top" title="Add New Member" >
                                                                        <span className="feather-icon">
                                                                            <Plus />
                                                                        </span>
                                                                    </HkTooltip>
                                                                </Button>
                                                            </Card.Body>
                                                        </Card>
                                                    </Col>
                                                </Row>
                                            </Tab.Pane>
                                        </Tab.Content>
                                    </Col>
                                </Row>
                            </Container>
                        </SimpleBar>
                    </div>
                </Tab.Container>
            </div>
            {/* Add New Task */}
            <AddNewBoard show={addNewBoard} onHide={() => setAddNewBoard(!addNewBoard)} />
            {/* /Add New Task */}
            {/* Add New Member */}
            <AddNewMember show={addNewMember} hide={() => setAddNewMember(!addNewMember)} />
            {/* /Add New Member */}
            {/* Add Fav Board */}
            <AddBoard />
            {/* /Add Fav Board */}
        </div>
    )
}

export default TaskBoard
