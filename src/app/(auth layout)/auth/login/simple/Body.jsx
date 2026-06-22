import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button, Col, Container, Form, InputGroup, Row } from 'react-bootstrap';
import { Eye, EyeOff } from 'react-feather';

//Image
import logoutImg from '@/assets/img/macaroni-logged-out.png';

const Body = () => {
    const [userName, setUserName] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const router = useRouter()
    const handleSubmit = (e) => {
        e.preventDefault();
        router.push("/");
    }

    return (
        <div className="hk-pg-body">
            <Container>
                <Row>
                    <Col xl={7} lg={6} className="d-lg-block d-none v-separator separator-sm">
                        <div className="auth-content py-md-0 py-8">
                            <Row>
                                <Col xxl={9} xl={8} lg={11} className="text-center mx-auto">
                                    <Image src={logoutImg} className="img-fluid w-sm-40 w-50 mb-3" alt="login" />
                                    <h3 className="mb-2">Dig into festive savings, Go Premium</h3>
                                    <p className="w-xxl-65 w-100 mx-auto">Save 20% on the premium membership plan by using the promo code &quot;JAMPACK20&quot;</p>
                                    <Button size="sm" variant="primary" className="btn-uppercase mt-4">Upgrade Now</Button>
                                    <p className="p-xs mt-5 text-light">All illustration are powered by <a href="https://icons8.com/ouch/" rel="noreferrer" target="_blank" className="text-light"><u>Icons8</u></a></p>
                                </Col>
                            </Row>
                        </div>
                    </Col>
                    <Col xl={5} lg={6} md={7} sm={10} className="position-relative mx-auto">
                        <div className="auth-content py-md-0 py-8">
                            <Form className="w-100" onSubmit={e => handleSubmit(e)} >
                                <Row>
                                    <Col lg={10} className="mx-auto">
                                        <h4 className="mb-4">Sign in to your account</h4>
                                        <Row className="gx-3">
                                            <Col lg={12} as={Form.Group} className="mb-3">
                                                <div className="form-label-group">
                                                    <Form.Label>User Name</Form.Label>
                                                </div>
                                                <Form.Control placeholder="Enter username or email ID" type="text" value={userName} onChange={e => setUserName(e.target.value)} />
                                            </Col>
                                            <Col lg={12} as={Form.Group} className="mb-3">
                                                <div className="form-label-group">
                                                    <Form.Label>Password</Form.Label>
                                                    <a href="#" className="fs-7 fw-medium">Forgot Password ?</a>
                                                </div>
                                                <InputGroup className="password-check">
                                                    <span className="input-affix-wrapper">
                                                        <Form.Control placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} />
                                                        <a href="#" className="input-suffix text-muted" onClick={() => setShowPassword(!showPassword)} >
                                                            <span className="feather-icon">
                                                                {
                                                                    showPassword
                                                                        ?
                                                                        <EyeOff className="form-icon" />
                                                                        :
                                                                        <Eye className="form-icon" />
                                                                }

                                                            </span>
                                                        </a>
                                                    </span>
                                                </InputGroup>
                                            </Col>
                                        </Row>
                                        <div className="d-flex justify-content-center">
                                            <Form.Check id="logged_in" className="form-check-sm mb-3" >
                                                <Form.Check.Input type="checkbox" defaultChecked />
                                                <Form.Check.Label className="text-muted fs-7">Keep me logged in</Form.Check.Label>
                                            </Form.Check>
                                        </div>
                                        <Button variant="primary" type="submit" className="btn-uppercase btn-block">Login</Button>
                                        <p className="p-xs mt-2 text-center">New to Jmapack ? <a href="#"><u>Create new account</u></a></p>
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

export default Body;
