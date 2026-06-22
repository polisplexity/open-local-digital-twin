import { useEffect } from 'react';
import { Button, ButtonGroup, Card, Col, Form, Row } from 'react-bootstrap';
import HkBadge from '@/components/@hk-badge/@hk-badge';
import AudienceReviewChart from './ChartData/AudienceReviewChart';

const AudienceReviewCard = () => {
    useEffect(() => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event('resize'))
        }
    }, [])

    return (
        <Card className="card-border mb-0 h-100">
            <Card.Header className="card-header-action">
                <h6>Audience Overview</h6>
                <div className="card-action-wrap">
                    <ButtonGroup className="d-lg-flex d-none" aria-label="Basic outlined example">
                        <Button variant="outline-light" className="active">All</Button>
                        <Button variant="outline-light">Sessions</Button>
                        <Button variant="outline-light">Source</Button>
                        <Button variant="outline-light">Referrals</Button>
                    </ButtonGroup>
                    <Form.Select className="d-lg-none d-flex">
                        <option value={1}>All</option>
                        <option value={2}>Sessions</option>
                        <option value={3}>Source</option>
                        <option value={4}>Referrals</option>
                    </Form.Select>
                </div>
            </Card.Header>
            <Card.Body>
                <AudienceReviewChart />
                <div className="separator-full mt-5" />
                <div className="flex-grow-1 ms-lg-3">
                    <Row>
                        <Col xxl={3} sm={6} className="mb-3">
                            <span className="d-block fw-medium fs-7">Users</span>
                            <div className="d-flex align-items-center">
                                <span className="d-block fs-4 fw-medium text-dark mb-0">8.8k</span>
                                <HkBadge bg="success" size="sm" soft className="ms-1" >
                                    <i className="bi bi-arrow-up" /> 7.5%
                                </HkBadge>
                            </div>
                        </Col>
                        <Col xxl={3} sm={6} className="mb-3">
                            <span className="d-block fw-medium fs-7">Sessions</span>
                            <div className="d-flex align-items-center">
                                <span className="d-block fs-4 fw-medium text-dark mb-0">18.2k</span>
                                <HkBadge bg="success" size="sm" soft className="ms-1" >
                                    <i className="bi bi-arrow-up" /> 7.2%
                                </HkBadge>
                            </div>
                        </Col>
                        <Col xxl={3} sm={6} className="mb-3">
                            <span className="d-block fw-medium fs-7">Bounce rate</span>
                            <div className="d-flex align-items-center">
                                <span className="d-block fs-4 fw-medium text-dark mb-0">46.2%</span>
                                <HkBadge bg="danger" size="sm" soft className="ms-1" >
                                    <i className="bi bi-arrow-down" /> 0.2%
                                </HkBadge>
                            </div>
                        </Col>
                        <Col xxl={3} sm={6}>
                            <span className="d-block fw-medium fs-7">Session duration</span>
                            <div className="d-flex align-items-center">
                                <span className="d-block fs-4 fw-medium text-dark mb-0">4m 24s</span>
                                <HkBadge bg="success" size="sm" soft className="ms-1" >
                                    <i className="bi bi-arrow-up" /> 10.8%
                                </HkBadge>
                            </div>
                        </Col>
                    </Row>
                </div>
            </Card.Body>
        </Card>
    )
}

export default AudienceReviewCard
