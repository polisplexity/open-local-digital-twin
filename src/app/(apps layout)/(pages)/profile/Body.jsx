import Image from 'next/image';
import HkBadge from '@/components/@hk-badge/@hk-badge';
import { faTwitter } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Card, Col, Dropdown, Form, ListGroup, Row } from 'react-bootstrap';
import { Check, Link2, MoreHorizontal, Plus, Settings } from 'react-feather';
//Swiper Carousel
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';    

//Images
import avatar1 from '@/assets/img/avatar1.jpg';
import avatar2 from '@/assets/img/avatar2.jpg';
import avatar3 from '@/assets/img/avatar3.jpg';
import avatar4 from '@/assets/img/avatar4.jpg';
import avatar5 from '@/assets/img/avatar5.jpg';
import avatar6 from '@/assets/img/avatar6.jpg';
import avatar7 from '@/assets/img/avatar7.jpg';
import avatar8 from '@/assets/img/avatar8.jpg';
import avatar9 from '@/assets/img/avatar9.jpg';
import avatar10 from '@/assets/img/avatar10.jpg';
import avatar14 from '@/assets/img/avatar14.jpg';
import mock7 from '@/assets/img/gallery/mock7.jpg'
import mock11 from '@/assets/img/gallery/mock11.jpg'
import mock12 from '@/assets/img/gallery/mock12.jpg'
import mock13 from '@/assets/img/gallery/mock13.jpg'
import mock14 from '@/assets/img/gallery/mock14.jpg'

const Body = () => {
    return (
        <Row className="mt-7">
            <Col lg={4} className="mb-lg-0 mb-3">
                <Card className="card-border mb-lg-4 mb-3">
                    <Card.Header className="card-header-action">
                        <div className="media align-items-center">
                            <div className="media-head me-2">
                                <div className="avatar avatar-sm avatar-rounded">
                                    <Image src={avatar3} alt="user" className="avatar-img" />
                                </div>
                            </div>
                            <div className="media-body">
                                <div className="fw-medium text-dark">Kate Jones</div>
                                <div className="fs-7">Business Manager</div>
                            </div>
                        </div>
                        <div className="card-action-wrap">
                            <Dropdown>
                                <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <Settings />
                                        </span>
                                    </span>
                                </Dropdown.Toggle>
                                <Dropdown.Menu align="end">
                                    <Dropdown.Item>Action</Dropdown.Item>
                                    <Dropdown.Item>Another action</Dropdown.Item>
                                    <Dropdown.Item>Something else here</Dropdown.Item>
                                    <Dropdown.Divider as="div" />
                                    <Dropdown.Item>Separated link</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>
                    </Card.Header>
                    <Card.Body>
                        <div className="d-flex text-center">
                            <div className="flex-1 border-end">
                                <div>
                                    <span className="d-block fs-4 text-dark mb-1">154</span>
                                    <span className="d-block text-capitalize fs-7">photos</span>
                                </div>
                            </div>
                            <div className="flex-1 border-end">
                                <div>
                                    <span className="d-block fs-4 text-dark mb-1">65</span>
                                    <span className="d-block text-capitalize fs-7">followers</span>
                                </div>
                            </div>
                            <div className="flex-1">
                                <div>
                                    <span className="d-block fs-4 text-dark mb-1">433</span>
                                    <span className="d-block text-capitalize fs-7">views</span>
                                </div>
                            </div>
                        </div>
                    </Card.Body>
                    <ListGroup variant="flush">
                        <ListGroup.Item className="border-0">
                            <span>
                                <i className="bi bi-calendar-check-fill text-disabled me-2" />
                                <span className="text-muted">Went to:</span>
                            </span>
                            <span className="ms-2">Oh, Canada</span>
                        </ListGroup.Item>
                        <ListGroup.Item className="border-0">
                            <span>
                                <i className="bi bi-briefcase-fill text-disabled me-2" />
                                <span className="text-muted">Worked at:</span>
                            </span>
                            <span className="ms-2">Companey</span>
                        </ListGroup.Item>
                        <ListGroup.Item className="border-0">
                            <span>
                                <i className="bi bi-house-door-fill text-disabled me-2" />
                                <span className="text-muted">Lives in:</span>
                            </span>
                            <span className="ms-2">San Francisco, CA</span>
                        </ListGroup.Item>
                        <ListGroup.Item className="border-0">
                            <span>
                                <i className="bi bi-geo-alt-fill text-disabled me-2" />
                                <span className="text-muted">From:</span>
                            </span>
                            <span className="ms-2">Settle, WA</span>
                        </ListGroup.Item>
                    </ListGroup>
                </Card>
                <Card className="card-border mb-lg-4 mb-3">
                    <Card.Header className="card-header-action">
                        <h6>You know these people ?</h6>
                        <div className="card-action-wrap">
                            <Dropdown>
                                <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <MoreHorizontal />
                                        </span>
                                    </span>
                                </Dropdown.Toggle>
                                <Dropdown.Menu align="end">
                                    <Dropdown.Item>Action</Dropdown.Item>
                                    <Dropdown.Item>Another action</Dropdown.Item>
                                    <Dropdown.Item>Something else here</Dropdown.Item>
                                    <Dropdown.Divider as="div" />
                                    <Dropdown.Item>Separated link</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>
                    </Card.Header>
                    <ListGroup variant="flush">
                        <ListGroup.Item className="border-0">
                            <div className="media align-items-center">
                                <div className="media-head me-3">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar8} alt="user" className="avatar-img" />
                                    </div>
                                </div>
                                <div className="media-body">
                                    <span className="d-block text-capitalize">Evie Ono</span>
                                    <span className="d-block text-muted fs-7">Apple Inc</span>
                                </div>
                                <Button variant="light" size="sm" className="btn-icon btn-rounded ">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <Plus />
                                        </span>
                                    </span>
                                </Button>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item className="border-0">
                            <div className="media align-items-center">
                                <div className="media-head me-3">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar7} alt="user" className="avatar-img" />
                                    </div>
                                </div>
                                <div className="media-body">
                                    <span className="d-block text-capitalize">Clay Masse</span>
                                    <span className="d-block text-muted fs-7">Hencework.com</span>
                                </div>
                                <Button variant="light" size="sm" className="btn-icon btn-rounded ">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <Plus />
                                        </span>
                                    </span>
                                </Button>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item className="border-0">
                            <div className="media align-items-center">
                                <div className="media-head me-3">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar5} alt="user" className="avatar-img" />
                                    </div>
                                </div>
                                <div className="media-body">
                                    <span className="d-block text-capitalize">Madelyn Rascon</span>
                                    <span className="d-block text-muted fs-7">Godaddy.co.in</span>
                                </div>
                                <Button variant="primary" size="sm" className="btn-icon btn-rounded ">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <Check />
                                        </span>
                                    </span>
                                </Button>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item className="border-0">
                            <div className="media align-items-center">
                                <div className="media-head me-3">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar4} alt="user" className="avatar-img" />
                                    </div>
                                </div>
                                <div className="media-body">
                                    <span className="d-block text-capitalize">Mitsoku Heid</span>
                                    <span className="d-block text-muted fs-7">Flipkart</span>
                                </div>
                                <Button variant="primary" size="sm" className="btn-icon btn-rounded ">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <Check />
                                        </span>
                                    </span>
                                </Button>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item className="border-0">
                            <div className="media align-items-center">
                                <div className="media-head me-3">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar3} alt="user" className="avatar-img" />
                                    </div>
                                </div>
                                <div className="media-body">
                                    <span className="d-block text-capitalize">Eziquiel Merideth</span>
                                    <span className="d-block text-muted fs-7">Paypal</span>
                                </div>
                                <Button variant="light" size="sm" className="btn-icon btn-rounded ">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <Plus />
                                        </span>
                                    </span>
                                </Button>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item className="border-0">
                            <div className="media align-items-center">
                                <div className="media-head me-3">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar2} alt="user" className="avatar-img" />
                                    </div>
                                </div>
                                <div className="media-body">
                                    <span className="d-block text-capitalize">Johnie Metoyer</span>
                                    <span className="d-block text-muted fs-7">Robocon</span>
                                </div>
                                <Button variant="primary" size="sm" className="btn-icon btn-rounded ">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <Check />
                                        </span>
                                    </span>
                                </Button>
                            </div>
                        </ListGroup.Item>
                    </ListGroup>
                </Card>
                <Card className="card-border mb-lg-4 mb-3">
                    <Card.Header className="card-header-action">
                        <h6>Friends
                            <HkBadge bg="light" text="dark" size="sm" className="ms-1">212</HkBadge>
                        </h6>
                        <div className="card-action-wrap">
                            <a href="#">View all</a>
                        </div>
                    </Card.Header>
                    <Card.Body>
                        <Row className="gx-3 text-center">
                            <Col xs={3} className="mb-3">
                                <div className="mb-2">
                                    <Image src={avatar1} alt="user" className="img-fluid rounded" />
                                </div>
                                <span className="d-block fs-7 text-truncate">Evie Ono</span>
                            </Col>
                            <Col xs={3} className="mb-3">
                                <div className="mb-2">
                                    <Image src={avatar2} alt="user" className="img-fluid rounded" />
                                </div>
                                <span className="d-block fs-7 text-truncate">Clay Masse</span>
                            </Col>
                            <Col xs={3} className="mb-3">
                                <div className="mb-2">
                                    <Image src={avatar3} alt="user" className="img-fluid rounded" />
                                </div>
                                <span className="d-block fs-7 text-truncate">Madelyn Rascon</span>
                            </Col>
                            <Col xs={3} className="mb-3">
                                <div className="mb-2">
                                    <Image src={avatar4} alt="user" className="img-fluid rounded" />
                                </div>
                                <span className="d-block fs-7 text-truncate">Mitsoku Heid</span>
                            </Col>
                            <Col xs={3} className="mb-3">
                                <div className="mb-2">
                                    <Image src={avatar5} alt="user" className="img-fluid rounded" />
                                </div>
                                <span className="d-block fs-7 text-truncate">Eziquiel Merideth</span>
                            </Col>
                            <Col xs={3} className="mb-3">
                                <div className="mb-2">
                                    <Image src={avatar6} alt="user" className="img-fluid rounded" />
                                </div>
                                <span className="d-block fs-7 text-truncate">Johnie Metoyer</span>
                            </Col>
                            <Col xs={3} className="mb-3">
                                <div className="mb-2">
                                    <Image src={avatar7} alt="user" className="img-fluid rounded" />
                                </div>
                                <span className="d-block fs-7 text-truncate">Angelic Lauver</span>
                            </Col>
                            <Col xs={3} className="mb-3">
                                <div className="mb-2">
                                    <Image src={avatar8} alt="user" className="img-fluid rounded" />
                                </div>
                                <span className="d-block fs-7 text-truncate">Cecilia Rios</span>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>
                <Card className="card-border mb-lg-4 mb-3">
                    <Card.Header className="card-header-action">
                        <h6>Groups
                            <HkBadge bg="light" text="dark" size="sm" className="ms-1">12</HkBadge>
                        </h6>
                        <div className="card-action-wrap">
                            <a href="#">View all</a>
                        </div>
                    </Card.Header>
                    <ListGroup variant="flush">
                        <ListGroup.Item className="border-0">
                            <div className="media align-items-center">
                                <div className="media-head me-3">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar1} alt="user" className="avatar-img" />
                                    </div>
                                </div>
                                <div className="media-body">
                                    <span className="d-block text-capitalize">Landscape Group</span>
                                    <span className="d-block text-muted fs-7">1.25K Members</span>
                                </div>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item className="border-0">
                            <div className="media align-items-center">
                                <div className="media-head me-3">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar2} alt="user" className="avatar-img" />
                                    </div>
                                </div>
                                <div className="media-body">
                                    <span className="d-block text-capitalize">Josh Groben Fanclub</span>
                                    <span className="d-block text-muted fs-7">2M Members</span>
                                </div>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item className="border-0">
                            <div className="media align-items-center">
                                <div className="media-head me-3">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar3} alt="user" className="avatar-img" />
                                    </div>
                                </div>
                                <div className="media-body">
                                    <span className="d-block text-capitalize">UI/UX Lead</span>
                                    <span className="d-block text-muted fs-7">8K Members</span>
                                </div>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item className="border-0">
                            <div className="media align-items-center">
                                <div className="media-head me-3">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar4} alt="user" className="avatar-img" />
                                    </div>
                                </div>
                                <div className="media-body">
                                    <span className="d-block text-capitalize">Design Yatra</span>
                                    <span className="d-block text-muted fs-7">14K Members</span>
                                </div>
                            </div>
                        </ListGroup.Item>
                    </ListGroup>
                </Card>
                <Card className="card-border mb-lg-4 mb-3">
                    <Card.Header className="card-header-action">
                        <h6>Links
                            <span className="badge badge-sm badge-light me-1">5</span>
                        </h6>
                        <div className="card-action-wrap">
                            <a href="#">View all</a>
                        </div>
                    </Card.Header>
                    <ListGroup className="list-group-flush">
                        <ListGroup.Item className="border-0">
                            <div className="media align-items-center">
                                <div className="media-head me-3">
                                    <div className="avatar avatar-sm avatar-primary avatar-rounded">
                                        <span className="initial-wrap">G</span>
                                    </div>
                                </div>
                                <div className="media-body">
                                    <span className="d-block text-capitalize text-truncate mw-150p">
                                        Google</span>
                                    <span className="d-block text-muted fs-7 text-truncate mw-150p">google.com</span>
                                </div>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item className="border-0">
                            <div className="media align-items-center">
                                <div className="media-head me-3">
                                    <div className="avatar avatar-sm avatar-pink avatar-rounded">
                                        <span className="initial-wrap">AR</span>
                                    </div>
                                </div>
                                <div className="media-body">
                                    <span className="d-block text-capitalize text-truncate mw-150p">Improve Your Business</span>
                                    <span className="d-block text-muted fs-7 text-truncate mw-150p">yahoo.com</span>
                                </div>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item className="border-0">
                            <div className="media align-items-center">
                                <div className="media-head me-3">
                                    <div className="avatar avatar-sm avatar-warning avatar-rounded">
                                        <span className="initial-wrap">PR</span>
                                    </div>
                                </div>
                                <div className="media-body">
                                    <span className="d-block text-capitalize text-truncate mw-150p">Cast The Cookware</span>
                                    <span className="d-block text-muted fs-7 text-truncate mw-150p">yahoo.com</span>
                                </div>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item className="border-0">
                            <div className="media align-items-center">
                                <div className="media-head me-3">
                                    <div className="avatar avatar-sm avatar-success avatar-rounded">
                                        <span className="initial-wrap">PR</span>
                                    </div>
                                </div>
                                <div className="media-body">
                                    <span className="d-block text-capitalize text-truncate mw-150p">The Universe Thought Sds</span>
                                    <span className="d-block text-muted fs-7 text-truncate mw-150p">facebook.com</span>
                                </div>
                            </div>
                        </ListGroup.Item>
                    </ListGroup>
                </Card>
                <Card bg="primary" className="text-center">
                    <Card.Body className="twitter-slider-wrap">
                        <div className="twitter-icon text-center mb-3">
                            <FontAwesomeIcon icon={faTwitter} />
                        </div>
                        {/* <div id="tweets_fetch" className="owl-carousel light-owl-dots owl-theme" /> */}
                        <Swiper
                            autoHeight={true}
                            loop={true}
                            autoplay={{
                                delay: 5000,
                            }}
                            pagination={{
                                clickable: true,
                            }}
                            modules={[Pagination, Autoplay]}

                            className="swiper-carousel tweeter-carousel"
                        >
                            <SwiperSlide>
                                <p className="tweet">
                                    Lorem ipsum dolor sit, amet consectetur adipisicing elit. A hic magni rem consectetur iure? Suscipit esse totam id sed! Nostrum.
                                    <a href="#demo" data-expanded-url="#demo" target=" _blank" title="#title" data-scribe="element:url"><span>https://</span>demo.de<span>&nbsp;</span></a>
                                    <br />
                                    <span className="timePosted"><a href="#demo">Posted on Jan 9, 2022</a></span>
                                </p>
                            </SwiperSlide>
                            <SwiperSlide>
                                <p className="tweet">Lorem ipsum dolor sit amet consectetur, adipisicing elit. Rem, dicta!<br /><br />
                                    Lorem ipsum dolor sit amet, consectetur adipisicing elit. Reiciendis natus molestias quas voluptas at atque doloremque odit doloribus tempora perferendis ratione dolorum ea eligendi enim est, culpa rerum quo sunt, ex tempore accusamus in assumenda fuga quibusdam!
                                    <br />
                                    <span className="timePosted"><a href="#demo">Posted on Jan 11, 2022</a></span>
                                </p>

                            </SwiperSlide>
                        </Swiper>
                    </Card.Body>
                </Card>
            </Col>
            <Col lg={8}>
                <Card className="card-border card-profile-feed mb-lg-4 mb-3">
                    <Card.Header className="card-header-action">
                        <div className="media align-items-center">
                            <div className="media-head me-2">
                                <div className="avatar avatar-sm avatar-rounded">
                                    <Image src={avatar8} alt="user" className="avatar-img" />
                                </div>
                            </div>
                            <div className="media-body">
                                <div className="fw-medium text-dark">Huma Therman</div>
                                <div className="fs-7">25 Min</div>
                            </div>
                        </div>
                        <div className="card-action-wrap">
                            <Dropdown>
                                <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <MoreHorizontal />
                                        </span>
                                    </span>
                                </Dropdown.Toggle>
                                <Dropdown.Menu align="end">
                                    <Dropdown.Item>Action</Dropdown.Item>
                                    <Dropdown.Item>Another action</Dropdown.Item>
                                    <Dropdown.Item>Something else here</Dropdown.Item>
                                    <Dropdown.Divider as="div" />
                                    <Dropdown.Item>Separated link</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>
                    </Card.Header>
                    <Card.Body>
                        <Card.Text className="mb-5">There was that time artists at Sequence opted to hand-Sharpie the lorem ipsum passage on a line of paper bags they designed for Chipotle.</Card.Text>
                        <Card className="card-border">
                            <div className="position-relative">
                                <Card.Img variant="top" className="d-block" src={mock12.src} alt="Card img cap" />
                                <Button variant="dark" className="btn-rounded btn-pg-link">
                                    <span>
                                        <span className="icon">
                                            <span className="feather-icon">
                                                <Link2 />
                                            </span>
                                        </span>
                                        <span>Website</span>
                                    </span>
                                </Button>
                            </div>
                            <Card.Body>
                                <h5>Bacon chicken turducken spare ribs.</h5>
                                <Card.Text>Of course, we&apos;d be remiss not to include the veritable cadre of lorem ipsum knock offs featuring: Bacon Ipsum, Hipster Ipsum, Corporate Ipsum, Legal Ipsum.</Card.Text>
                            </Card.Body>
                        </Card>
                    </Card.Body>
                    <Card.Footer className="justify-content-between">
                        <div>
                            <a href="#"><i className=" bi bi-heart-fill text-primary" />30K</a>
                        </div>
                        <div>
                            <a href="#">1K comments</a>
                            <a href="#">12 shares</a>
                        </div>
                    </Card.Footer>
                </Card>
                <div className="mb-lg-4 mb-lg-4 mb-3">
                    <Card className="card-border card-profile-feed mb-0 rounded-bottom-0">
                        <Card.Header className="card-header-action">
                            <div className="media align-items-center">
                                <div className="media-head me-2">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar10} alt="user" className="avatar-img" />
                                    </div>
                                </div>
                                <div className="media-body">
                                    <div className="fw-medium text-dark">Johnie Metoyer</div>
                                    <div className="fs-7">03 hrs</div>
                                </div>
                            </div>
                            <div className="card-action-wrap">
                                <Dropdown>
                                    <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                        <span className="icon">
                                            <span className="feather-icon">
                                                <MoreHorizontal />
                                            </span>
                                        </span>
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu align="end">
                                        <Dropdown.Item>Action</Dropdown.Item>
                                        <Dropdown.Item>Another action</Dropdown.Item>
                                        <Dropdown.Item>Something else here</Dropdown.Item>
                                        <Dropdown.Divider as="div" />
                                        <Dropdown.Item>Separated link</Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            <Card.Text className="mb-5">Not to mention, Cupcake Ipsum, Bob Ross Ipsum (“happy little clouds”), and the furry Cat Ipsum.</Card.Text>
                            <div className="feed-img-layout">
                                <Row className="h-200p">
                                    <Col sm={6} className="h-100">
                                        <div className="feed-img h-100" style={{ backgroundImage: `url(${mock11})` }} />
                                    </Col>
                                    <Col sm={6} className="h-100">
                                        <Row className="h-100">
                                            <Col sm={12} className="h-50 pb-2">
                                                <div className="feed-img h-100" style={{ backgroundImage: `url(${mock12})` }} />
                                            </Col>
                                            <Col sm={12} className="h-50 pb-2">
                                                <Row className="h-100">
                                                    <Col sm={6} className="h-100">
                                                        <div className="feed-img h-100" style={{ backgroundImage: `url(${mock13})` }} />
                                                    </Col>
                                                    <Col sm={6} className="h-100">
                                                        <div className="feed-img h-100" style={{ backgroundImage: `url(${mock14})` }} />
                                                    </Col>
                                                </Row>
                                            </Col>
                                        </Row>
                                    </Col>
                                </Row>
                            </div>
                        </Card.Body>
                        <Card.Footer className="justify-content-between">
                            <div>
                                <a href="#"><i className=" bi bi-heart-fill text-primary" />30K</a>
                            </div>
                            <div>
                                <a href="#">1K comments</a>
                                <a href="#">12 shares</a>
                            </div>
                        </Card.Footer>
                    </Card>
                    <Card className="card-border card-profile-feed border-top-0 rounded-top-0 mb-0">
                        <Card.Body>
                            <Button variant="light" size="sm" className="btn-block mb-4">Hide comments</Button>
                            <div className="comment-block">
                                <div className="media">
                                    <div className="media-head">
                                        <div className="avatar avatar-xs avatar-rounded">
                                            <Image src={avatar14} alt="user" className="avatar-img" />
                                        </div>
                                    </div>
                                    <Card.Body>
                                        <div>
                                            <span className="fw-medium text-dark">Martin Luther</span>
                                        </div>
                                        <Card.Text>From there, you can run truffle compile, truffle migrate and truffle test to compile your contracts, deploy those contracts to the network, and run their associated unit tests.</Card.Text>
                                        <div className="comment-action-wrap mt-3">
                                            <span>3 hours ago</span>
                                            <span className="comment-dot-sep">●</span>
                                            <a href="#">Reply</a>
                                            <span className="comment-dot-sep">●</span>
                                            <a href="#">Like</a>
                                        </div>
                                    </Card.Body>
                                </div>
                            </div>
                        </Card.Body>
                        <Card.Footer className="comment-block">
                            <Form className="w-100">
                                <Form.Group className="mb-0">
                                    <div className="media">
                                        <div className="media-head">
                                            <div className="avatar avatar-xs avatar-rounded">
                                                <Image src={avatar3} alt="user" className="avatar-img" />
                                            </div>
                                        </div>
                                        <div className="media-body">
                                            <Form.Control as="textarea" rows={1} className="border-0 bg-transparent shadow-none" placeholder="Leave a comment..." />
                                        </div>
                                    </div>
                                </Form.Group>
                            </Form>
                        </Card.Footer>
                    </Card>
                </div>
                <Card className="card-border card-profile-feed">
                    <Card.Header className="card-header-action">
                        <div className="media align-items-center">
                            <div className="media-head me-2">
                                <div className="avatar avatar-sm avatar-rounded">
                                    <Image src={avatar9} alt="user" className="avatar-img" />
                                </div>
                            </div>
                            <div className="media-body">
                                <div className="fw-medium text-dark">Mitsoku Heid</div>
                                <div className="fs-7">11 hrs</div>
                            </div>
                        </div>
                        <div className="card-action-wrap">
                            <Dropdown>
                                <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <MoreHorizontal />
                                        </span>
                                    </span>
                                </Dropdown.Toggle>
                                <Dropdown.Menu align="end">
                                    <Dropdown.Item>Action</Dropdown.Item>
                                    <Dropdown.Item>Another action</Dropdown.Item>
                                    <Dropdown.Item>Something else here</Dropdown.Item>
                                    <Dropdown.Divider as="div" />
                                    <Dropdown.Item>Separated link</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>
                    </Card.Header>
                    <Card.Body>
                        <Card.Text className="mb-5">There was that time artists at Sequence opted to hand-Sharpie the lorem ipsum passage on a line of paper bags they designed for Chipotle.</Card.Text>
                        <Card className="card-border">
                            <div className="position-relative">
                                <Image className="card-img" src={mock7} alt="Card img cap" />
                                <a href="#" className=" btn-video-link" />
                            </div>
                        </Card>
                    </Card.Body>
                    <Card.Footer className="justify-content-between">
                        <div>
                            <a href="#"><i className=" bi bi-heart-fill text-primary" />30K</a>
                        </div>
                        <div>
                            <a href="#">1K comments</a>
                            <a href="#">12 shares</a>
                        </div>
                    </Card.Footer>
                </Card>
            </Col>
        </Row >
    )
}

export default Body
