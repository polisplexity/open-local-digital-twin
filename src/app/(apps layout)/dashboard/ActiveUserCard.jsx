import Image from 'next/image';
import { Button, Card, Col, Row } from 'react-bootstrap';
import HkProgressBar from '@/components/@hk-progressbar/@hk-progressbar';
import ActiveUserMap from './ChartData/ActiveUserMap';

//Images
import UsFlag from '@/styles/fonts/flags/4x3/us.svg';
import IndianFlag from '@/styles/fonts/flags/4x3/in.svg';
import UkFlag from '@/styles/fonts/flags/4x3/gb.svg';
import AustralianFlag from '@/styles/fonts/flags/4x3/au.svg';
import CanadianFlag from '@/styles/fonts/flags/4x3/ca.svg';

const ActiveUserCard = () => {
    return (
        <Card className="card-border mb-0 h-100">
            <Card.Header className="card-header-action">
                <h6>Active users</h6>
                <div className="card-action-wrap">
                    <Button variant="outline-light">Real time chart</Button>
                </div>
            </Card.Header>
            <Card.Body>
                <Row>
                    <Col md={8} >
                        <ActiveUserMap />
                    </Col>
                    <Col md={4}>
                        <div className="media align-items-center mb-3">
                            <div className="media-head me-3">
                                <div className="avatar avatar-xxs avatar-rounded">
                                    <Image src={UsFlag} alt="user" className="avatar-img" />
                                </div>
                            </div>
                            <div className="media-body">
                                <HkProgressBar.Wrapper>
                                    <HkProgressBar.Label className="mb-0">United States</HkProgressBar.Label>
                                    <div className="d-flex align-items-center">
                                        <HkProgressBar now={80} variant="blue-dark-3" rounded size="xs" className="flex-1" />
                                        <div className="fs-8 mnw-30p ms-3">80%</div>
                                    </div>
                                </HkProgressBar.Wrapper>
                            </div>
                        </div>
                        <div className="media align-items-center mb-3">
                            <div className="media-head me-3">
                                <div className="avatar avatar-xxs avatar-rounded">
                                    <Image src={IndianFlag} alt="user" className="avatar-img" />
                                </div>
                            </div>
                            <div className="media-body">
                                <HkProgressBar.Wrapper>
                                    <HkProgressBar.Label className="mb-0">India</HkProgressBar.Label>
                                    <div className="d-flex align-items-center">
                                        <HkProgressBar variant="blue" rounded size="xs" className="flex-1" now={50} />
                                        <div className="fs-8 mnw-30p ms-3">50%</div>
                                    </div>
                                </HkProgressBar.Wrapper>
                            </div>
                        </div>
                        <div className="media align-items-center mb-3">
                            <div className="media-head me-3">
                                <div className="avatar avatar-xxs avatar-rounded">
                                    <Image src={UkFlag} alt="user" className="avatar-img" />
                                </div>
                            </div>
                            <div className="media-body">
                                <HkProgressBar.Wrapper>
                                    <HkProgressBar.Label className="mb-0">United Kingdom</HkProgressBar.Label>
                                    <div className="d-flex align-items-center">
                                        <HkProgressBar variant="primary" rounded size="xs" className="flex-1" now={30} />
                                        <div className="fs-8 mnw-30p ms-3">30%</div>
                                    </div>
                                </HkProgressBar.Wrapper>
                            </div>
                        </div>
                        <div className="media align-items-center mb-3">
                            <div className="media-head me-3">
                                <div className="avatar avatar-xxs avatar-rounded">
                                    <Image src={AustralianFlag} alt="user" className="avatar-img" />
                                </div>
                            </div>
                            <div className="media-body">
                                <HkProgressBar.Wrapper>
                                    <HkProgressBar.Label className="mb-0">Australia</HkProgressBar.Label>
                                    <div className="d-flex align-items-center">
                                        <HkProgressBar variant="grey-dark-2" rounded size="xs" className="flex-1" now={15} />
                                        <div className="fs-8 mnw-30p ms-3">15%</div>
                                    </div>
                                </HkProgressBar.Wrapper>
                            </div>
                        </div>
                        <div className="media align-items-center">
                            <div className="media-head me-3">
                                <div className="avatar avatar-xxs avatar-rounded">
                                    <Image src={CanadianFlag} alt="user" className="avatar-img" />
                                </div>
                            </div>
                            <div className="media-body">
                                <HkProgressBar.Wrapper>
                                    <HkProgressBar.Label className="mb-0">Canada</HkProgressBar.Label>
                                    <div className="d-flex align-items-center">
                                        <HkProgressBar variant="grey" rounded size="xs" className="flex-1" now={10} />
                                        <div className="fs-8 mnw-30p ms-3">10%</div>
                                    </div>
                                </HkProgressBar.Wrapper>
                            </div>
                        </div>
                    </Col>
                </Row>
            </Card.Body>
        </Card>
    )
}

export default ActiveUserCard
