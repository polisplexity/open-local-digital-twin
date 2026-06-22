import Link from 'next/link';
import { useState } from 'react';
import { Button, Nav } from 'react-bootstrap';
import { Archive, Book, Download, Edit, Inbox, Plus, Printer, Settings, Star, Trash2, Upload } from 'react-feather';
import SimpleBar from 'simplebar-react';
import AddLabel from './AddLabel';
import AddTag from './AddTag';
import CreateNewContact from './CreateNewContact';
import HkBadge from '@/components/@hk-badge/@hk-badge';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';


const ContactAppSidebar = () => {
    const [addLabels, setAddLabels] = useState(false);
    const [addTags, setAddTags] = useState(false);
    const [addNewContact, setAddNewContact] = useState(false);

    return (
        <>
            <Nav className="contactapp-sidebar">
                <SimpleBar className="nicescroll-bar">
                    <div className="menu-content-wrap">
                        <Button variant="primary" className="btn-rounded btn-block mb-4" onClick={() => setAddNewContact(!addNewContact)}>
                            Add new contact
                        </Button>
                        <div className="menu-group">
                            <Nav className="nav-light navbar-nav flex-column">
                                <Nav.Item>
                                    <Nav.Link active >
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Inbox />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">All Contacts</span>
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
                                        <span className="nav-link-text">Pending</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
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
                        <div className="menu-group">
                            <Nav className="nav-light navbar-nav flex-column">
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Upload />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Export</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Download />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Import</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Printer />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Print</span>
                                    </Nav.Link>
                                </Nav.Item>
                            </Nav>
                        </div>
                        <div className="separator separator-light" />
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <div className="title-sm text-primary mb-0">Labels</div>
                            <Button variant="light" size="xs" className="btn-icon btn-rounded" onClick={() => setAddLabels(!addLabels)} >
                                <HkTooltip placement="top" title="Add Label">
                                    <span className="feather-icon">
                                        <Plus />
                                    </span>
                                </HkTooltip>
                            </Button>
                        </div>
                        <div className="menu-group">
                            <Nav className="nav-light navbar-nav flex-column">
                                <Nav.Item>
                                    <Nav.Link className="link-badge-right" href="#">
                                        <span className="nav-link-text">Design</span>
                                        <span className="badge badge-pill badge-sm badge-soft-primary ms-auto">136</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link className="link-badge-right" href="#">
                                        <span className="nav-link-text">Development</span>
                                        <span className="badge badge-pill badge-sm badge-soft-primary ms-auto">2</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link className="link-badge-right" href="#">
                                        <span className="nav-link-text">Inventory</span>
                                        <span className="badge badge-pill badge-sm badge-soft-primary ms-auto">86</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link className="link-badge-right" href="#">
                                        <span className="nav-link-text">Human Resource</span>
                                        <span className="badge badge-pill badge-sm badge-soft-primary ms-auto">34</span>
                                    </Nav.Link>
                                </Nav.Item>
                            </Nav>
                        </div>
                        <div className="separator separator-light" />
                        <div className="d-flex align-items-center justify-content-between mb-4">
                            <div className="title-sm text-primary mb-0">Tags</div>
                            <Button variant="light" size="xs" className="btn-icon btn-rounded" onClick={() => setAddTags(!addTags)} >
                                <HkTooltip placement="top" title="Add Tag">
                                    <span className="feather-icon">
                                        <Plus />
                                    </span>
                                </HkTooltip>
                            </Button>
                        </div>
                        <div className="tag-cloud">
                            <HkBadge as={Link} href="#" bg="white" className="badge-light" outline text="dark" >Collaboration</HkBadge>
                            <HkBadge as={Link} href="#" bg="white" className="badge-light" outline text="dark" >React Developer</HkBadge>
                            <HkBadge as={Link} href="#" bg="white" className="badge-light" outline text="dark" >Angular Developer</HkBadge>
                            <HkBadge as={Link} href="#" bg="white" className="badge-light" outline text="dark" >promotion</HkBadge>
                            <HkBadge as={Link} href="#" bg="white" className="badge-light" outline text="dark" >Advertisement</HkBadge>
                        </div>
                    </div>
                </SimpleBar>
                {/*Sidebar Fixnav*/}
                <div className="contactapp-fixednav">
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
            {/* Create New Contact */}
            <CreateNewContact show={addNewContact} close={() => setAddNewContact(!addNewContact)} />
            {/* Add Label */}
            <AddLabel show={addLabels} hide={() => setAddLabels(!addLabels)} />
            {/* Add Tag */}
            <AddTag show={addTags} hide={() => setAddTags(!addTags)} />
        </>
    )
}

export default ContactAppSidebar
