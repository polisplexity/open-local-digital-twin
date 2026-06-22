import { Badge, Button, Card, Dropdown, Form } from 'react-bootstrap';
import { ArrowDown, ArrowRight, CornerUpLeft, Edit, MoreVertical, Paperclip, Printer, Star, Trash2 } from 'react-feather';
import SimpleBar from 'simplebar-react';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import Image from 'next/image';
import HkChips from '@/components/@hk-chips/@hk-chips';
import HkAccordion from '@/components/@hk-accordion/@hk-accordion';

//Images
import avatar2 from '@/assets/img/avatar2.jpg';
import avatar10 from '@/assets/img/avatar10.jpg';
import avatar11 from '@/assets/img/avatar11.jpg';
import avatar12 from '@/assets/img/avatar12.jpg';
import avatar13 from '@/assets/img/avatar13.jpg';
import sign from '@/assets/img/signature-1.png';

const EmailBody = () => {


    return (
        <div className="email-body">
            <SimpleBar className="nicescroll-bar">
                <div className="single-email-subject">
                    <div>
                        <h4 className="fw-light">Update available for your purchased item.</h4>
                        <Badge bg="orange" pill className="badge-sm flex-shrink-0 ms-3">updates</Badge>
                    </div>
                    <div className="email-options-wrap">
                        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Print">
                            <HkTooltip id="tooltip1" placement="top" title="Print" >
                                <span className="icon">
                                    <span className="feather-icon">
                                        <Printer />
                                    </span>
                                </span>
                            </HkTooltip>
                        </Button>
                        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                            <HkTooltip id="tooltip2" placement="top" title="Reply" >
                                <span className="icon">
                                    <span className="feather-icon">
                                        <CornerUpLeft />
                                    </span>
                                </span>
                            </HkTooltip>
                        </Button>
                        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                            <HkTooltip id="tooltip3" placement="top" title="Forward" >
                                <span className="icon">
                                    <span className="feather-icon">
                                        <ArrowRight />
                                    </span>
                                </span>
                            </HkTooltip>
                        </Button>
                    </div>
                </div>
                {/* <HkAccordion alwaysOpen id="accordionSimpleExample" className="accordion-simple single-email-thread">
                    <div className="accordion-item">
                        <HkAccordion.Toggle eventKey="0" className="accordion-header" >
                            <div>
                                <div className="email-head">
                                    <div data-bs-toggle="collapse" data-bs-target="#0" role="button" aria-expanded="true" />
                                    <div className="media">
                                        <div className="media-head">
                                            <div className="avatar d-8">
                                                <Image src={avatar2} alt="user" className="avatar-img rounded-circle" />
                                            </div>
                                        </div>
                                        <div className="media-body">
                                            <div>Morgan Freeman</div>
                                            <div className="fs-7">
                                                <span>to</span>
                                                <Dropdown bsPrefix="mail-desc-dropdown">
                                                    <Dropdown.Toggle as="a" className="link-dark ms-1" href="#">me</Dropdown.Toggle >
                                                    <Dropdown.Menu>
                                                        <div>
                                                            <span>from :</span><span>Morgan <span>&lt;morganfreeman@jampack.com&gt;</span></span>
                                                        </div>
                                                        <div>
                                                            <span>to :</span><span>Hencework <span>&lt;contact@hencework.com&gt;</span></span>
                                                        </div>
                                                        <div>
                                                            <span>date :</span><span>Dec 30, 4:22 PM</span>
                                                        </div>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="email-head-action">
                                        <div className="email-time">Dec 30, 4:22 PM</div>
                                        <span className="email-star marked">
                                            <span className="feather-icon">
                                                <Star />
                                            </span>
                                        </span>
                                        <Button as="a" href="#" size="sm" className="btn-icon btn-rounded flush-soft-hover btn-flush-dark">
                                            <span className="icon">
                                                <span className="feather-icon">
                                                    <CornerUpLeft />
                                                </span>
                                            </span>
                                        </Button>
                                        <Dropdown>
                                            <Dropdown.Toggle as="a" href="#" size="sm" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <MoreVertical />
                                                    </span></span>
                                            </Dropdown.Toggle>
                                            <Dropdown.Menu align="end">
                                                <Dropdown.Item>Forward</Dropdown.Item>
                                                <Dropdown.Item>Delete</Dropdown.Item>
                                                <Dropdown.Item>Report Spam</Dropdown.Item>
                                            </Dropdown.Menu>
                                        </Dropdown>
                                    </div>
                                </div>
                            </div>
                        </HkAccordion.Toggle>
                        <HkAccordion.Collapse eventKey="0">
                            <div className="accordion-body">
                                <p>Hi Hencework,</p>
                                <p>We&apos;d like to let you know that an update to your item Jampack - Admin Template by hencework is now available in your Downloads page.</p>
                                <p>Remember: you need to be logged in to download the update.</p>
                                <p className="mt-3 mb-4">You may manage notifications for your items from <a href="#some"><u>your downloads.</u></a></p>
                                <p>Regards,<br />Jampack Team</p>
                                <Image className="d-block mt-2 mb-3" src={sign} alt="signature" />
                                <div className="separator separator-light" />
                                <div className="text-end">
                                    <a href="#some" className="link-theme fs-7"><u>Download All</u></a>
                                </div>
                                <div className="email-attachment-wrap">
                                    <div className="attachment-box">
                                        <div>
                                            <div className="media">
                                                <div className="avatar avatar-icon avatar-sm avatar-blue">
                                                    <span className="initial-wrap fs-3">
                                                        <i className="ri-file-excel-2-fill" />
                                                    </span>
                                                </div>
                                                <div className="media-body">
                                                    <p className="file-name">Website_content.xls</p>
                                                    <p className="file-size">2,635 KB</p>
                                                </div>
                                            </div>
                                            <div className="file-overlay">
                                                <button className="btn btn-sm btn-icon btn-rounded btn-primary"><span className="icon">
                                                    <ArrowDown />
                                                </span></button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="attachment-box">
                                        <div>
                                            <div className="media">
                                                <div className="avatar avatar-icon avatar-sm avatar-warning">
                                                    <span className="initial-wrap fs-3">
                                                        <i className="ri-file-zip-fill" />
                                                    </span>
                                                </div>
                                                <div className="media-body">
                                                    <p className="file-name">jampack.zip</p>
                                                    <p className="file-size">2.45 GB</p>
                                                </div>
                                            </div>
                                            <div className="file-overlay">
                                                <button className="btn btn-sm btn-icon btn-rounded btn-primary"><span className="icon"><ArrowDown /></span></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </HkAccordion.Collapse>
                    </div>
                    <div className="accordion-item">
                        <HkAccordion.Toggle eventKey="simple-collapseTwo" className="accordion-header">
                            <div>
                                <div className="email-head">
                                    <div data-bs-toggle="collapse" data-bs-target="#simple-collapseTwo" role="button" aria-expanded="true" />
                                    <div className="media">
                                        <div className="media-head">
                                            <div className="avatar d-8">
                                                <Image src={avatar2} alt="user" className="avatar-img rounded-circle" />
                                            </div>
                                        </div>
                                        <div className="media-body">
                                            <div>Morgan Freeman</div>
                                            <div className="fs-7">
                                                <span>to</span>
                                                <Dropdown bsPrefix="mail-desc-dropdown">
                                                    <Dropdown.Toggle as="a" className="link-dark ms-1" href="#">me</Dropdown.Toggle>
                                                    <Dropdown.Menu>
                                                        <div>
                                                            <span>from :</span><span>Morgan <span>&lt;morganfreeman@jampack.com&gt;</span></span>
                                                        </div>
                                                        <div>
                                                            <span>to :</span><span>Hencework <span>&lt;contact@hencework.com&gt;</span></span>
                                                        </div>
                                                        <div>
                                                            <span>date :</span><span>Dec 30, 4:22 PM</span>
                                                        </div>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="email-head-action">
                                        <div className="email-time">Jan 1, 9:30 AM</div>
                                        <span className="email-star marked">
                                            <span className="feather-icon">
                                                <Star />
                                            </span>
                                        </span>
                                        <Button as="a" href="#" size="sm" className="btn-icon btn-rounded flush-soft-hover btn-flush-dark">
                                            <span className="icon">
                                                <span className="feather-icon">
                                                    <CornerUpLeft />
                                                </span>
                                            </span>
                                        </Button>
                                        <Dropdown>
                                            <Dropdown.Toggle as="a" href="#" size="sm" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <MoreVertical />
                                                    </span></span>
                                            </Dropdown.Toggle>
                                            <Dropdown.Menu align="end">
                                                <Dropdown.Item>Forward</Dropdown.Item>
                                                <Dropdown.Item>Delete</Dropdown.Item>
                                                <Dropdown.Item>Report Spam</Dropdown.Item>
                                            </Dropdown.Menu>
                                        </Dropdown>
                                    </div>
                                </div>
                            </div>
                        </HkAccordion.Toggle>
                        <HkAccordion.Collapse eventKey="simple-collapseTwo">
                            <div className="accordion-body">
                                <p>Hello I have purchased the admin template, Please help me to install and host it. I want the site to function properly. Remember: you need to be logged in to download the update.</p>
                                <p className="mb-4">Remember: you need to be logged in to download the update.</p>
                                <p>Regards,<br />Jampack Team</p>
                                <Image className="d-block mt-2 mb-3" src={sign} alt="signature" />
                            </div>
                        </HkAccordion.Collapse>
                    </div>
                    <div className="accordion-item">
                        <HkAccordion.Toggle eventKey="simple-collapseThree" className="accordion-header">
                            <div>
                                <div className="email-head">
                                    <div data-bs-toggle="collapse" data-bs-target="#simple-collapseThree" role="button" aria-expanded="true" />
                                    <div className="media">
                                        <div className="media-head">
                                            <div className="avatar d-8">
                                                <Image src={avatar10} alt="user" className="avatar-img rounded-circle" />
                                            </div>
                                        </div>
                                        <div className="media-body">
                                            <div>Admin</div>
                                            <div className="fs-7">
                                                <span>to</span>
                                                <Dropdown bsPrefix="mail-desc-dropdown">
                                                    <Dropdown.Toggle as="a" className="link-dark ms-1" href="#">Morgan</Dropdown.Toggle>
                                                    <Dropdown.Menu>
                                                        <div>
                                                            <span>from :</span><span>Admin <span>&lt;admin@jampack.com&gt;</span></span>
                                                        </div>
                                                        <div>
                                                            <span>to :</span><span>Morgan <span>&lt;morganfreeman@jampack.com&gt;</span></span>
                                                        </div>
                                                        <div>
                                                            <span>date :</span><span>Jan 2, 10:21 AM</span>
                                                        </div>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="email-head-action">
                                        <div className="email-time">Jan 2, 10:21 AM</div>
                                        <span className="email-star"><span className="feather-icon">
                                            <Star />
                                        </span></span>
                                        <Button as="a" href="#" size="sm" className="btn-icon btn-rounded flush-soft-hover btn-flush-dark">
                                            <span className="icon">
                                                <span className="feather-icon">
                                                    <CornerUpLeft />
                                                </span>
                                            </span>
                                        </Button>
                                        <Dropdown>
                                            <Dropdown.Toggle as="a" href="#" size="sm" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <MoreVertical />
                                                    </span></span>
                                            </Dropdown.Toggle>
                                            <Dropdown.Menu align="end">
                                                <Dropdown.Item>Forward</Dropdown.Item>
                                                <Dropdown.Item>Delete</Dropdown.Item>
                                                <Dropdown.Item>Report Spam</Dropdown.Item>
                                            </Dropdown.Menu>
                                        </Dropdown>
                                    </div>
                                </div>
                            </div>
                        </HkAccordion.Toggle>
                        <HkAccordion.Collapse eventKey="simple-collapseThree">
                            <div className="accordion-body">
                                <p>Hello,</p>
                                <p>Could you please specify the pages, where you are getting the error?</p>
                                <div className="my-5">
                                    <Button variant="outline-light" className="me-2" data-bs-toggle="collapse" data-bs-target="#compose_email" aria-expanded="false">
                                        <span>
                                            <span className="icon">
                                                <span className="feather-icon">
                                                    <CornerUpLeft />
                                                </span>
                                            </span>
                                            <span>Reply</span>
                                        </span>
                                    </Button>
                                    <Button variant="outline-light" data-bs-toggle="collapse" data-bs-target="#compose_email" aria-expanded="false">
                                        <span>
                                            <span className="icon">
                                                <span className="feather-icon">
                                                    <ArrowRight />
                                                </span>
                                            </span>
                                            <span>Forward</span>
                                        </span>
                                    </Button>
                                </div>
                                <div id="compose_email" className="collapse mt-7">
                                    <div className="d-flex">
                                        <div className="media">
                                            <div className="media-head me-3">
                                                <div className="avatar avatar-icon avatar-soft-light avatar-rounded d-8">
                                                    <span className="initial-wrap">
                                                        <i className="ri-user-fill" />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <Form as={Card} className="card-shadow w-100">
                                            <Card.Body>
                                                <Form.Group>
                                                    <div className="d-flex flex-wrap">
                                                        <HkChips className="mb-2 me-2" variant="primary" src={avatar11} dismissable >
                                                            Morgan
                                                        </HkChips>

                                                        <HkChips className="mb-2 me-2" variant="primary" src={avatar12} dismissable >
                                                            Charlie
                                                        </HkChips>

                                                        <HkChips className="mb-2 me-2" variant="primary" src={avatar13} dismissable >
                                                            Winston
                                                        </HkChips>

                                                        <Form.Control type="text" className="border-0 p-0 shadow-none flex-1 mb-2 me-2" placeholder="Add recipients" />
                                                    </div>
                                                </Form.Group>
                                                <Form.Group>
                                                    <Form.Control as="textarea" rows={8} placeholder="Enter details" className="mb-3" />
                                                </Form.Group>
                                                <Form.Group className="d-flex justify-content-between mb-0">
                                                    <div>
                                                        <Button variant="primary" className="me-2" type="submit">Send</Button>
                                                        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                                                            <HkTooltip id="addFlag" title="Add Flag" placement="top" >
                                                                <span className="icon">
                                                                    <span className="feather-icon">
                                                                        <Paperclip />
                                                                    </span>
                                                                </span>
                                                            </HkTooltip>
                                                        </Button>
                                                    </div>
                                                    <div>
                                                        <Button variant="flush-dark" className="btn-iconbtn-rounded flush-soft-hover">
                                                            <HkTooltip id="draft" title="Save Draft" placement="top">
                                                                <span className="icon">
                                                                    <span className="feather-icon">
                                                                        <Edit />
                                                                    </span>
                                                                </span>
                                                            </HkTooltip>
                                                        </Button>
                                                        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                                                            <HkTooltip id="delete" title="Delete" placement="top" >
                                                                <span className="icon">
                                                                    <span className="feather-icon">
                                                                        <Trash2 />
                                                                    </span>
                                                                </span>
                                                            </HkTooltip>
                                                        </Button>
                                                    </div>
                                                </Form.Group>
                                            </Card.Body>
                                        </Form>
                                    </div>
                                </div>
                            </div>
                        </HkAccordion.Collapse>
                    </div>
                </HkAccordion> */}
                <div id="accordionSimpleExample" className="accordion accordion-simple single-email-thread">
                    <div className="accordion-item">
                        <div id="simple-headingOne" className="accordion-header">
                            <div>
                                <div className="email-head">
                                    <div data-bs-toggle="collapse" data-bs-target="#simple-collapseOne" role="button" aria-expanded="false" />
                                    <div className="media">
                                        <div className="media-head">
                                            <div className="avatar d-8">
                                                <Image src={avatar2} alt="user" className="avatar-img rounded-circle" />
                                            </div>
                                        </div>
                                        <div className="media-body">
                                            <div>Morgan Freeman</div>
                                            <div className="fs-7">
                                                <span>to</span>
                                                <Dropdown bsPrefix="mail-desc-dropdown">
                                                    <Dropdown.Toggle as="a" className="link-dark ms-1" href="#">me</Dropdown.Toggle >
                                                    <Dropdown.Menu>
                                                        <div>
                                                            <span>from :</span><span>Morgan <span>&lt;morganfreeman@jampack.com&gt;</span></span>
                                                        </div>
                                                        <div>
                                                            <span>to :</span><span>Hencework <span>&lt;contact@hencework.com&gt;</span></span>
                                                        </div>
                                                        <div>
                                                            <span>date :</span><span>Dec 30, 4:22 PM</span>
                                                        </div>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="email-head-action">
                                        <div className="email-time">Dec 30, 4:22 PM</div>
                                        <span className="email-star marked">
                                            <span className="feather-icon">
                                                <Star />
                                            </span>
                                        </span>
                                        <Button as="a" href="#" size="sm" className="btn-icon btn-rounded flush-soft-hover btn-flush-dark">
                                            <span className="icon">
                                                <span className="feather-icon">
                                                    <CornerUpLeft />
                                                </span>
                                            </span>
                                        </Button>
                                        <Dropdown>
                                            <Dropdown.Toggle as="a" href="#" size="sm" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <MoreVertical />
                                                    </span></span>
                                            </Dropdown.Toggle>
                                            <Dropdown.Menu align="end">
                                                <Dropdown.Item>Forward</Dropdown.Item>
                                                <Dropdown.Item>Delete</Dropdown.Item>
                                                <Dropdown.Item>Report Spam</Dropdown.Item>
                                            </Dropdown.Menu>
                                        </Dropdown>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div id="simple-collapseOne" className="accordion-collapse collapse">
                            <div className="accordion-body">
                                <p>Hi Hencework,</p>
                                <p>We&apos;d like to let you know that an update to your item Jampack - Admin Template by hencework is now available in your Downloads page.</p>
                                <p>Remember: you need to be logged in to download the update.</p>
                                <p className="mt-3 mb-4">You may manage notifications for your items from <a href="#some"><u>your downloads.</u></a></p>
                                <p>Regards,<br />Jampack Team</p>
                                <Image className="d-block mt-2 mb-3" src={sign} alt="signature" />
                                <div className="separator separator-light" />
                                <div className="text-end">
                                    <a href="#some" className="link-theme fs-7"><u>Download All</u></a>
                                </div>
                                <div className="email-attachment-wrap">
                                    <div className="attachment-box">
                                        <div>
                                            <div className="media">
                                                <div className="avatar avatar-icon avatar-sm avatar-blue">
                                                    <span className="initial-wrap fs-3">
                                                        <i className="ri-file-excel-2-fill" />
                                                    </span>
                                                </div>
                                                <div className="media-body">
                                                    <p className="file-name">Website_content.xls</p>
                                                    <p className="file-size">2,635 KB</p>
                                                </div>
                                            </div>
                                            <div className="file-overlay">
                                                <button className="btn btn-sm btn-icon btn-rounded btn-primary"><span className="icon">
                                                    <ArrowDown />
                                                </span></button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="attachment-box">
                                        <div>
                                            <div className="media">
                                                <div className="avatar avatar-icon avatar-sm avatar-warning">
                                                    <span className="initial-wrap fs-3">
                                                        <i className="ri-file-zip-fill" />
                                                    </span>
                                                </div>
                                                <div className="media-body">
                                                    <p className="file-name">jampack.zip</p>
                                                    <p className="file-size">2.45 GB</p>
                                                </div>
                                            </div>
                                            <div className="file-overlay">
                                                <button className="btn btn-sm btn-icon btn-rounded btn-primary"><span className="icon"><ArrowDown /></span></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <div id="simple-headingTwo" className="accordion-header">
                            <div>
                                <div className="email-head">
                                    <div data-bs-toggle="collapse" data-bs-target="#simple-collapseTwo" role="button" aria-expanded="true" />
                                    <div className="media">
                                        <div className="media-head">
                                            <div className="avatar d-8">
                                                <Image src={avatar2} alt="user" className="avatar-img rounded-circle" />
                                            </div>
                                        </div>
                                        <div className="media-body">
                                            <div>Morgan Freeman</div>
                                            <div className="fs-7">
                                                <span>to</span>
                                                <Dropdown bsPrefix="mail-desc-dropdown">
                                                    <Dropdown.Toggle as="a" className="link-dark ms-1" href="#">me</Dropdown.Toggle>
                                                    <Dropdown.Menu>
                                                        <div>
                                                            <span>from :</span><span>Morgan <span>&lt;morganfreeman@jampack.com&gt;</span></span>
                                                        </div>
                                                        <div>
                                                            <span>to :</span><span>Hencework <span>&lt;contact@hencework.com&gt;</span></span>
                                                        </div>
                                                        <div>
                                                            <span>date :</span><span>Dec 30, 4:22 PM</span>
                                                        </div>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="email-head-action">
                                        <div className="email-time">Jan 1, 9:30 AM</div>
                                        <span className="email-star marked">
                                            <span className="feather-icon">
                                                <Star />
                                            </span>
                                        </span>
                                        <Button as="a" href="#" size="sm" className="btn-icon btn-rounded flush-soft-hover btn-flush-dark">
                                            <span className="icon">
                                                <span className="feather-icon">
                                                    <CornerUpLeft />
                                                </span>
                                            </span>
                                        </Button>
                                        <Dropdown>
                                            <Dropdown.Toggle as="a" href="#" size="sm" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <MoreVertical />
                                                    </span></span>
                                            </Dropdown.Toggle>
                                            <Dropdown.Menu align="end">
                                                <Dropdown.Item>Forward</Dropdown.Item>
                                                <Dropdown.Item>Delete</Dropdown.Item>
                                                <Dropdown.Item>Report Spam</Dropdown.Item>
                                            </Dropdown.Menu>
                                        </Dropdown>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div id="simple-collapseTwo" className="collapse show">
                            <div className="accordion-body">
                                <p>Hello I have purchased the admin template, Please help me to install and host it. I want the site to function properly. Remember: you need to be logged in to download the update.</p>
                                <p className="mb-4">Remember: you need to be logged in to download the update.</p>
                                <p>Regards,<br />Jampack Team</p>
                                <Image className="d-block mt-2 mb-3" src={sign} alt="signature" />
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <div id="simple-headingThree" className="accordion-header">
                            <div>
                                <div className="email-head">
                                    <div data-bs-toggle="collapse" data-bs-target="#simple-collapseThree" role="button" aria-expanded="true" />
                                    <div className="media">
                                        <div className="media-head">
                                            <div className="avatar d-8">
                                                <Image src={avatar10} alt="user" className="avatar-img rounded-circle" />
                                            </div>
                                        </div>
                                        <div className="media-body">
                                            <div>Admin</div>
                                            <div className="fs-7">
                                                <span>to</span>
                                                <Dropdown bsPrefix="mail-desc-dropdown">
                                                    <Dropdown.Toggle as="a" className="link-dark ms-1" href="#">Morgan</Dropdown.Toggle>
                                                    <Dropdown.Menu>
                                                        <div>
                                                            <span>from :</span><span>Admin <span>&lt;admin@jampack.com&gt;</span></span>
                                                        </div>
                                                        <div>
                                                            <span>to :</span><span>Morgan <span>&lt;morganfreeman@jampack.com&gt;</span></span>
                                                        </div>
                                                        <div>
                                                            <span>date :</span><span>Jan 2, 10:21 AM</span>
                                                        </div>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="email-head-action">
                                        <div className="email-time">Jan 2, 10:21 AM</div>
                                        <span className="email-star"><span className="feather-icon">
                                            <Star />
                                        </span></span>
                                        <Button as="a" href="#" size="sm" className="btn-icon btn-rounded flush-soft-hover btn-flush-dark">
                                            <span className="icon">
                                                <span className="feather-icon">
                                                    <CornerUpLeft />
                                                </span>
                                            </span>
                                        </Button>
                                        <Dropdown>
                                            <Dropdown.Toggle as="a" href="#" size="sm" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <MoreVertical />
                                                    </span></span>
                                            </Dropdown.Toggle>
                                            <Dropdown.Menu align="end">
                                                <Dropdown.Item>Forward</Dropdown.Item>
                                                <Dropdown.Item>Delete</Dropdown.Item>
                                                <Dropdown.Item>Report Spam</Dropdown.Item>
                                            </Dropdown.Menu>
                                        </Dropdown>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div id="simple-collapseThree" className="collapse show">
                            <div className="accordion-body">
                                <p>Hello,</p>
                                <p>Could you please specify the pages, where you are getting the error?</p>
                                <div className="my-5">
                                    <Button variant="outline-light" className="me-2" data-bs-toggle="collapse" data-bs-target="#compose_email" aria-expanded="false">
                                        <span>
                                            <span className="icon">
                                                <span className="feather-icon">
                                                    <CornerUpLeft />
                                                </span>
                                            </span>
                                            <span>Reply</span>
                                        </span>
                                    </Button>
                                    <Button variant="outline-light" data-bs-toggle="collapse" data-bs-target="#compose_email" aria-expanded="false">
                                        <span>
                                            <span className="icon">
                                                <span className="feather-icon">
                                                    <ArrowRight />
                                                </span>
                                            </span>
                                            <span>Forward</span>
                                        </span>
                                    </Button>
                                </div>
                                <div id="compose_email" className="collapse mt-7">
                                    <div className="d-flex">
                                        <div className="media">
                                            <div className="media-head me-3">
                                                <div className="avatar avatar-icon avatar-soft-light avatar-rounded d-8">
                                                    <span className="initial-wrap">
                                                        <i className="ri-user-fill" />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <Form as={Card} className="card-shadow w-100">
                                            <Card.Body>
                                                <Form.Group>
                                                    <div className="d-flex flex-wrap">
                                                        <HkChips className="mb-2 me-2" variant="primary" src={avatar11} dismissable >
                                                            Morgan
                                                        </HkChips>

                                                        <HkChips className="mb-2 me-2" variant="primary" src={avatar12} dismissable >
                                                            Charlie
                                                        </HkChips>

                                                        <HkChips className="mb-2 me-2" variant="primary" src={avatar13} dismissable >
                                                            Winston
                                                        </HkChips>

                                                        <Form.Control type="text" className="border-0 p-0 shadow-none flex-1 mb-2 me-2" placeholder="Add recipients" />
                                                    </div>
                                                </Form.Group>
                                                <Form.Group>
                                                    <Form.Control as="textarea" rows={8} placeholder="Enter details" className="mb-3" />
                                                </Form.Group>
                                                <Form.Group className="d-flex justify-content-between mb-0">
                                                    <div>
                                                        <Button variant="primary" className="me-2" type="submit">Send</Button>
                                                        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                                                            <HkTooltip id="addFlag" title="Add Flag" placement="top" >
                                                                <span className="icon">
                                                                    <span className="feather-icon">
                                                                        <Paperclip />
                                                                    </span>
                                                                </span>
                                                            </HkTooltip>
                                                        </Button>
                                                    </div>
                                                    <div>
                                                        <Button variant="flush-dark" className="btn-iconbtn-rounded flush-soft-hover">
                                                            <HkTooltip id="draft" title="Save Draft" placement="top">
                                                                <span className="icon">
                                                                    <span className="feather-icon">
                                                                        <Edit />
                                                                    </span>
                                                                </span>
                                                            </HkTooltip>
                                                        </Button>
                                                        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                                                            <HkTooltip id="delete" title="Delete" placement="top" >
                                                                <span className="icon">
                                                                    <span className="feather-icon">
                                                                        <Trash2 />
                                                                    </span>
                                                                </span>
                                                            </HkTooltip>
                                                        </Button>
                                                    </div>
                                                </Form.Group>
                                            </Card.Body>
                                        </Form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </SimpleBar >
        </div >
    )
}

export default EmailBody
