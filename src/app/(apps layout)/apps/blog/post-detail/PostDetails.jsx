import { Card, Col, Container, Form, Nav, Row, Tab } from 'react-bootstrap';
import { Edit, Settings, Zap } from 'react-feather';
import SimpleBar from 'simplebar-react';
import TinymceEditor from '@/components/TinymceEditor/TinymceEditor';
import BlogAside from '../BlogAside';
import HkDropZone from '@/components/@hk-drop-zone/HkDropZone';

//Images
import mock1 from '@/assets/img/gallery/mock1.jpg';
import mock2 from '@/assets/img/gallery/mock2.jpg';
import mock3 from '@/assets/img/gallery/mock3.jpg';
import mock4 from '@/assets/img/gallery/mock4.jpg';
import mock5 from '@/assets/img/gallery/mock5.jpg';
import mock6 from '@/assets/img/gallery/mock6.jpg';

const PostDetails = () => {
    return (
        <div className="blog-body">
            <SimpleBar className="nicescroll-bar">
                <Container fluid>
                    <Row>
                        <Col xxl={9} lg={8}>
                            <Form className="edit-post-form">
                                <Form.Group className="mb-3">
                                    <Form.Label>Post Title</Form.Label>
                                    <Form.Control defaultValue="Building an effective Dashboard User Interface Design" placeholder="Post Title" />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Permalink</Form.Label>
                                    <Form.Control defaultValue="https://hencework.com/theme/jampack" placeholder="Post Title" />
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
                                                        <TinymceEditor initialvalue={"\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<p style=\"text-align: center;\"><span style=\"color: #bdc3c7;\" data-mce-style=\"color: #bdc3c7;\">→ This is a full-featured editor demo. Please explore! ←</span></p>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<p style=\"text-align: center;\"><br></p>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<h2 style=\"text-align: center; color:#298DFF\">TinyMCE is the world's most customizable, and flexible, rich text editor.</h2>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<p style=\"text-align: center;\"><strong> <span style=\"font-size: 14px;\" data-mce-style=\"font-size: 14px;\"> <span> A featherweight download, TinyMCE can handle any challenge you throw at it. </span> </span> </strong></p>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<p style=\"text-align: center;\"><br></p>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<table style=\"border-collapse: collapse; width: 85%; margin-left: auto; margin-right: auto; border: 0;\" data-mce-style=\"border-collapse: collapse; width: 85%; margin-left: auto; margin-right: auto; border: 0;\" class=\"mce-item-table\">\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<tbody>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<tr>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<td style=\"width: 25%; text-align: center; padding: 7px;\" ><span>🛠 50+ <span class=\"mce-spellchecker-annotation mce-spellchecker-word mce-cram_68622596921598605361436\" aria-invalid=\"spelling\" data-mce-highlight-id=\"mce-cram_68622596921598605361436\" data-mce-bogus=\"1\" data-mce-annotation=\"Plugins\" data-mce-lingo=\"en_us\">Plugins</span></span></td>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<td style=\"width: 25%; text-align: center; padding: 7px;\" ><span>💡 Premium Support</span></td>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<td style=\"width: 25%; text-align: center; padding: 7px;\" ><span>🖍 Custom Skins</span></td>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<td style=\"width: 25%; text-align: center; padding: 7px;\" ><span>⚙ Full API Access</span></td>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</tr>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</tbody>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</table>\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t"} />
                                                    </div>
                                                </Tab.Pane>
                                                <Tab.Pane eventKey="tabCode">
                                                    <div contentEditable="true" suppressContentEditableWarning={true} >
                                                        &lt;div class=&quot;col&quot;&gt;
                                                        &lt;a href=&quot;#some&quot;&gt;
                                                        &lt;div class=&quot;card card-border&quot; style=&quot;background-image:url(&apos;dist/img/gallery/mock5.jpg&apos;);&quot;&gt;
                                                        &lt;/div&gt;
                                                        &lt;/a&gt;
                                                        &lt;/div&gt;
                                                    </div>
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
                                                    <Nav.Link>
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
                                                    <Row sm className="row-cols-xl-6 row-cols-lg-3 row-cols-sm-2 row-cols-1 uploaded-img-prev">
                                                        <Col>
                                                            <a href="#">
                                                                <Card className="card-border" style={{ backgroundImage: `url(${mock1.src})` }}>
                                                                </Card>
                                                            </a>
                                                        </Col>
                                                        <Col>
                                                            <a href="#">
                                                                <Card className="card-border" style={{ backgroundImage: `url(${mock2.src})` }}>
                                                                </Card>
                                                            </a>
                                                        </Col>
                                                        <Col>
                                                            <a href="#">
                                                                <Card className="card-border" style={{ backgroundImage: `url(${mock3.src})` }}>
                                                                </Card>
                                                            </a>
                                                        </Col>
                                                        <Col>
                                                            <a href="#">
                                                                <Card className="card-border" style={{ backgroundImage: `url(${mock4.src})` }}>
                                                                </Card>
                                                            </a>
                                                        </Col>
                                                        <Col>
                                                            <a href="#">
                                                                <Card className="card-border" style={{ backgroundImage: `url(${mock5.src})` }}>
                                                                </Card>
                                                            </a>
                                                        </Col>
                                                        <Col>
                                                            <a href="#">
                                                                <Card className="card-border" style={{ backgroundImage: `url(${mock6.src})` }}>
                                                                </Card>
                                                            </a>
                                                        </Col>
                                                    </Row>
                                                </Tab.Pane>
                                            </Tab.Content>
                                        </Tab.Container>
                                    </Card.Body>
                                </Card>
                            </Form>
                        </Col>
                        <Col xxl={3} lg={4} className="col-xxl-3 col-lg-4">
                            <BlogAside />
                        </Col>
                    </Row>
                </Container>
            </SimpleBar>
        </div>
    )
}

export default PostDetails
