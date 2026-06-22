import { useEffect, useState } from 'react';
import Image from 'next/image';
import SimpleBar from 'simplebar-react';
import { Inbox, MoreVertical, Star, UserCheck } from 'react-feather';
import { Badge, Button, Card, Col, Dropdown, Form, Row } from 'react-bootstrap';
import classNames from 'classnames';
import ContactDetails from './ContactDetails';
import { contactCards } from '@/data/contact/contact-card-data';


const ContactCardsBody = () => {
    const [contacts, setContacts] = useState(contactCards)
    const [showDetails, setShowDetails] = useState(false);
    //for multiple card selection
    const [multipleSelection, setMultipleSelection] = useState(false);

    const toggleCheck = (index) => {
        const updatedContacts = [...contacts];
        updatedContacts[index].checked = !updatedContacts[index].checked;
        setContacts(updatedContacts);
    };

    useEffect(() => {
        const anyChecked = contacts.some((contact) => contact.checked);
        setMultipleSelection(anyChecked);
    }, [contacts]);

    return (
        <>
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
                                                        <Form.Group>
                                                            <Form.Control placeholder="First name*" defaultValue type="text" />
                                                        </Form.Group>
                                                        <Form.Group>
                                                            <Form.Control placeholder="Last name*" defaultValue type="text" />
                                                        </Form.Group>
                                                    </Col>
                                                    <Col lg={4}>
                                                        <Form.Group>
                                                            <Form.Control placeholder="Email Id*" defaultValue type="text" />
                                                        </Form.Group>
                                                        <Form.Group>
                                                            <Form.Control placeholder="Phone" defaultValue type="text" />
                                                        </Form.Group>
                                                    </Col>
                                                    <Col lg={4}>
                                                        <Form.Group>
                                                            <Form.Control placeholder="Department" defaultValue type="text" />
                                                        </Form.Group>
                                                        <Form.Group>
                                                            <Form.Select id="input_tags" multiple >
                                                                <option>Collaborator</option>
                                                                <option>Designer</option>
                                                                <option>Developer</option>
                                                            </Form.Select>
                                                        </Form.Group>
                                                    </Col>
                                                </Row>
                                            </Col>
                                        </div>
                                    </Col>
                                    <Col xxl={2}>
                                        <Form.Group>
                                            <button data-bs-toggle="collapse" data-bs-target="#collapseExample" aria-expanded="false" className="btn btn-block btn-primary ">Create New
                                            </button>
                                        </Form.Group>
                                        <Form.Group>
                                            <button data-bs-toggle="collapse" disabled data-bs-target="#collapseExample" aria-expanded="false" className="btn btn-block btn-secondary">Discard
                                            </button>
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </Form>
                        </div>
                    </div>
                    <div className={classNames("contact-card-view", { "select-multiple": multipleSelection })}>
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
                                    <div id="datable_1_filter" className="dataTables_filter">
                                        <label>
                                            <Form.Control size="sm" type="search" placeholder="Search" />
                                        </label>
                                    </div>
                                    <div className="dataTables_length" id="datable_1_length">
                                        <label>
                                            View
                                            <Form.Select size="sm" name="datable_1_length">
                                                <option value={10}>10</option>
                                                <option value={25}>25</option>
                                                <option value={50}>50</option>
                                                <option value={100}>100</option>
                                            </Form.Select>
                                        </label>
                                    </div>
                                    <div className="dataTables_info" id="datable_1_info" role="status" aria-live="polite">1 - 10 of 11</div>
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
                        <Row className="row-cols-xxl-5 row-cols-xl-4 row-cols-lg-3 row-cols-md-2 row-cols-1 mb-5 gx-3">
                            {contacts.map((contact, index) => (
                                <Col key={contact.id} >
                                    <Card className="card-border contact-card">
                                        <Card.Body className="text-center">
                                            <Form.Check type="checkbox" className="form-check-lg">
                                                <Form.Check.Input
                                                    type="checkbox"
                                                    className="check-select"
                                                    checked={contact.checked} onChange={() => toggleCheck(index)}

                                                />
                                                <Form.Check.Label htmlFor="chk_sel_0" />
                                            </Form.Check>
                                            <div className="card-action-wrap">
                                                <Dropdown>
                                                    <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret ">
                                                        <span className="btn-icon-wrap">
                                                            <span className="feather-icon">
                                                                <MoreVertical />
                                                            </span>
                                                        </span>
                                                    </Dropdown.Toggle>
                                                    <Dropdown.Menu align="end">
                                                        <Dropdown.Item><i className="icon wb-reply" aria-hidden="true" />Reply</Dropdown.Item>
                                                        <Dropdown.Item><i className="icon wb-share" aria-hidden="true" />Forward</Dropdown.Item>
                                                        <Dropdown.Item><i className="icon wb-trash" aria-hidden="true" />Delete</Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                            <div className="avatar avatar-xl avatar-rounded">
                                                {contact.avatar
                                                    ?
                                                    <Image
                                                        src={contact.avatar}
                                                        alt="user"
                                                        className="avatar-img"
                                                    />
                                                    :
                                                    <>
                                                        {
                                                            contact.initAvatar.map((initAvt, indx) => (
                                                                <div className={`avatar avatar-xl avatar-rounded ${initAvt.variant}`} key={indx} >
                                                                    <span className="initial-wrap">
                                                                        {initAvt.name}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        }
                                                    </>
                                                }
                                            </div>
                                            <div className="user-name">
                                                <span className={classNames('contact-star', { 'marked': contact.stared })}>
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                {contact.name}
                                            </div>
                                            <div className="user-email">{contact.mail}</div>
                                            <div className="user-contact">{contact.phone}</div>
                                            <div className="user-desg">
                                                {/* <span className="badge badge-primary badge-indicator badge-indicator-lg me-2" /> */}
                                                <Badge bg={contact.badge} className="badge-indicator me-2" />
                                                {contact.position}
                                            </div>
                                        </Card.Body>
                                        <Card.Footer className="text-muted position-relative">
                                            <a href="#" className="d-flex align-items-center">
                                                <span className="feather-icon me-2">
                                                    <Inbox />
                                                </span>
                                                <span className="fs-7 lh-1">Message</span>
                                            </a>
                                            <div className="v-separator-full m-0" />
                                            <a href="#" className="d-flex align-items-center" onClick={() => setShowDetails(!showDetails)} >
                                                <span className="feather-icon me-2">
                                                    <UserCheck />
                                                </span>
                                                <span className="fs-7 lh-1">Profile</span>
                                            </a>
                                        </Card.Footer>
                                    </Card>
                                </Col>
                            ))}

                        </Row>
                        <Row>
                            <Col sm={12} md={5} className="d-flex align-items-center justify-content-center justify-content-md-start">
                                <div className="dataTables_info">1 - 10 of 30</div>
                            </Col>
                            <Col sm={12} md={7}>
                                <ul className="pagination custom-pagination pagination-simple mb-0 justify-content-center justify-content-md-end">
                                    <li className="paginate_button page-item previous disabled">
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
                                    <li className="paginate_button page-item next">
                                        <a href="#some" data-dt-idx={4} tabIndex={0} className="page-link">
                                            <i className="ri-arrow-right-s-line" />
                                        </a>
                                    </li>
                                </ul>
                            </Col>
                        </Row>
                    </div>
                </SimpleBar>
            </div>

            <ContactDetails show={showDetails} onHide={() => setShowDetails(!showDetails)} />
        </>
    )
}

export default ContactCardsBody
