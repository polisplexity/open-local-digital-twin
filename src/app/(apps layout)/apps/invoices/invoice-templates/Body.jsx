import Image from 'next/image';
import { Card, Col, Container, Form, Row } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';

//Images
import template1 from '@/assets/img/templates/template1.png';
import template2 from '@/assets/img/templates/template2.png';
import template3 from '@/assets/img/templates/template3.png';
import template4 from '@/assets/img/templates/template4.png';
import template5 from '@/assets/img/templates/template5.png';
import template6 from '@/assets/img/templates/template6.png';
import template7 from '@/assets/img/templates/template7.png';
import template8 from '@/assets/img/templates/template8.png';

const Body = () => {
    return (
        <div className="invoice-body">
            <SimpleBar className="nicescroll-bar">
                <Container>
                    <div className="my-md-7 my-3">
                        <h3 className="mb-4">Pick your starting point</h3>
                        <Form>
                            <Row>
                                <Col md={4} className="mb-md-0 mb-3">
                                    <Form.Control type="text" placeholder="Search Template" />
                                </Col>
                                <Col md={4} className="mb-md-0 mb-3">
                                    <Form.Select>
                                        <option value={1}>Popular</option>
                                        <option value={2} >Classic</option>
                                        <option value={3} >Trending</option>
                                        <option value={4} >Simple</option>
                                    </Form.Select>
                                </Col>
                                <div className="col-md-4">
                                    <Form.Select>
                                        <option value={1}>All Categories</option>
                                        <option value={2}>Business</option>
                                        <option value={3}>Studio</option>
                                        <option value={3}>Personal</option>
                                    </Form.Select>
                                </div>
                            </Row>
                        </Form>
                        <h5 className="mt-7 mb-3">Premium Templates</h5>
                        <Row className="text-center">
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template1.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Standard</h6>
                            </a>
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template2.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Simplicity</h6>
                            </a>
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template3.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Essential</h6>
                            </a>
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template4.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Classic</h6>
                            </a>
                        </Row>
                        <h5 className="mt-7 mb-3">Business</h5>
                        <div className="row text-center">
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template5.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Pro Forma</h6>
                            </a>
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template6.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Trade</h6>
                            </a>
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template7.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Interim</h6>
                            </a>
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template8.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Primary</h6>
                            </a>
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template1.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Matt Opel</h6>
                            </a>
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template2.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Freelancer</h6>
                            </a>
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template3.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Designer</h6>
                            </a>
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template4.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Service</h6>
                            </a>
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template5.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Service</h6>
                            </a>
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template6.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Service</h6>
                            </a>
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template7.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Service</h6>
                            </a>
                            <a href="#" className="d-block col-xl-2 col-sm-4 col-xs-12 mb-5">
                                <Card className="card-border">
                                    <Card.Img src={template8.src} alt="Card img cap" />
                                </Card>
                                <h6 className="mb-0">Service</h6>
                            </a>
                        </div>
                    </div>
                </Container>
            </SimpleBar>
        </div>
    )
}

export default Body
