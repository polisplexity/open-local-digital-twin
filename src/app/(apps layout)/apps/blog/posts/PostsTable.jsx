import { useState } from 'react';
import classNames from 'classnames';
import { Button, Col, Form, Row } from 'react-bootstrap';
import HkDataTable from '@/components/@hk-data-table'
import { columns, data } from '@/data/blog/post-table';

const PostsTable = () => {

    const [searchTerm, setSearchTerm] = useState("")

    return (
        <>
            <Row className="mb-3" >
                <Col xs={7} mb={3}>
                    <div className="blog-toolbar-left">
                        <Form.Group className="d-xxl-flex d-none align-items-center mb-0">
                            <Form.Select size='sm' className="w-120p">
                                <option value={1} >Bulk actions</option>
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
                    <div className="blog-toolbar-right">
                        <div className="dataTables_filter">
                            <label>
                                <Form.Control
                                    size="sm"
                                    type="search"
                                    placeholder="Search"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </label>
                        </div>
                        <div className="dataTables_paginate paging_simple_numbers" id="datable_1_paginate">
                            <ul className="pagination custom-pagination pagination-simple m-0">
                                <li className={classNames("paginate_button page-item previous")} id="datable_1_previous">
                                    <a href="#" className="page-link">
                                        <i className="ri-arrow-left-s-line" />
                                    </a>
                                </li>
                                <li className={classNames("paginate_button page-item next")} id="datable_1_next">
                                    <a href="#" className="page-link" >
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
                rowSelection={true}
                rowsPerPage={10}
                searchQuery={searchTerm}
                classes="nowrap w-100 mb-5"
                responsive
            />
        </>
    )
}

export default PostsTable
