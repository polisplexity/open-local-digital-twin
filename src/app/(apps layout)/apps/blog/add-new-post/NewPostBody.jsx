import { Card, Col, Container, Form, Nav, Row, Tab } from 'react-bootstrap';
import { Edit, Settings, Zap } from 'react-feather';
import SimpleBar from 'simplebar-react';
import TinymceEditor from '@/components/TinymceEditor/TinymceEditor';
import BlogAside from '../BlogAside';
import HkDropZone from '@/components/@hk-drop-zone/HkDropZone';

const NewPostBody = () => {
    return (
        <div className="blog-body">
            <SimpleBar className="nicescroll-bar">
                <Container fluid>
                    <Row>
                        <Col xxl={9} lg={8}>
                            <Form className="edit-post-form">
                                <Form.Group className="mb-3" >
                                    <Form.Label>Post Title</Form.Label>
                                    <Form.Control placeholder="Post Title" />
                                </Form.Group>
                                <Form.Group className="mb-3" >
                                    <Form.Label>Permalink</Form.Label>
                                    <Form.Control placeholder="Permalink" />
                                </Form.Group>
                                <Tab.Container defaultActiveKey="tabClassic" >
                                    <Nav variant="tabs" className="nav-light border-bottom-0">
                                        <Nav.Item>
                                            <Nav.Link eventKey="tabClassic">
                                                <span className="nav-link-text">Classic</span>
                                            </Nav.Link>
                                        </Nav.Item>
                                        <Nav.Item>
                                            <Nav.Link eventKey="tabCode">
                                                <span className="nav-link-text">Code</span>
                                            </Nav.Link>
                                        </Nav.Item>
                                    </Nav>
                                    <Card className="card-border rounded-top-start-0">
                                        <Card.Body>
                                            <Tab.Content className="mt-0">
                                                <Tab.Pane eventKey="tabClassic">
                                                    <div className="tinymce-wrap">
                                                        <TinymceEditor />
                                                    </div>
                                                </Tab.Pane>
                                                <Tab.Pane eventKey="tabCode">
                                                </Tab.Pane>
                                            </Tab.Content>
                                        </Card.Body>
                                    </Card>
                                </Tab.Container>
                                <Card className="card-border advance-option-post">
                                    <Card.Body>
                                        <Card.Title>Advance Option</Card.Title>
                                        <Tab.Container defaultActiveKey="summery" >
                                            <Nav variant="tabs" className="nav-line nav-icon nav-light border-bottom">
                                                <Nav.Item>
                                                    <Nav.Link eventKey="summery">
                                                        <span className="nav-icon-wrap">
                                                            <span className="feather-icon">
                                                                <Zap />
                                                            </span>
                                                        </span>
                                                        <span className="nav-link-text">Post Slider Images</span>
                                                    </Nav.Link>
                                                </Nav.Item>
                                                <Nav.Item>
                                                    <Nav.Link eventKey="#" >
                                                        <span className="nav-icon-wrap">
                                                            <span className="feather-icon">
                                                                <Settings />
                                                            </span>
                                                        </span>
                                                        <span className="nav-link-text">Post Settings</span>
                                                    </Nav.Link>
                                                </Nav.Item>
                                                <Nav.Item>
                                                    <Nav.Link disabled>
                                                        <span className="nav-icon-wrap">
                                                            <span className="feather-icon">
                                                                <Edit />
                                                            </span>
                                                        </span>
                                                        <span className="nav-link-text">Version History</span>
                                                    </Nav.Link>
                                                </Nav.Item>
                                            </Nav>
                                            <Tab.Content>
                                                <Tab.Pane eventKey="summery">
                                                    <HkDropZone>
                                                        <span className="main-text">Upload a high quality image to</span><div className="fw-light text-muted"> Make your blog post inviting</div>
                                                    </HkDropZone>
                                                </Tab.Pane>
                                            </Tab.Content>
                                        </Tab.Container>
                                    </Card.Body>
                                </Card>
                            </Form>
                        </Col>
                        <Col xxl={3} lg={4}>
                            <BlogAside />
                        </Col>
                    </Row>
                </Container>
            </SimpleBar>
        </div >
    )
}

export default NewPostBody
