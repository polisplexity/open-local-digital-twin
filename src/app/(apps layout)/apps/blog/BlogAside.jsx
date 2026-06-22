import { useState } from 'react';
import { Button, Card, Form, Nav, Tab } from 'react-bootstrap';
import { Plus } from 'react-feather';
import SimpleBar from 'simplebar-react';
import DateRangePicker from 'react-bootstrap-daterangepicker';
import HkTags from '@/components/@hk-tags/@hk-tags';
import HkDropZone from '@/components/@hk-drop-zone/HkDropZone';
import HkCollapse from '@/components/@hk-collapse/@hk-collapse';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';

const BlogAside = () => {
    const [startDate, setStartDate] = useState(new Date());
    const multiSelectOpt = [
        { value: "collaborator", label: "Collaborator" },
        { value: "designer", label: "Designer" },
        { value: "react-developer", label: "React Developer" },
    ]


    return (
        <div className="content-aside">
            <Button variant="outline-secondary" className="btn-block" disabled>Preview Changes</Button>
            <Button variant="primary" className="btn-block mb-3">Publish</Button>
            <Card className="card-border">
                <Card.Body>
                    <Form className="edit-post-form">
                        <Form.Group className="mb-3" >
                            <Form.Label>Published Date</Form.Label>
                            <DateRangePicker
                                initialSettings={{
                                    singleDatePicker: true,
                                    timePicker: true,
                                    showDropdowns: true,
                                    startDate: startDate,
                                    locale: {
                                        format: 'M/DD/YYYY hh:mm A',
                                    },
                                }}
                                onApply={(event, picker) => {
                                    setStartDate(new Date(picker.startDate));
                                }}
                            >
                                <Form.Control type="text" name="single-date" />
                            </DateRangePicker>
                        </Form.Group>
                        <Form.Group className="mb-3" >
                            <Form.Label>Visibility</Form.Label>
                            <Form.Select>
                                <option value={1}>Public</option>
                                <option value={2}>Private</option>
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3" >
                            <Form.Label>Status</Form.Label>
                            <Form.Select>
                                <option value={1}>--</option>
                            </Form.Select>
                        </Form.Group>
                    </Form>
                </Card.Body>
            </Card>
            <HkCollapse
                bsPrefix="a"
                href="#"
                targetId="categories_1"
                wrapperClass="card-border overflow-hidden"
                headerClass="card-header-action"
                title={<div className="d-flex align-items-center">
                    <h6 className="me-2 mb-0">Categories</h6>
                    <span className="btn btn-xs btn-icon btn-rounded btn-light">
                        <HkTooltip title="Add Category" placement="top">
                            <span className="icon">
                                <span className="feather-icon">
                                    <Plus />
                                </span>
                            </span>
                        </HkTooltip>
                    </span>
                </div>}
                collapsed={false}
                collapseIcon={true}
            >
                <Tab.Container defaultActiveKey="tabCat" >
                    <Nav justify className="nav-light nav-tabs nav-segmented-tabs segmented-tabs-soft">
                        <Nav.Item>
                            <Nav.Link eventKey="tabCat">
                                <span className="nav-link-text">All Categories</span>
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="tabFreq">
                                <span className="nav-link-text badge-on-text">Frequent</span>
                            </Nav.Link>
                        </Nav.Item>
                    </Nav>
                    <Tab.Content>
                        <Tab.Pane eventKey="tabCat">
                            <div className="h-180p">
                                <SimpleBar className="nicescroll-bar p-0">
                                    <Form.Check
                                        type="checkbox"
                                        label="Design"
                                        id="catchk1"
                                    />
                                    <Form.Check
                                        type="checkbox"
                                        label="Development"
                                        id="catchk2"
                                    />
                                    <Form.Check
                                        type="checkbox"
                                        label="Technology"
                                        id="catchk3"
                                    />
                                    <Form.Check
                                        type="checkbox"
                                        label="Business"
                                        id="catchk4"
                                    />
                                    <Form.Check
                                        type="checkbox"
                                        label="Social Media"
                                        id="catchk5"
                                    />
                                    <Form.Check
                                        type="checkbox"
                                        label="Sports"
                                        id="catchk6"
                                    />
                                    <Form.Check
                                        type="checkbox"
                                        label="Writing"
                                        id="catchk7"
                                    />
                                </SimpleBar>
                            </div>
                        </Tab.Pane>
                        <Tab.Pane eventKey="tabFreq">
                            <div className="h-180p">
                                <SimpleBar className="nicescroll-bar p-0">
                                    <Form.Check
                                        type="checkbox"
                                        label="Design"
                                        id="catchk8"
                                    />
                                    <Form.Check
                                        type="checkbox"
                                        label="Development"
                                        id="catchk9"
                                    />
                                    <Form.Check
                                        type="checkbox"
                                        label="Technology"
                                        id="catchk10"
                                    />
                                    <Form.Check
                                        type="checkbox"
                                        label="Business"
                                        id="catchk11"
                                    />
                                </SimpleBar>
                            </div>
                        </Tab.Pane>
                    </Tab.Content>
                </Tab.Container>
            </HkCollapse>
            <HkCollapse
                bsPrefix="a"
                href="#"
                targetId="tags_1"
                wrapperClass="card-border overflow-hidden"
                headerClass="card-header-action"
                title={<h6 className="mb-0">Add Tags(Upto 5)</h6>}
                collapsed={false}
                collapseIcon={true}
            >
                <HkTags
                    options={multiSelectOpt}
                    defaultValue={[multiSelectOpt[0], multiSelectOpt[1], multiSelectOpt[2], multiSelectOpt[3]]}
                />
            </HkCollapse>
            <HkCollapse
                bsPrefix="a"
                href="#"
                targetId="post_1"
                wrapperClass="card-border overflow-hidden"
                headerClass="card-header-action"
                title={<div className="d-flex align-items-center">
                    <h6 className="me-2 mb-0">Post type</h6>
                    <span className="btn btn-xs btn-icon btn-rounded btn-light">
                        <HkTooltip title="Add Category" placement="top">
                            <span className="icon">
                                <span className="feather-icon">
                                    <Plus />
                                </span>
                            </span>
                        </HkTooltip>
                    </span>
                </div>}
                collapsed={false}
                collapseIcon={true}
            >
                <Form.Check type="radio" className="mb-1" label="Image Post" id="customRadio1" defaultChecked />
                <Form.Check type="radio" className="mb-1" label="Video Post" id="customRadio2" />
                <Form.Check type="radio" className="mb-1" label="Quote Post" id="customRadio3" />
                <Form.Check type="radio" label="Gallery Post" id="customRadio4" />
            </HkCollapse>
            <HkCollapse
                bsPrefix="a"
                href="#"
                targetId="prev_1"
                wrapperClass="card-border overflow-hidden"
                headerClass="card-header-action"
                title={<div className="d-flex align-items-center">
                    <h6 className="me-2 mb-0">Preview Image</h6>
                    <span className="btn btn-xs btn-icon btn-rounded btn-light">
                        <HkTooltip title="Add Category" placement="top">
                            <span className="icon">
                                <span className="feather-icon">
                                    <Plus />
                                </span>
                            </span>
                        </HkTooltip>
                    </span>
                </div>}
                collapsed={false}
                collapseIcon={true}
            >
                <HkDropZone>
                    <span className="main-text">Upload a high quality image to</span><div className="fw-light text-muted"> Make your blog post inviting</div>
                </HkDropZone>
            </HkCollapse>
        </div>
    )
}

export default BlogAside
