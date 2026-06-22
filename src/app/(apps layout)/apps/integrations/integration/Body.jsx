import Image from 'next/image';
import { Button, Card, Col, Container, Row } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';

//Images
import symbolAvatar2 from '@/assets/img/symbol-avatar-2.png';
import symbolAvatar5 from '@/assets/img/symbol-avatar-5.png';
import symbolAvatar6 from '@/assets/img/symbol-avatar-6.png';
import symbolAvatar7 from '@/assets/img/symbol-avatar-7.png';
import symbolAvatar8 from '@/assets/img/symbol-avatar-8.png';
import symbolAvatar9 from '@/assets/img/symbol-avatar-9.png';
import symbolAvatar10 from '@/assets/img/symbol-avatar-10.png';
import symbolAvatar11 from '@/assets/img/symbol-avatar-11.png';
import symbolAvatar12 from '@/assets/img/symbol-avatar-12.png';
import symbolAvatar14 from '@/assets/img/symbol-avatar-14.png';
import symbolAvatar13 from '@/assets/img/symbol-avatar-13.png';

const Body = () => {
    return (
        <div className="integrations-body">
            <SimpleBar className="nicescroll-bar">
                <Container className="mt-md-7 mt-3">
                    <Row>
                        <Col xxl={3} xl={4} md={6}>
                            <Card className="card-border card-int mb-4">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="avatar avatar-sm avatar-logo">
                                            <span className="initial-wrap">
                                                <Image src={symbolAvatar14} alt="logo" />
                                            </span>
                                        </div>
                                        <Button variant="outline-secondary" className="btn-block flex-grow-0 flex-shrink-0 flex-basis-0">connect</Button>
                                    </div>
                                    <div className="app-name">Intercom</div>
                                    <p className="p-sm multine-ellipsis">Venenatis tellus in metus vulputate eu scelerisque felis imperdiet proin. Tortor pretium viverra suspendisse potenti nullam ac tortor vitae.</p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col xxl={3} xl={4} md={6}>
                            <Card className="card-border card-int mb-4">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="avatar avatar-sm avatar-logo">
                                            <span className="initial-wrap">
                                                <Image src={symbolAvatar2} alt="logo" />
                                            </span>
                                        </div>
                                        <Button variant="primary" className="btn-block flex-grow-0 flex-shrink-0 flex-basis-0">connected</Button>
                                    </div>
                                    <div className="app-name">Swiggy</div>
                                    <p className="p-sm multine-ellipsis">Facilisi nullam vehicula ipsum a arcu cursus vitae congue. Dictum fusce ut placerat orci. Semper viverra nam libero justo laoreet sit amet.</p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col xxl={3} xl={4} md={6}>
                            <Card className="card-border card-int mb-4">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="avatar avatar-sm avatar-logo">
                                            <span className="initial-wrap">
                                                <Image src={symbolAvatar10} alt="logo" />
                                            </span>
                                        </div>
                                        <Button variant="outline-secondary" className="btn-block flex-grow-0 flex-shrink-0 flex-basis-0">connect</Button>
                                    </div>
                                    <div className="app-name">Medium</div>
                                    <p className="p-sm multine-ellipsis">Purus viverra accumsan in nisl nisi scelerisque. Quam vulputate dignissim suspendisse in est ante. Est ultricies integer quis auctor elit sed.</p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col xxl={3} xl={4} md={6}>
                            <Card className="card-border card-int mb-4">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="avatar avatar-sm avatar-logo">
                                            <span className="initial-wrap">
                                                <Image src={symbolAvatar12} alt="logo" />
                                            </span>
                                        </div>
                                        <Button variant="primary" className="btn-block flex-grow-0 flex-shrink-0 flex-basis-0">connected</Button>
                                    </div>
                                    <div className="app-name">Figma</div>
                                    <p className="p-sm multine-ellipsis">Viverra nam libero justo laoreet sit amet cursus sit amet. Faucibus vitae aliquet nec ullamcorper.</p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col xxl={3} xl={4} md={6}>
                            <Card className="card-border card-int mb-4">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="avatar avatar-sm avatar-logo">
                                            <span className="initial-wrap">
                                                <Image src={symbolAvatar9} alt="logo" />
                                            </span>
                                        </div>
                                        <Button variant="primary" className="btn-block flex-grow-0 flex-shrink-0 flex-basis-0">connected</Button>
                                    </div>
                                    <div className="app-name">Propswala</div>
                                    <p className="p-sm multine-ellipsis">Ac ut consequat semper viverra nam libero justo laoreet sit. Consectetur adipiscing elit duis tristique sollicitudin nibh sit amet commodo.</p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col xxl={3} xl={4} md={6}>
                            <Card className="card-border card-int mb-4">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="avatar avatar-sm avatar-logo">
                                            <span className="initial-wrap">
                                                <Image src={symbolAvatar7} alt="logo" />
                                            </span>
                                        </div>
                                        <Button variant="primary" className="btn-block flex-grow-0 flex-shrink-0 flex-basis-0">connected</Button>
                                    </div>
                                    <div className="app-name">Icons8</div>
                                    <p className="p-sm multine-ellipsis">Laoreet suspendisse interdum consectetur libero id faucibus. Egestas pretium aenean pharetra magna ac placerat vestibulum lectus mauris. </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col xxl={3} xl={4} md={6}>
                            <Card className="card-border card-int mb-4">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="avatar avatar-sm avatar-logo">
                                            <span className="initial-wrap">
                                                <Image src={symbolAvatar6} alt="logo" />
                                            </span>
                                        </div>
                                        <Button variant="outline-secondary" className="btn-block flex-grow-0 flex-shrink-0 flex-basis-0">connect</Button>
                                    </div>
                                    <div className="app-name">Behance</div>
                                    <p className="p-sm multine-ellipsis">Tellus in hac habitasse platea dictumst vestibulum rhoncus est pellentesque. Elit at imperdiet dui accumsan sit. Condimentum lacinia.</p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col xxl={3} xl={4} md={6}>
                            <Card className="card-border card-int mb-4">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="avatar avatar-sm avatar-logo">
                                            <span className="initial-wrap">
                                                <Image src={symbolAvatar10} alt="logo" />
                                            </span>
                                        </div>
                                        <Button variant="outline-secondary" className="btn-block flex-grow-0 flex-shrink-0 flex-basis-0">connect</Button>
                                    </div>
                                    <div className="app-name">Medium</div>
                                    <p className="p-sm multine-ellipsis">Venenatis tellus in metus vulputate eu scelerisque felis imperdiet proin. Tortor pretium viverra suspendisse potenti nullam ac tortor vitae.</p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col xxl={3} xl={4} md={6}>
                            <Card className="card-border card-int mb-4">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="avatar avatar-sm avatar-logo">
                                            <span className="initial-wrap">
                                                <Image src={symbolAvatar11} alt="logo" />
                                            </span>
                                        </div>
                                        <Button variant="outline-secondary" className="btn-block flex-grow-0 flex-shrink-0 flex-basis-0">connect</Button>
                                    </div>
                                    <div className="app-name">Node Js</div>
                                    <p className="p-sm multine-ellipsis">Facilisi nullam vehicula ipsum a arcu cursus vitae congue. Dictum fusce ut placerat orci. Semper viverra nam libero justo laoreet sit amet. </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col xxl={3} xl={4} md={6}>
                            <Card className="card-border card-int mb-4">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="avatar avatar-sm avatar-logo">
                                            <span className="initial-wrap">
                                                <Image src={symbolAvatar8} alt="logo" />
                                            </span>
                                        </div>
                                        <Button variant="outline-secondary" className="btn-block flex-grow-0 flex-shrink-0 flex-basis-0">connect</Button>
                                    </div>
                                    <div className="app-name">Indian Type Factory</div>
                                    <p className="p-sm multine-ellipsis">Purus viverra accumsan in nisl nisi scelerisque. Quam vulputate dignissim suspendisse in est ante. Est ultricies integer quis auctor elit sed. </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col xxl={3} xl={4} md={6}>
                            <Card className="card-border card-int mb-4">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="avatar avatar-sm avatar-logo">
                                            <span className="initial-wrap">
                                                <Image src={symbolAvatar5} alt="logo" />
                                            </span>
                                        </div>
                                        <Button variant="primary" className="btn-block flex-grow-0 flex-shrink-0 flex-basis-0">connected</Button>
                                    </div>
                                    <div className="app-name">City Deals</div>
                                    <p className="p-sm multine-ellipsis">Viverra nam libero justo laoreet sit amet cursus sit amet. Faucibus vitae aliquet nec ullamcorper. </p>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col xxl={3} xl={4} md={6}>
                            <Card className="card-border card-int mb-4">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <div className="avatar avatar-sm avatar-logo">
                                            <span className="initial-wrap">
                                                <Image src={symbolAvatar13} alt="logo" />
                                            </span>
                                        </div>
                                        <Button variant="outline-secondary" className="btn-block flex-grow-0 flex-shrink-0 flex-basis-0">connect</Button>
                                    </div>
                                    <div className="app-name">Sketch</div>
                                    <p className="p-sm multine-ellipsis">Id diam maecenas ultricies mi eget mauris. At consectetur lorem donec massa sapien faucibus et.</p>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </SimpleBar>
        </div>

    )
}

export default Body
