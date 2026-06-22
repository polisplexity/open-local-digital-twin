import { useState } from 'react';
import { Button, Nav } from 'react-bootstrap';
import { Archive, Book, Edit, Flag, Grid, Plus, Settings, Star, Tag, Trash2, Users } from 'react-feather';
import SimpleBar from 'simplebar-react';
import HkBadge from '@/components/@hk-badge/@hk-badge';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import AddNewCategory from './AddNewCategory';
import AddTag from './AddTag';
import Link from 'next/link';

const BlogAppSidebar = () => {
    const [addCategory, setAddCategory] = useState(false);
    const [addTags, setAddTags] = useState(false);

    return (
        <>
            <nav className="blogapp-sidebar">
                <SimpleBar className="nicescroll-bar">
                    <div className="menu-content-wrap">
                        <Link href="add-new-post" className="btn btn-primary btn-rounded btn-block mb-4">
                            Create Post
                        </Link>
                        <div className="menu-group">
                            <Nav as="ul" defaultActiveKey="post" className="nav-light navbar-nav flex-column">
                                <Nav.Item as="li" >
                                    <Nav.Link eventKey="post" >
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Users />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Posts</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link eventKey="published" >
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Star />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Published</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link eventKey="archived" >
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Archive />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Archived</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link eventKey="draft" >
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Edit />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Draft</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link eventKey="deleted" >
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
                        <div className="menu-gap" />
                        <div className="nav-header">
                            <span>Manage</span>
                        </div>
                        <div className="menu-group">
                            <Nav as="ul" className="nav-light navbar-nav flex-column">
                                <Nav.Item as="li">
                                    <Nav.Link>
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Flag />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Manage Post</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link>
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Grid />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Manage Categories</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link>
                                        <span className="nav-icon-wrap">
                                            <span className="feather-icon">
                                                <Tag />
                                            </span>
                                        </span>
                                        <span className="nav-link-text">Manage Tags</span>
                                    </Nav.Link>
                                </Nav.Item>
                            </Nav>
                        </div>
                        <div className="separator separator-light" />
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <div className="title-sm text-primary mb-0">Categories</div>
                            <Button size="xs" variant="light" className="btn-icon btn-rounded" onClick={() => setAddCategory(!addCategory)}>
                                <span className="icon">
                                    <HkTooltip placement="top" title="Add Category" >
                                        <span className="feather-icon">
                                            <Plus />
                                        </span>
                                    </HkTooltip>
                                </span>
                            </Button>
                        </div>
                        <div className="menu-group">
                            <Nav as="ul" className="nav-light navbar-nav flex-column">
                                <Nav.Item as="li">
                                    <Nav.Link className="link-badge-right">
                                        <span className="nav-link-text">Design</span>
                                        <HkBadge pill size="sm" soft bg="primary" className="ms-auto" >136</HkBadge>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link className="link-badge-right">
                                        <span className="nav-link-text">Development</span>
                                        <HkBadge pill size="sm" soft bg="primary" className="ms-auto" >2</HkBadge>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link className="link-badge-right">
                                        <span className="nav-link-text">User Interface</span>
                                        <HkBadge pill size="sm" soft bg="primary" className="ms-auto" >86</HkBadge>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link className="link-badge-right">
                                        <span className="nav-link-text">Business</span>
                                        <HkBadge pill size="sm" soft bg="primary" className="ms-auto" >34</HkBadge>
                                    </Nav.Link>
                                </Nav.Item>
                            </Nav>
                        </div>
                        <div className="separator separator-light" />
                        <div className="d-flex align-items-center justify-content-between mb-4">
                            <div className="title-sm text-primary mb-0">Tags</div>
                            <Button variant="light" size="xs" className="btn-icon btn-rounded" onClick={() => setAddTags(!addTags)} >
                                <HkTooltip placement="top" title="Add Tag" >
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <Plus />
                                        </span>
                                    </span>
                                </HkTooltip>
                            </Button>
                        </div>
                        <div className="menu-group">
                            <div className="tag-cloud">
                                <Link href="#" className="badge badge-outline badge-light">Collaboration</Link>
                                <Link href="#" className="badge badge-outline badge-light">React Developer</Link>
                                <Link href="#" className="badge badge-outline badge-light">Angular Developer</Link>
                                <Link href="#" className="badge badge-outline badge-light">promotion</Link>
                                <Link href="#" className="badge badge-outline badge-light">Advertisement</Link>
                            </div>
                        </div>
                    </div>
                </SimpleBar>
                {/*Sidebar Fixnav*/}
                <div className="blogapp-fixednav">
                    <div className="hk-toolbar">
                        <Nav as="ul" className="nav-light">
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
            </nav>
            {/* Add Category */}
            <AddNewCategory show={addCategory} hide={() => setAddCategory(!addCategory)} />
            {/* Add Tag */}
            <AddTag show={addTags} hide={() => setAddTags(!addTags)} />
        </>
    )
}

export default BlogAppSidebar
