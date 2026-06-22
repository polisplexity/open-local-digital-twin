import { Nav, Tab } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';
import PostsTable from './PostsTable';

const PostBody = () => {
    return (
        <div className="blog-body">
            <SimpleBar className="nicescroll-bar">
                <div className="post-list">
                    <Tab.Container defaultActiveKey="allPost">
                        <Nav variant="tabs" className="nav-line nav-icon nav-light">
                            <Nav.Item>
                                <Nav.Link eventKey="allPost">
                                    <div className="d-flex align-items-center">
                                        <span className="nav-link-text">All Posts</span>
                                        <span className="badge badge-pill badge-sm badge-soft-secondary ms-1">10</span>
                                    </div>
                                </Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link>
                                    <div className="d-flex align-items-center">
                                        <span className="nav-link-text">Published</span>
                                        <span className="badge badge-pill badge-sm badge-soft-secondary ms-1">6</span>
                                    </div>
                                </Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link>
                                    <div className="d-flex align-items-center">
                                        <span className="nav-link-text">Trash</span>
                                        <span className="badge badge-pill badge-sm badge-soft-secondary ms-1">4</span>
                                    </div>
                                </Nav.Link>
                            </Nav.Item>
                        </Nav>
                        <Tab.Content>
                            <Tab.Pane eventKey="allPost">
                                <PostsTable />
                            </Tab.Pane>
                        </Tab.Content>
                    </Tab.Container>
                </div>
            </SimpleBar>
        </div>
    )
}

export default PostBody
