import { useState } from 'react';
import { Alert, Button, Nav } from 'react-bootstrap';
import { Archive, Book, Globe, Layout, Lock, MoreVertical, Plus, Settings, Star, Trash2, UserCheck, ZapOff } from 'react-feather';
import SimpleBar from 'simplebar-react';
import AddNewBoard from './AddNewBoard';
import AddNewFavBoard from './kanban-board/AddNewFavBoard';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';


const Sidebar = () => {
    const [addNewBoard, setAddNewBoard] = useState(false);
    const [addFavBoard, setAddFavBoard] = useState(false);

    return (
        <>
            <Nav className="taskboardapp-sidebar">
                <SimpleBar className="nicescroll-bar">
                    <div className="menu-content-wrap">
                        <Button variant="primary" className="btn-rounded btn-block mb-4" onClick={() => setAddNewBoard(!addNewBoard)} >Add New Board</Button>
                        <div className="menu-group">
                            <Nav as="ul" className="nav-light navbar-nav flex-column">
                                <Nav.Item as="li">
                                    <Nav.Link active >
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Layout />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">All Boards</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link>
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Star />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Stared Boards</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link>
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Lock />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Private Boards</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link>
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <UserCheck />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Public Boards</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link>
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Trash2 />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Deleted</span>
                                    </Nav.Link>
                                </Nav.Item>
                            </Nav>
                        </div>
                        <div className="separator separator-light" />
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <div className="title-sm text-primary mb-0">Favourite Boards</div>
                            <Button size="xs" variant="light" className="btn-icon btn-rounded" onClick={() => setAddFavBoard(!addFavBoard)}>
                                <HkTooltip id="tooltip1" title="Add Board" placement="top">
                                    <span className="feather-icon">
                                        <Plus />
                                    </span>
                                </HkTooltip>
                            </Button>
                        </div>
                        <div className="menu-group">
                            <Nav className="nav-light navbar-nav flex-column">
                                <Nav.Item>
                                    <div>
                                        <div className="media d-flex align-items-center">
                                            <div className="media-head me-2">
                                                <div className="avatar avatar-xs avatar-primary avatar-rounded">
                                                    <span className="initial-wrap">J</span>
                                                </div>
                                            </div>
                                            <div className="media-body">
                                                <div>
                                                    <div className="name">Jampack</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ms-auto">
                                            <Button size="sm" variant="flush-light" className="btn-icon btn-rounded flush-soft-hover">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <Lock />
                                                    </span>
                                                </span>
                                            </Button>
                                            <Button size="sm" variant="flush-light" className="btn-icon btn-rounded flush-soft-hover">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <MoreVertical />
                                                    </span>
                                                </span>
                                            </Button>
                                        </div>
                                    </div>
                                </Nav.Item>
                                <Nav.Item>
                                    <div>
                                        <div className="media d-flex align-items-center">
                                            <div className="media-head me-2">
                                                <div className="avatar avatar-xs avatar-pink avatar-rounded">
                                                    <span className="initial-wrap">H</span>
                                                </div>
                                            </div>
                                            <div className="media-body">
                                                <div>
                                                    <div className="name">Hencework</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ms-auto">
                                            <Button variant="flush-light" size="sm" className="btn-icon btn-rounded flush-soft-hover">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <Globe />
                                                    </span>
                                                </span>
                                            </Button>
                                            <Button size="sm" variant="flush-light" className="btn-icon btn-rounded flush-soft-hover">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <MoreVertical />
                                                    </span>
                                                </span>
                                            </Button>
                                        </div>
                                    </div>
                                </Nav.Item>

                            </Nav>
                        </div>
                        <Alert variant="warning" className="mt-5">
                            <Alert.Heading as="h6" className="heading-wth-icon">
                                <span className="head-icon">
                                    <span className="feather-icon">
                                        <ZapOff />
                                    </span>
                                </span>
                                Trial Ends on 14 Jan
                            </Alert.Heading>
                            <p className="fs-7">Last 3 days left for your trial to end. Renew now to stay connected.</p>
                        </Alert>
                    </div>
                </SimpleBar>
                {/*Sidebar Fixnav*/}
                <div className="taskboardapp-fixednav">
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
            {/* Add New Board */}
            <AddNewBoard show={addNewBoard} onHide={() => setAddNewBoard(!addNewBoard)} />
            {/* Add Fav Board */}
            <AddNewFavBoard show={addFavBoard} onHide={() => setAddFavBoard(!addFavBoard)} />

        </>
    )
}

export default Sidebar
