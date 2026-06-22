import { useState } from 'react';
import Link from 'next/link';
import { faFacebook, faGoogle } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Card, Col, Container, Form, InputGroup, Row } from 'react-bootstrap';

//Images
import slide3 from '@/assets/img/slide3.jpg';
import slide4 from '@/assets/img/slide4.jpg';

const Body = () => {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="hk-pg-body">
            <Container>
                <Row>
                    <Col xl={7} lg={6} className="d-lg-block d-none v-separator">
                        <div className="auth-content py-md-0  py-8">
                            <Row>
                                <Col xxl={9} xl={8} lg={11} className="mx-auto">
                                    <div className="text-center">
                                        <h3 className="mb-2">High quality Bootstrap template for your next web project.</h3>
                                        <p>Start your <mark>14days free</mark> trial.</p>
                                    </div>
                                    <ul className="list-icon mt-4">
                                        <li className="mb-1">
                                            <p>
                                                <i className="ri-check-fill text-success" />
                                                <span>There are many variations of passages of Lorem Ipsum available, in some form, by injected humour</span>
                                            </p>
                                        </li>
                                        <li className="mb-1">
                                            <p>
                                                <i className="ri-check-fill text-success" />
                                                <span>There are many variations of passages of Lorem Ipsum available, in some form, by injected humour</span>
                                            </p>
                                        </li>
                                    </ul>
                                    <Row className="gx-3 mt-7">
                                        <Col lg={6}>
                                            <Card className="card-shadow">
                                                <Card.Img variant="top" src={slide3.src} alt="Card img cap" />
                                                <Card.Body>
                                                    <Card.Title className="text-uppercase">Help Centre</Card.Title>
                                                    <Card.Text>This is a wider card with supporting text.</Card.Text>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                        <Col lg={6}>
                                            <Card className="card-shadow">
                                                <Card.Img variant="top" src={slide4.src} alt="Card img cap" />
                                                <Card.Body>
                                                    <Card.Title className="text-uppercase">Research Centre</Card.Title>
                                                    <Card.Text>This is a wider card with supporting text.</Card.Text>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    </Row>
                                    <p className="mt-5 p-xs credit-text text-center text-light">All illustration are powered by <a href="https://icons8.com/ouch/" target="_blank" className="text-light" rel="noreferrer"><u>OUCH</u></a></p>
                                </Col>
                            </Row>
                        </div>
                    </Col>
                    <Col xl={5} lg={6} md={7} sm={10} className="position-relative mx-auto">
                        <div className="auth-content py-md-0 py-8">
                            <Form className="w-100">
                                <Row>
                                    <Col lg={10} className="mx-auto">
                                        <h4 className="text-center mb-4">Sign Up to Jampack</h4>
                                        <Button variant="outline-dark" className="btn-rounded btn-block mb-3">
                                            <span>
                                                <span className="icon">
                                                    <FontAwesomeIcon icon={faGoogle} />
                                                </span>
                                                <span>Sign Up with Gmail</span>
                                            </span>
                                        </Button>
                                        <Button variant="social-facebook" className="btn-social btn-rounded btn-block">
                                            <span>
                                                <span className="icon">
                                                    <FontAwesomeIcon icon={faFacebook} />
                                                </span>
                                                <span>Sign Up with Facebook</span>
                                            </span>
                                        </Button>
                                        <div className="title-sm title-wth-divider divider-center my-4"><span>Or</span></div>
                                        <Row className="gx-3">
                                            <Col lg={6} as={Form.Group} className="mb-3">
                                                <Form.Label>Name</Form.Label>
                                                <Form.Control placeholder="Enter your name" type="text" />
                                            </Col>
                                            <Col lg={6} as={Form.Group} className="mb-3">
                                                <Form.Label>Username</Form.Label>
                                                <Form.Control placeholder="Enter username" type="text" />
                                            </Col>
                                            <Col lg={12} as={Form.Group} className="mb-3">
                                                <Form.Label>Email</Form.Label>
                                                <Form.Control placeholder="Enter your email id" type="text" />
                                            </Col>
                                            <Col lg={12} as={Form.Group} className="mb-3">
                                                <Form.Label>Password</Form.Label>
                                                <InputGroup className="password-check">
                                                    <span className="input-affix-wrapper affix-wth-text">
                                                        <Form.Control placeholder="6+ characters" type={showPassword ? "text" : "password"} />
                                                        <a href="#" className="input-suffix text-primary text-uppercase fs-8 fw-medium" onClick={() => setShowPassword(!showPassword)} >
                                                            {showPassword
                                                                ?
                                                                <span>Hide</span>
                                                                :
                                                                <span>Show</span>
                                                            }
                                                        </a>
                                                    </span>
                                                </InputGroup>
                                            </Col>
                                        </Row>
                                        <Form.Check id="logged_in" className="form-check-sm mb-3" >
                                            <Form.Check.Input type="checkbox" defaultChecked />
                                            <Form.Check.Label className="text-muted fs-7">
                                                By creating an account you specify that you have read and agree with our <a href="#">Tearms of use</a> and <a href="#">Privacy policy</a>. We may keep you inform about latest updates through our default <a href="#">notification settings</a>
                                            </Form.Check.Label>
                                        </Form.Check>
                                        <Button variant='primary' className="btn-rounded btn-uppercase btn-block" as={Link} href="/auth/login/simple" >Create account</Button>
                                        <p className="p-xs mt-2 text-center">Already a member ? <a href="#"><u>Sign In</u></a></p>
                                    </Col>
                                </Row>
                            </Form>
                        </div>
                    </Col>
                </Row>
            </Container>
        </div>
    )
}

export default Body
