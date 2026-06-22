import { Card, Dropdown } from 'react-bootstrap';
import { MoreVertical } from 'react-feather';
import HkBadge from '@/components/@hk-badge/@hk-badge';
import ReturningCustomerChart from './ChartData/ReturningCustomerChart';

const ReturningCustomersCard = () => {
    return (
        <Card className="card-border mb-0  h-100">
            <Card.Header className="card-header-action">
                <h6>Returning Customers</h6>
                <div className="card-action-wrap">
                    <Dropdown className="inline-block" >
                        <Dropdown.Toggle variant='transparent' className="btn-icon btn-rounded btn-flush-dark flush-soft-hover no-caret" id="dropdown-basic1">
                            <span className="icon">
                                <span className="feather-icon">
                                    <MoreVertical />
                                </span>
                            </span>
                        </Dropdown.Toggle>
                        <Dropdown.Menu align="end">
                            <Dropdown.Item href="#/action-1">Action</Dropdown.Item>
                            <Dropdown.Item href="#/action-2">Another action</Dropdown.Item>
                            <Dropdown.Item href="#/action-3">Something else here</Dropdown.Item>
                            <Dropdown.Divider as="div" />
                            <Dropdown.Item href="#/action-4">Separated link</Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </div>
            </Card.Header>
            <Card.Body className="text-center">
                <ReturningCustomerChart />
                <div className="d-inline-block mt-4">
                    <div className="mb-4">
                        <span className="d-block badge-status lh-1">
                            <HkBadge bg="primary" className="badge-indicator badge-indicator-nobdr d-inline-block" />
                            <span className="badge-label d-inline-block">Organic</span>
                        </span>
                        <span className="d-block text-dark fs-5 fw-medium mb-0 mt-1">$243.50</span>
                    </div>
                    <div>
                        <span className="badge-status lh-1">
                            <HkBadge bg="primary-light-2" className="badge-indicator badge-indicator-nobdr" />
                            <span className="badge-label">Marketing</span>
                        </span>
                        <span className="d-block text-dark fs-5 fw-medium mb-0 mt-1">$1469</span>
                    </div>
                </div>
            </Card.Body>
        </Card>
    )
}

export default ReturningCustomersCard
