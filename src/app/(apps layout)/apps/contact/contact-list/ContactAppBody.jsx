import { useState } from 'react';
import SimpleBar from 'simplebar-react';
import { Button, Col, Form, Pagination, Row, Table } from 'react-bootstrap';
import HkDataTable from '@/components/@hk-data-table'
import { columns, data } from '@/data/contact/contact-list';



const ContactAppBody = () => {

    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div className="contact-body">
            <SimpleBar className="nicescroll-bar">
                <div className="collapse" id="collapseQuick">
                    <div className="quick-access-form-wrap">
                        <Form className="quick-access-form border">
                            <Row className="gx-3">
                                <Col xxl={10}>
                                    <div className="position-relative">
                                        <div className="dropify-square">
                                            <input type="file" className="dropify-1" />
                                        </div>
                                        <Col md={12}>
                                            <Row className="gx-3">
                                                <Col lg={4}>
                                                    <Form.Group className="mb-3">
                                                        <Form.Control placeholder="First name*" type="text" />
                                                    </Form.Group>
                                                    <Form.Group className="mb-3">
                                                        <Form.Control placeholder="Last name*" type="text" />
                                                    </Form.Group>
                                                </Col>
                                                <Col lg={4}>
                                                    <Form.Group className="mb-3">
                                                        <Form.Control placeholder="Email Id*" type="text" />
                                                    </Form.Group>
                                                    <Form.Group className="mb-3">
                                                        <Form.Control placeholder="Phone" type="text" />
                                                    </Form.Group>
                                                </Col>
                                                <Col lg={4}>
                                                    <Form.Group className="mb-3">
                                                        <Form.Control placeholder="Department" type="text" />
                                                    </Form.Group>
                                                    <Form.Group className="mb-3">
                                                        <Form.Select id="input_tags" multiple >
                                                            <option value={1}>Collaborator</option>
                                                            <option value={2} >Designer</option>
                                                            <option value={3}>Developer</option>
                                                        </Form.Select>
                                                    </Form.Group>
                                                </Col>
                                            </Row>
                                        </Col>
                                    </div>
                                </Col>
                                <Col xxl={2}>
                                    <Form.Group className="mb-3">
                                        <Button variant="primary" data-bs-toggle="collapse" data-bs-target="#collapseExample" aria-expanded="false" className="btn-block">Create New
                                        </Button>
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Button variant="secondary" data-bs-toggle="collapse" disabled data-bs-target="#collapseExample" aria-expanded="false" className="btn-block">Discard
                                        </Button>
                                    </Form.Group>
                                </Col>
                            </Row>
                        </Form>
                    </div>
                </div>
                <div className="contact-list-view">

                    <Row className="mb-3" >
                        <Col xs={7} mb={3}>
                            <div className="contact-toolbar-left">
                                <Form.Group className="d-xxl-flex d-none align-items-center mb-0">
                                    <Form.Select size='sm' className="w-120p">
                                        <option value={1}>Bulk actions</option>
                                        <option value={2}>Edit</option>
                                        <option value={3}>Move to trash</option>
                                    </Form.Select>
                                    <Button size="sm" variant="light" className="ms-2">Apply</Button>
                                </Form.Group>
                                <Form.Group className="d-xxl-flex d-none align-items-center mb-0">
                                    <label className="flex-shrink-0 mb-0 me-2">Sort by:</label>
                                    <Form.Select size='sm' className="w-130p">
                                        <option value={1}>Date Created</option>
                                        <option value={2}>Date Edited</option>
                                        <option value={3}>Frequent Contacts</option>
                                        <option value={4}>Recently Added</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Select size="sm" className="d-flex align-items-center w-130p">
                                    <option value={1}>Export to CSV</option>
                                    <option value={2}>Export to PDF</option>
                                    <option value={3}>Send Message</option>
                                    <option value={4}>Delegate Access</option>
                                </Form.Select>
                            </div>
                        </Col>
                        <Col xs={5} mb={3}>
                            <div className="contact-toolbar-right">
                                <div className="dataTables_filter">
                                    <Form.Label>
                                        <Form.Control
                                            size="sm"
                                            type="search"
                                            placeholder="Search"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </Form.Label>
                                </div>
                                <div className="dataTables_paginate paging_simple_numbers" id="datable_1_paginate">
                                    <ul className="pagination custom-pagination pagination-simple m-0">
                                        <li className="paginate_button page-item previous disabled" id="datable_1_previous">
                                            <a href="#some" data-dt-idx={0} tabIndex={0} className="page-link">
                                                <i className="ri-arrow-left-s-line" />
                                            </a>
                                        </li>
                                        <li className="paginate_button page-item active">
                                            <a href="#some" data-dt-idx={1} tabIndex={0} className="page-link">1</a>
                                        </li>
                                        <li className="paginate_button page-item ">
                                            <a href="#some" data-dt-idx={2} tabIndex={0} className="page-link">2</a>
                                        </li>
                                        <li className="paginate_button page-item next" id="datable_1_next">
                                            <a href="#some" data-dt-idx={3} tabIndex={0} className="page-link">
                                                <i className="ri-arrow-right-s-line" />
                                            </a>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </Col>
                    </Row>

                    <HkDataTable
                        column={columns}
                        rowData={data}
                        rowsPerPage={10}
                        rowSelection={true}
                        markStarred={true}
                        searchQuery={searchTerm}
                        classes="nowrap w-100 mb-5"
                        responsive
                    />

                </div>
            </SimpleBar >
        </div >
    )
}

export default ContactAppBody
