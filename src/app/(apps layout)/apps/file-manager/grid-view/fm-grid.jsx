import Image from 'next/image';
import { Button, Card, Col, Dropdown, Row } from 'react-bootstrap';
import { Copy, Download, Eye, Info, Link2, MoreHorizontal, SkipForward, Star, Trash2, UserPlus } from 'react-feather';
import SimpleBar from 'simplebar-react';
import HkAlert from '@/components/@hk-alert/@hk-alert';
import HkCollapse from '@/components/@hk-collapse/@hk-collapse';

//Images
import mock7 from '@/assets/img/gallery/mock7.jpg';
import mock5 from '@/assets/img/gallery/mock5.jpg';

const FmGrid = ({ fileInfo }) => {
    return (
        <div className="fm-body">
            <SimpleBar className="nicescroll-bar">
                <div className="file-card-view">
                    <HkAlert variant="warning" className="alert-wth-icon" dismissible >
                        <span className="alert-icon-wrap"><i className="ri-alert-line" /></span>
                        <div className="d-flex align-items-center flex-wrap flex-sm-nowrap">
                            You must provide value for account name.
                            <Button size="sm" variant="warning" className="ms-sm-auto mt-sm-0 mt-2 flex-shrink-0">Upgrade Storage</Button>
                        </div>
                    </HkAlert>
                    <div className="collapse-simple mt-4">
                        <HkCollapse
                            bsPrefix="a"
                            href="#"
                            targetId="fm_collapse_1"
                            title={<><h5 className="mb-0">Quick Access</h5></>}
                            collapsed={false}
                        >
                            <Row className="gx-3 row-cols-xxl-6 row-cols-xl-4 row-cols-lg-3 row-cols-md-2 row-cols-1 mt-3">
                                <Col>
                                    <Card className="file-card card-border">
                                        <Card.Body className="fmapp-info-trigger" onClick={fileInfo}>
                                            <i className="ri-file-excel-2-fill text-blue" />
                                        </Card.Body>
                                        <Card.Footer>
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <div className="file-name">Website_content.exl</div>
                                                    <div className="text-truncate fs-8 mb-2">2,637 KB</div>
                                                </div>
                                                <div className="d-flex">
                                                    <span className="file-star marked">
                                                        <span className="feather-icon">
                                                            <Star />
                                                        </span>
                                                    </span>
                                                    <Dropdown>
                                                        <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                            <span className="icon">
                                                                <span className="feather-icon">
                                                                    <MoreHorizontal />
                                                                </span>
                                                            </span>
                                                        </Dropdown.Toggle>

                                                        <Dropdown.Menu>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Eye />
                                                                </span>
                                                                <span>Preview</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Copy />
                                                                </span>
                                                                <span>Duplicate</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <SkipForward />
                                                                </span>
                                                                <span>Move</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <UserPlus />
                                                                </span>
                                                                <span>Invite</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Link2 />
                                                                </span>
                                                                <span>Share Link</span>
                                                            </Dropdown.Item>
                                                            <div className="dropdown-divider" />
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Info />
                                                                </span>
                                                                <span>View Details</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Download />
                                                                </span>
                                                                <span>Download</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Trash2 />
                                                                </span>
                                                                <span>Delete</span>
                                                            </Dropdown.Item>
                                                        </Dropdown.Menu>
                                                    </Dropdown>
                                                </div>
                                            </div>
                                            <p className="text-truncate p-xs">Last Access: 2 hours ago</p>
                                        </Card.Footer>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="file-card card-border">
                                        <Card.Body className="fmapp-info-trigger" onClick={fileInfo}>
                                            <i className="ri-file-pdf-fill text-danger" />
                                        </Card.Body>
                                        <Card.Footer>
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <div className="file-name">Website_content.exl</div>
                                                    <div className="text-truncate fs-8 mb-2">21.73 MB</div>
                                                </div>
                                                <div className="d-flex">
                                                    <span className="file-star">
                                                        <span className="feather-icon">
                                                            <Star />
                                                        </span>
                                                    </span>
                                                    <Dropdown>
                                                        <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                            <span className="icon">
                                                                <span className="feather-icon">
                                                                    <MoreHorizontal />
                                                                </span>
                                                            </span>
                                                        </Dropdown.Toggle>

                                                        <Dropdown.Menu>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Eye />
                                                                </span>
                                                                <span>Preview</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Copy />
                                                                </span>
                                                                <span>Duplicate</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <SkipForward />
                                                                </span>
                                                                <span>Move</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <UserPlus />
                                                                </span>
                                                                <span>Invite</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Link2 />
                                                                </span>
                                                                <span>Share Link</span>
                                                            </Dropdown.Item>
                                                            <div className="dropdown-divider" />
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Info />
                                                                </span>
                                                                <span>View Details</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Download />
                                                                </span>
                                                                <span>Download</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Trash2 />
                                                                </span>
                                                                <span>Delete</span>
                                                            </Dropdown.Item>
                                                        </Dropdown.Menu>
                                                    </Dropdown>
                                                </div>
                                            </div>
                                            <p className="text-truncate p-xs">Last Access: 2 hours ago	</p>
                                        </Card.Footer>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="file-card card-border">
                                        <Card.Body className="fmapp-info-trigger" onClick={fileInfo}>
                                            <i className="ri-file-word-2-fill text-blue" />
                                        </Card.Body>
                                        <Card.Footer>
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <div className="file-name">jampack.doc</div>
                                                    <div className="text-truncate fs-8 mb-2">951 KB</div>
                                                </div>
                                                <div className="d-flex">
                                                    <span className="file-star">
                                                        <span className="feather-icon">
                                                            <Star />
                                                        </span>
                                                    </span>
                                                    <Dropdown>
                                                        <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                            <span className="icon">
                                                                <span className="feather-icon">
                                                                    <MoreHorizontal />
                                                                </span>
                                                            </span>
                                                        </Dropdown.Toggle>

                                                        <Dropdown.Menu>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Eye />
                                                                </span>
                                                                <span>Preview</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Copy />
                                                                </span>
                                                                <span>Duplicate</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <SkipForward />
                                                                </span>
                                                                <span>Move</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <UserPlus />
                                                                </span>
                                                                <span>Invite</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Link2 />
                                                                </span>
                                                                <span>Share Link</span>
                                                            </Dropdown.Item>
                                                            <div className="dropdown-divider" />
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Info />
                                                                </span>
                                                                <span>View Details</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Download />
                                                                </span>
                                                                <span>Download</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Trash2 />
                                                                </span>
                                                                <span>Delete</span>
                                                            </Dropdown.Item>
                                                        </Dropdown.Menu>
                                                    </Dropdown>
                                                </div>
                                            </div>
                                            <p className="text-truncate p-xs">Last Access: 2 hours ago</p>
                                        </Card.Footer>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="file-card card-border">
                                        <Card.Body className=" fmapp-info-trigger" onClick={fileInfo}>
                                            <i className="ri-folder-2-fill text-warning" />
                                        </Card.Body>
                                        <Card.Footer>
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <div className="file-name">Jampack - html - v1.0</div>
                                                    <div className="text-truncate fs-8 mb-2">1.6 GB</div>
                                                </div>
                                                <div className="d-flex">
                                                    <span className="file-star">
                                                        <span className="feather-icon">
                                                            <Star />
                                                        </span>
                                                    </span>
                                                    <Dropdown>
                                                        <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                            <span className="icon">
                                                                <span className="feather-icon">
                                                                    <MoreHorizontal />
                                                                </span>
                                                            </span>
                                                        </Dropdown.Toggle>

                                                        <Dropdown.Menu>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Eye />
                                                                </span>
                                                                <span>Preview</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Copy />
                                                                </span>
                                                                <span>Duplicate</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <SkipForward />
                                                                </span>
                                                                <span>Move</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <UserPlus />
                                                                </span>
                                                                <span>Invite</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Link2 />
                                                                </span>
                                                                <span>Share Link</span>
                                                            </Dropdown.Item>
                                                            <div className="dropdown-divider" />
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Info />
                                                                </span>
                                                                <span>View Details</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Download />
                                                                </span>
                                                                <span>Download</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Trash2 />
                                                                </span>
                                                                <span>Delete</span>
                                                            </Dropdown.Item>
                                                        </Dropdown.Menu>
                                                    </Dropdown>
                                                </div>
                                            </div>
                                            <p className="text-truncate p-xs">Last Access: 2 hours ago</p>
                                        </Card.Footer>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="file-card card-border">
                                        <Card.Body className=" fmapp-info-trigger" onClick={fileInfo}>
                                            <i className="ri-folder-2-fill text-warning" />
                                        </Card.Body>
                                        <Card.Footer>
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <div className="file-name">Jampack - Angular</div>
                                                    <div className="text-truncate fs-8 mb-2">2,637 KB</div>
                                                </div>
                                                <div className="d-flex">
                                                    <span className="file-star">
                                                        <span className="feather-icon">
                                                            <Star />
                                                        </span>
                                                    </span>
                                                    <Dropdown>
                                                        <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                            <span className="icon">
                                                                <span className="feather-icon">
                                                                    <MoreHorizontal />
                                                                </span>
                                                            </span>
                                                        </Dropdown.Toggle>

                                                        <Dropdown.Menu>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Eye />
                                                                </span>
                                                                <span>Preview</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Copy />
                                                                </span>
                                                                <span>Duplicate</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <SkipForward />
                                                                </span>
                                                                <span>Move</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <UserPlus />
                                                                </span>
                                                                <span>Invite</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Link2 />
                                                                </span>
                                                                <span>Share Link</span>
                                                            </Dropdown.Item>
                                                            <div className="dropdown-divider" />
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Info />
                                                                </span>
                                                                <span>View Details</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Download />
                                                                </span>
                                                                <span>Download</span>
                                                            </Dropdown.Item>
                                                            <Dropdown.Item>
                                                                <span className="feather-icon dropdown-icon">
                                                                    <Trash2 />
                                                                </span>
                                                                <span>Delete</span>
                                                            </Dropdown.Item>
                                                        </Dropdown.Menu>
                                                    </Dropdown>
                                                </div>
                                            </div>
                                            <p className="text-truncate p-xs">Last Access: 2 hours ago</p>
                                        </Card.Footer>
                                    </Card>
                                </Col>
                            </Row>
                        </HkCollapse>
                    </div>
                    <div className="collapse-simple mt-4">
                        <HkCollapse
                            bsPrefix="a"
                            href="#"
                            targetId="fm_collapse_2"
                            title={<><h5 className="mb-0">Folders</h5></>}
                            collapsed={false}
                        >
                            <Row className="gx-3 row-cols-xxl-5 row-cols-xl-4 row-cols-lg-3 row-cols-md-2 row-cols-1 mt-4">
                                <Col>
                                    <Card className="file-compact-card card-border">
                                        <Card.Body className=" d-flex justify-content-between">
                                            <div className="media fmapp-info-trigger" onClick={fileInfo}>
                                                <div className="media-head me-3">
                                                    <div className="avatar avatar-icon avatar-sm avatar-soft-warning">
                                                        <span className="initial-wrap"><i className="ri-folder-2-fill" /></span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div className="file-name">Jampack - HTML - v1.0</div>
                                                    <div className="text-truncate fs-8 mb-2">1.6 GB</div>
                                                </div>
                                            </div>
                                            <div className="d-flex">
                                                <span className="file-star marked">
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                <Dropdown>
                                                    <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                        <span className="icon">
                                                            <span className="feather-icon">
                                                                <MoreHorizontal />
                                                            </span>
                                                        </span>
                                                    </Dropdown.Toggle>

                                                    <Dropdown.Menu>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Eye />
                                                            </span>
                                                            <span>Preview</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Copy />
                                                            </span>
                                                            <span>Duplicate</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <SkipForward />
                                                            </span>
                                                            <span>Move</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <UserPlus />
                                                            </span>
                                                            <span>Invite</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Link2 />
                                                            </span>
                                                            <span>Share Link</span>
                                                        </Dropdown.Item>
                                                        <div className="dropdown-divider" />
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Info />
                                                            </span>
                                                            <span>View Details</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Download />
                                                            </span>
                                                            <span>Download</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Trash2 />
                                                            </span>
                                                            <span>Delete</span>
                                                        </Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="file-compact-card card-border">
                                        <Card.Body className=" d-flex justify-content-between">
                                            <div className="media fmapp-info-trigger" onClick={fileInfo}>
                                                <div className="media-head me-3">
                                                    <div className="avatar avatar-icon avatar-sm avatar-soft-warning">
                                                        <span className="initial-wrap"><i className="ri-folder-2-fill" /></span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div className="file-name">Jampack - Angular</div>
                                                    <div className="text-truncate fs-8 mb-2">2,635 KB</div>
                                                </div>
                                            </div>
                                            <div className="d-flex">
                                                <span className="file-star marked">
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                <Dropdown>
                                                    <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                        <span className="icon">
                                                            <span className="feather-icon">
                                                                <MoreHorizontal />
                                                            </span>
                                                        </span>
                                                    </Dropdown.Toggle>

                                                    <Dropdown.Menu>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Eye />
                                                            </span>
                                                            <span>Preview</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Copy />
                                                            </span>
                                                            <span>Duplicate</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <SkipForward />
                                                            </span>
                                                            <span>Move</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <UserPlus />
                                                            </span>
                                                            <span>Invite</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Link2 />
                                                            </span>
                                                            <span>Share Link</span>
                                                        </Dropdown.Item>
                                                        <div className="dropdown-divider" />
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Info />
                                                            </span>
                                                            <span>View Details</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Download />
                                                            </span>
                                                            <span>Download</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Trash2 />
                                                            </span>
                                                            <span>Delete</span>
                                                        </Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="file-compact-card card-border">
                                        <Card.Body className=" d-flex justify-content-between">
                                            <div className="media fmapp-info-trigger" onClick={fileInfo}>
                                                <div className="media-head me-3">
                                                    <div className="avatar avatar-icon avatar-sm avatar-soft-warning">
                                                        <span className="initial-wrap"><i className="ri-folder-2-fill" /></span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div className="file-name">Designs</div>
                                                    <div className="text-truncate fs-8 mb-2">1.48 GB</div>
                                                </div>
                                            </div>
                                            <div className="d-flex">
                                                <span className="file-star">
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                <Dropdown>
                                                    <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                        <span className="icon">
                                                            <span className="feather-icon">
                                                                <MoreHorizontal />
                                                            </span>
                                                        </span>
                                                    </Dropdown.Toggle>

                                                    <Dropdown.Menu>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Eye />
                                                            </span>
                                                            <span>Preview</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Copy />
                                                            </span>
                                                            <span>Duplicate</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <SkipForward />
                                                            </span>
                                                            <span>Move</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <UserPlus />
                                                            </span>
                                                            <span>Invite</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Link2 />
                                                            </span>
                                                            <span>Share Link</span>
                                                        </Dropdown.Item>
                                                        <div className="dropdown-divider" />
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Info />
                                                            </span>
                                                            <span>View Details</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Download />
                                                            </span>
                                                            <span>Download</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Trash2 />
                                                            </span>
                                                            <span>Delete</span>
                                                        </Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="file-compact-card card-border">
                                        <Card.Body className=" d-flex justify-content-between">
                                            <div className="media fmapp-info-trigger" onClick={fileInfo}>
                                                <div className="media-head me-3">
                                                    <div className="avatar avatar-icon avatar-sm avatar-soft-warning">
                                                        <span className="initial-wrap"><i className="ri-folder-2-fill" /></span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div className="file-name">Inspiration</div>
                                                    <div className="text-truncate fs-8 mb-2">3.5 GB</div>
                                                </div>
                                            </div>
                                            <div className="d-flex">
                                                <span className="file-star">
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                <Dropdown>
                                                    <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                        <span className="icon">
                                                            <span className="feather-icon">
                                                                <MoreHorizontal />
                                                            </span>
                                                        </span>
                                                    </Dropdown.Toggle>

                                                    <Dropdown.Menu>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Eye />
                                                            </span>
                                                            <span>Preview</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Copy />
                                                            </span>
                                                            <span>Duplicate</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <SkipForward />
                                                            </span>
                                                            <span>Move</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <UserPlus />
                                                            </span>
                                                            <span>Invite</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Link2 />
                                                            </span>
                                                            <span>Share Link</span>
                                                        </Dropdown.Item>
                                                        <div className="dropdown-divider" />
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Info />
                                                            </span>
                                                            <span>View Details</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Download />
                                                            </span>
                                                            <span>Download</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Trash2 />
                                                            </span>
                                                            <span>Delete</span>
                                                        </Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>
                        </HkCollapse>
                    </div>
                    <div className="collapse-simple mt-4">
                        <HkCollapse
                            bsPrefix="a"
                            href="#"
                            targetId="fm_collapse_3"
                            title={<><h5 className="mb-0">Files</h5></>}
                            collapsed={false}
                        >
                            <Row className="gx-3 row-cols-xxl-5 row-cols-xl-4 row-cols-lg-3 row-cols-md-2 row-cols-1 mt-4">
                                <Col>
                                    <Card className="file-compact-card card-border">
                                        <Card.Body className=" d-flex justify-content-between">
                                            <div className="media fmapp-info-trigger" onClick={fileInfo}>
                                                <div className="media-head me-3">
                                                    <div className="avatar avatar-icon avatar-soft-blue avatar-sm">
                                                        <span className="initial-wrap">
                                                            <i className="ri-file-excel-2-fill" />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div className="file-name">Website_content.exl</div>
                                                    <div className="text-truncate fs-8 mb-2">2,635 KB</div>
                                                </div>
                                            </div>
                                            <div className="d-flex">
                                                <span className="file-star">
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                <Dropdown>
                                                    <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                        <span className="icon">
                                                            <span className="feather-icon">
                                                                <MoreHorizontal />
                                                            </span>
                                                        </span>
                                                    </Dropdown.Toggle>

                                                    <Dropdown.Menu>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Eye />
                                                            </span>
                                                            <span>Preview</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Copy />
                                                            </span>
                                                            <span>Duplicate</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <SkipForward />
                                                            </span>
                                                            <span>Move</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <UserPlus />
                                                            </span>
                                                            <span>Invite</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Link2 />
                                                            </span>
                                                            <span>Share Link</span>
                                                        </Dropdown.Item>
                                                        <div className="dropdown-divider" />
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Info />
                                                            </span>
                                                            <span>View Details</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Download />
                                                            </span>
                                                            <span>Download</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Trash2 />
                                                            </span>
                                                            <span>Delete</span>
                                                        </Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="file-compact-card card-border">
                                        <Card.Body className=" d-flex justify-content-between">
                                            <div className="media fmapp-info-trigger" onClick={fileInfo}>
                                                <div className="media-head me-3">
                                                    <div className="avatar avatar-icon avatar-soft-danger avatar-sm">
                                                        <span className="initial-wrap">
                                                            <i className="ri-file-pdf-fill" />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div className="file-name">jampack.pdf</div>
                                                    <div className="text-truncate fs-8 mb-2">21.73 MB</div>
                                                </div>
                                            </div>
                                            <div className="d-flex">
                                                <span className="file-star marked">
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                <Dropdown>
                                                    <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                        <span className="icon">
                                                            <span className="feather-icon">
                                                                <MoreHorizontal />
                                                            </span>
                                                        </span>
                                                    </Dropdown.Toggle>

                                                    <Dropdown.Menu>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Eye />
                                                            </span>
                                                            <span>Preview</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Copy />
                                                            </span>
                                                            <span>Duplicate</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <SkipForward />
                                                            </span>
                                                            <span>Move</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <UserPlus />
                                                            </span>
                                                            <span>Invite</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Link2 />
                                                            </span>
                                                            <span>Share Link</span>
                                                        </Dropdown.Item>
                                                        <div className="dropdown-divider" />
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Info />
                                                            </span>
                                                            <span>View Details</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Download />
                                                            </span>
                                                            <span>Download</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Trash2 />
                                                            </span>
                                                            <span>Delete</span>
                                                        </Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="file-compact-card card-border">
                                        <Card.Body className=" d-flex justify-content-between">
                                            <div className="media fmapp-info-trigger" onClick={fileInfo}>
                                                <div className="media-head me-3">
                                                    <Image src={mock7} alt="user" className="d-block img-fluid h-50p w-75p" />
                                                </div>
                                                <div className="media-body">
                                                    <div className="file-name">jonas-kakaroto-KIPqvvTxl</div>
                                                    <div className="text-truncate fs-8 mb-2">4,178 KB</div>
                                                </div>
                                            </div>
                                            <div className="d-flex">
                                                <span className="file-star">
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                <Dropdown>
                                                    <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                        <span className="icon">
                                                            <span className="feather-icon">
                                                                <MoreHorizontal />
                                                            </span>
                                                        </span>
                                                    </Dropdown.Toggle>

                                                    <Dropdown.Menu>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Eye />
                                                            </span>
                                                            <span>Preview</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Copy />
                                                            </span>
                                                            <span>Duplicate</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <SkipForward />
                                                            </span>
                                                            <span>Move</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <UserPlus />
                                                            </span>
                                                            <span>Invite</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Link2 />
                                                            </span>
                                                            <span>Share Link</span>
                                                        </Dropdown.Item>
                                                        <div className="dropdown-divider" />
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Info />
                                                            </span>
                                                            <span>View Details</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Download />
                                                            </span>
                                                            <span>Download</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Trash2 />
                                                            </span>
                                                            <span>Delete</span>
                                                        </Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="file-compact-card card-border">
                                        <Card.Body className=" d-flex justify-content-between">
                                            <div className="media fmapp-info-trigger" onClick={fileInfo}>
                                                <div className="media-head me-3">
                                                    <div className="avatar avatar-icon avatar-soft-blue avatar-sm">
                                                        <span className="initial-wrap">
                                                            <i className="ri-folder-zip-fill" />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div className="file-name">jampack.zip</div>
                                                    <div className="text-truncate fs-8 mb-2">2.45 GB</div>
                                                </div>
                                            </div>
                                            <div className="d-flex">
                                                <span className="file-star">
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                <Dropdown>
                                                    <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                        <span className="icon">
                                                            <span className="feather-icon">
                                                                <MoreHorizontal />
                                                            </span>
                                                        </span>
                                                    </Dropdown.Toggle>

                                                    <Dropdown.Menu>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Eye />
                                                            </span>
                                                            <span>Preview</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Copy />
                                                            </span>
                                                            <span>Duplicate</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <SkipForward />
                                                            </span>
                                                            <span>Move</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <UserPlus />
                                                            </span>
                                                            <span>Invite</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Link2 />
                                                            </span>
                                                            <span>Share Link</span>
                                                        </Dropdown.Item>
                                                        <div className="dropdown-divider" />
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Info />
                                                            </span>
                                                            <span>View Details</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Download />
                                                            </span>
                                                            <span>Download</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Trash2 />
                                                            </span>
                                                            <span>Delete</span>
                                                        </Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="file-compact-card card-border">
                                        <Card.Body className=" d-flex justify-content-between">
                                            <div className="media fmapp-info-trigger" onClick={fileInfo}>
                                                <div className="media-head me-3">
                                                    <div className="avatar avatar-icon avatar-soft-light avatar-sm">
                                                        <span className="initial-wrap">
                                                            <i className="ri-keynote-fill" />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div className="file-name">presentation.keynote</div>
                                                    <div className="text-truncate fs-8 mb-2">20 KB</div>
                                                </div>
                                            </div>
                                            <div className="d-flex">
                                                <span className="file-star">
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                <Dropdown>
                                                    <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                        <span className="icon">
                                                            <span className="feather-icon">
                                                                <MoreHorizontal />
                                                            </span>
                                                        </span>
                                                    </Dropdown.Toggle>

                                                    <Dropdown.Menu>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Eye />
                                                            </span>
                                                            <span>Preview</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Copy />
                                                            </span>
                                                            <span>Duplicate</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <SkipForward />
                                                            </span>
                                                            <span>Move</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <UserPlus />
                                                            </span>
                                                            <span>Invite</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Link2 />
                                                            </span>
                                                            <span>Share Link</span>
                                                        </Dropdown.Item>
                                                        <div className="dropdown-divider" />
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Info />
                                                            </span>
                                                            <span>View Details</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Download />
                                                            </span>
                                                            <span>Download</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Trash2 />
                                                            </span>
                                                            <span>Delete</span>
                                                        </Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="file-compact-card card-border">
                                        <Card.Body className=" d-flex justify-content-between">
                                            <div className="media fmapp-info-trigger" onClick={fileInfo}>
                                                <div className="media-head me-3">
                                                    <Image src={mock5} alt="user" className="d-block img-fluid h-50p w-40p" />
                                                </div>
                                                <div className="media-body">
                                                    <div className="file-name">joel-mott-LaK153ghdig</div>
                                                    <div className="text-truncate fs-8 mb-2">2,635 KB</div>
                                                </div>
                                            </div>
                                            <div className="d-flex">
                                                <span className="file-star">
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                <Dropdown>
                                                    <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                        <span className="icon">
                                                            <span className="feather-icon">
                                                                <MoreHorizontal />
                                                            </span>
                                                        </span>
                                                    </Dropdown.Toggle>

                                                    <Dropdown.Menu>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Eye />
                                                            </span>
                                                            <span>Preview</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Copy />
                                                            </span>
                                                            <span>Duplicate</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <SkipForward />
                                                            </span>
                                                            <span>Move</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <UserPlus />
                                                            </span>
                                                            <span>Invite</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Link2 />
                                                            </span>
                                                            <span>Share Link</span>
                                                        </Dropdown.Item>
                                                        <div className="dropdown-divider" />
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Info />
                                                            </span>
                                                            <span>View Details</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Download />
                                                            </span>
                                                            <span>Download</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Trash2 />
                                                            </span>
                                                            <span>Delete</span>
                                                        </Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="file-compact-card card-border">
                                        <Card.Body className=" d-flex justify-content-between">
                                            <div className="media fmapp-info-trigger" onClick={fileInfo}>
                                                <div className="media-head me-3">
                                                    <div className="avatar avatar-icon avatar-soft-blue avatar-sm">
                                                        <span className="initial-wrap">
                                                            <i className="ri-file-text-fill" />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div className="file-name">expenses.doc</div>
                                                    <div className="text-truncate fs-8 mb-2">2,635 KB</div>
                                                </div>
                                            </div>
                                            <div className="d-flex">
                                                <span className="file-star">
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                <Dropdown>
                                                    <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                        <span className="icon">
                                                            <span className="feather-icon">
                                                                <MoreHorizontal />
                                                            </span>
                                                        </span>
                                                    </Dropdown.Toggle>

                                                    <Dropdown.Menu>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Eye />
                                                            </span>
                                                            <span>Preview</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Copy />
                                                            </span>
                                                            <span>Duplicate</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <SkipForward />
                                                            </span>
                                                            <span>Move</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <UserPlus />
                                                            </span>
                                                            <span>Invite</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Link2 />
                                                            </span>
                                                            <span>Share Link</span>
                                                        </Dropdown.Item>
                                                        <div className="dropdown-divider" />
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Info />
                                                            </span>
                                                            <span>View Details</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Download />
                                                            </span>
                                                            <span>Download</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Trash2 />
                                                            </span>
                                                            <span>Delete</span>
                                                        </Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="file-compact-card card-border">
                                        <Card.Body className=" d-flex justify-content-between">
                                            <div className="media fmapp-info-trigger" onClick={fileInfo}>
                                                <div className="media-head me-3">
                                                    <div className="avatar avatar-icon avatar-soft-blue avatar-sm">
                                                        <span className="initial-wrap">
                                                            <i className="ri-file-text-fill" />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div className="file-name">minutes_meeting.doc</div>
                                                    <div className="text-truncate fs-8 mb-2">2,635 KB</div>
                                                </div>
                                            </div>
                                            <div className="d-flex">
                                                <span className="file-star">
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                <Dropdown>
                                                    <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                        <span className="icon">
                                                            <span className="feather-icon">
                                                                <MoreHorizontal />
                                                            </span>
                                                        </span>
                                                    </Dropdown.Toggle>

                                                    <Dropdown.Menu>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Eye />
                                                            </span>
                                                            <span>Preview</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Copy />
                                                            </span>
                                                            <span>Duplicate</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <SkipForward />
                                                            </span>
                                                            <span>Move</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <UserPlus />
                                                            </span>
                                                            <span>Invite</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Link2 />
                                                            </span>
                                                            <span>Share Link</span>
                                                        </Dropdown.Item>
                                                        <div className="dropdown-divider" />
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Info />
                                                            </span>
                                                            <span>View Details</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Download />
                                                            </span>
                                                            <span>Download</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Trash2 />
                                                            </span>
                                                            <span>Delete</span>
                                                        </Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="file-compact-card card-border">
                                        <Card.Body className=" d-flex justify-content-between">
                                            <div className="media fmapp-info-trigger" onClick={fileInfo}>
                                                <div className="media-head me-3">
                                                    <div className="avatar avatar-icon avatar-sm avatar-soft-blue">
                                                        <span className="initial-wrap">
                                                            <i className="ri-file-word-2-fill" />
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div className="file-name">proposal.doc</div>
                                                    <div className="text-truncate fs-8 mb-2">951 KB</div>
                                                </div>
                                            </div>
                                            <div className="d-flex">
                                                <span className="file-star marked">
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                <Dropdown>
                                                    <Dropdown.Toggle variant='flush-dark' size="xs" className="btn-icon btn-rounded flush-soft-hover flex-shrink-0 no-caret">
                                                        <span className="icon">
                                                            <span className="feather-icon">
                                                                <MoreHorizontal />
                                                            </span>
                                                        </span>
                                                    </Dropdown.Toggle>

                                                    <Dropdown.Menu>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Eye />
                                                            </span>
                                                            <span>Preview</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Copy />
                                                            </span>
                                                            <span>Duplicate</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <SkipForward />
                                                            </span>
                                                            <span>Move</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <UserPlus />
                                                            </span>
                                                            <span>Invite</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Link2 />
                                                            </span>
                                                            <span>Share Link</span>
                                                        </Dropdown.Item>
                                                        <div className="dropdown-divider" />
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Info />
                                                            </span>
                                                            <span>View Details</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Download />
                                                            </span>
                                                            <span>Download</span>
                                                        </Dropdown.Item>
                                                        <Dropdown.Item>
                                                            <span className="feather-icon dropdown-icon">
                                                                <Trash2 />
                                                            </span>
                                                            <span>Delete</span>
                                                        </Dropdown.Item>
                                                    </Dropdown.Menu>
                                                </Dropdown>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>
                        </HkCollapse>
                    </div>
                </div>
            </SimpleBar>
        </div>
    )
}

export default FmGrid
