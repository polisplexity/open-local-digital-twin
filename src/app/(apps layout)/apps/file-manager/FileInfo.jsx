import Image from 'next/image';
import Link from 'next/link';
import { Button, Card, ListGroup, Nav, Tab } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';
import { Plus } from 'react-feather';
import HkBadge from '@/components/@hk-badge/@hk-badge';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';

//Images
import avatar9 from '@/assets/img/avatar9.jpg';
import avatar10 from '@/assets/img/avatar10.jpg';
import avatar12 from '@/assets/img/avatar12.jpg';
import avatar15 from '@/assets/img/avatar15.jpg';
import mock2 from '@/assets/img/gallery/mock2.jpg';

const FileInfo = ({ onHide }) => {
    return (
        <div className="file-info">
            <SimpleBar className="nicescroll-bar">
                <Button bsPrefix="btn-close" className="info-close" onClick={onHide}>
                    <span aria-hidden="true">×</span>
                </Button>
                <div className="file-name">bruce-mars-fiEG-PkjG</div>
                <span>JPG File</span>
                <Image src={mock2} alt="user" className="d-block img-fluid my-4 w-250p" />
                <Tab.Container defaultActiveKey="tabInfo" >
                    <Nav as="ul" justify variant="tabs" className="nav-light nav-segmented-tabs active-theme mt-5">
                        <Nav.Item>
                            <Nav.Link eventKey="tabInfo">
                                <span className="nav-link-text">Details</span>
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="tabActivity">
                                <span className="nav-link-text">Activity</span>
                            </Nav.Link>
                        </Nav.Item>
                    </Nav>
                    <Tab.Content className="mt-5">
                        <Tab.Pane eventKey="tabInfo" >
                            <div className="collapse-simple">
                                <Card>
                                    <Card.Header>
                                        <a href="#fl_info" role="button" data-bs-toggle="collapse" aria-expanded="true">Specification</a>
                                    </Card.Header>
                                    <div id="fl_info" className="collapse show">
                                        <Card.Body>
                                            <ul className="fm-info">
                                                <li>
                                                    <span>Date Modified</span>
                                                    <span>20, Nov 2020</span>
                                                </li>
                                                <li>
                                                    <span>Size</span>
                                                    <span>15.2 GB</span>
                                                </li>
                                                <li>
                                                    <span>Created by</span>
                                                    <span>Morgan Freeman</span>
                                                </li>
                                                <li>
                                                    <span>Date Created</span>
                                                    <span>12, Nov 2020</span>
                                                </li>
                                                <li>
                                                    <span>Dimension</span>
                                                    <span>1950 x 1245</span>
                                                </li>
                                            </ul>
                                        </Card.Body>
                                    </div>
                                </Card>
                                <Card>
                                    <Card.Header>
                                        <Link role="button" data-bs-toggle="collapse" href="#shared_with" aria-expanded="true">Shared with </Link>
                                    </Card.Header>
                                    <div id="shared_with" className="collapse show">
                                        <Card.Body>
                                            <ul className="hk-list">
                                                <li>
                                                    <HkTooltip placement="top" title="Katherine" >
                                                        <div className="avatar avatar-sm avatar-primary position-relative avatar-rounded">
                                                            <Image src={avatar9} alt="user" className="avatar-img" />
                                                            <HkBadge bg="transparent" className="badge-icon badge-circle text-blue badge-icon-xxs position-bottom-end-overflow-1"  >
                                                                <div className="badge-icon-wrap">
                                                                    <i className="ri-upload-2-fill" />
                                                                </div>
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 127 127">
                                                                    <g data-name="Ellipse 302" transform="translate(8 8)" strokeWidth={3}>
                                                                        <circle cx="55.5" cy="55.5" r="55.5" stroke="currentColor" />
                                                                        <circle cx="55.5" cy="55.5" r="59.5" fill="currentColor" />
                                                                    </g>
                                                                </svg>
                                                            </HkBadge>
                                                        </div>
                                                    </HkTooltip>
                                                </li>
                                                <li>
                                                    <HkTooltip placement="top" title="Dean" >
                                                        <div className="avatar avatar-sm  avatar-rounded">
                                                            <Image src={avatar10} alt="user" className="avatar-img" />
                                                        </div>
                                                    </HkTooltip>
                                                </li>
                                                <li>
                                                    <HkTooltip placement="top" title="Winston" >
                                                        <div className="avatar avatar-sm avatar-soft-danger avatar-rounded">
                                                            <span className="initial-wrap">W</span>
                                                        </div>
                                                    </HkTooltip>
                                                </li>
                                                <li>
                                                    <a href='#som' className="avatar avatar-sm avatar-icon avatar-soft-light avatar-rounded" data-bs-toggle="modal" data-bs-target="#invite_people">
                                                        <HkTooltip placement="top" title="Add New" >
                                                            <span className="initial-wrap">
                                                                <span className="feather-icon">
                                                                    <Plus />
                                                                </span>
                                                            </span>
                                                        </HkTooltip>
                                                    </a>
                                                </li>
                                            </ul>
                                        </Card.Body>
                                    </div>
                                </Card>
                                <Card>
                                    <Card.Header>
                                        <Link role="button" data-bs-toggle="collapse" href="#settings" aria-expanded="true">Settings </Link>
                                    </Card.Header>
                                    <div id="settings" className="collapse show">
                                        <Card.Body>
                                            <ul className="fm-action">
                                                <li>
                                                    <a href="#">
                                                        <span className="text-danger">Delete File</span>
                                                    </a>
                                                </li>
                                                <li>
                                                    <a href="#">
                                                        Somthing&apos;s Wrong
                                                    </a>
                                                </li>
                                            </ul>
                                            <a href="#" className="d-block text-dark fs-7 mb-2">Give feedback and report conversation</a>
                                        </Card.Body>
                                    </div>
                                </Card>
                            </div>
                        </Tab.Pane>
                        <Tab.Pane eventKey="tabActivity">
                            <div className="collapse-simple">
                                <Card>
                                    <Card.Header>
                                        <a href="#act_info1" role="button" data-bs-toggle="collapse" aria-expanded="true">Yesterday</a>
                                    </Card.Header>
                                    <div id="act_info1" className="collapse show">
                                        <Card.Body>
                                            <ListGroup variant="flush" className="activity-list">
                                                <ListGroup.Item>
                                                    <div className="media">
                                                        <div className="media-head">
                                                            <div className="avatar avatar-sm avatar-primary avatar-rounded">
                                                                <span className="initial-wrap">H</span>
                                                            </div>
                                                        </div>
                                                        <div className="media-body">
                                                            <p>
                                                                <span className="text-dark">Hencework</span> is working on <a href="#" className="link-url"><u>https://assets.adobe.com/id/urn:aaid:sc:AP:5cebaf53-ca19-420a-aeeb-1517b04ab8c0?view=file</u></a>
                                                            </p>
                                                            <div className="last-activity-time">3:15 PM</div>
                                                        </div>
                                                    </div>
                                                </ListGroup.Item>
                                                <ListGroup.Item>
                                                    <div className="media">
                                                        <div className="media-head">
                                                            <div className="media-head">
                                                                <div className="avatar avatar-sm avatar-soft-danger avatar-rounded">
                                                                    <span className="initial-wrap">W</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="media-body">
                                                            <p><span className="text-dark">Morgan Fregman</span> completed react conversion of <a href="#" className="link-default"><u>components</u></a></p>
                                                            <div className="last-activity-time">3:15 PM</div>
                                                        </div>
                                                    </div>
                                                </ListGroup.Item>
                                            </ListGroup>
                                        </Card.Body>
                                    </div>
                                </Card>
                                <Card>
                                    <Card.Header>
                                        <Link role="button" data-bs-toggle="collapse" href="#act_info2" aria-expanded="true">23 April</Link>
                                    </Card.Header>
                                    <div id="act_info2" className="collapse show">
                                        <Card.Body>
                                            <ListGroup variant="flush" className="activity-list">
                                                <ListGroup.Item>
                                                    <div className="media">
                                                        <div className="media-head">
                                                            <div className="avatar avatar-sm avatar-rounded">
                                                                <Image src={avatar15} alt="user" className="avatar-img" />
                                                            </div>
                                                        </div>
                                                        <div className="media-body">
                                                            <p><span className="text-dark">Hencework</span> is working on <a href="#" className="link-url"><u>https://assets.adobe.com/id/urn:aaid:sc:AP:5cebaf53-ca19-420a-aeeb-1517b04ab8c0?view=file</u></a></p>
                                                            <div className="last-activity-time">3:15 PM</div>
                                                        </div>
                                                    </div>
                                                </ListGroup.Item>
                                                <ListGroup.Item>
                                                    <div className="media">
                                                        <div className="media-head">
                                                            <div className="avatar avatar-sm avatar-rounded">
                                                                <Image src={avatar12} alt="user" className="avatar-img" />
                                                            </div>
                                                        </div>
                                                        <div className="media-body">
                                                            <p><span className="text-dark">Morgan Fregman</span> completed react conversion of <a href="#" className="link-default"><u>components</u></a></p>
                                                            <div className="last-activity-time">3:15 PM</div>
                                                        </div>
                                                    </div>
                                                </ListGroup.Item>
                                            </ListGroup>
                                        </Card.Body>
                                    </div>
                                </Card>
                            </div>
                        </Tab.Pane>
                    </Tab.Content>
                </Tab.Container>
            </SimpleBar>
        </div>
    )
}

export default FileInfo
