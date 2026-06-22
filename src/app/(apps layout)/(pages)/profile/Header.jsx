import { Dropdown, Form, Nav } from 'react-bootstrap';
import { MoreVertical } from 'react-feather';

const Header = () => {
    return (
        <header className="profile-header">
            <Nav defaultActiveKey="tab1" as="ul" variant="tabs" className="nav-line nav-icon nav-light h-100 d-md-flex d-none">
                <Nav.Item as="li">
                    <Nav.Link eventKey="tab1" className="d-flex align-items-center h-100">
                        <span className="nav-link-text">Profile</span>
                    </Nav.Link>
                </Nav.Item>
                <Nav.Item as="li">
                    <Nav.Link eventKey="tab2" className="d-flex align-items-center h-100">
                        <span className="nav-link-text">Network</span>
                    </Nav.Link>
                </Nav.Item>
                <Nav.Item as="li">
                    <Nav.Link eventKey="tab3" className="d-flex align-items-center h-100">
                        <span className="nav-link-text">Subscription</span>
                    </Nav.Link>
                </Nav.Item>
            </Nav>
            <Form.Select className="mw-200p d-md-none d-flex me-2">
                <option value={1}>Profile</option>
                <option value={2}>Teams</option>
                <option value={3}>Projects</option>
                <option value={4}>Connection</option>
            </Form.Select>
            <div className="profile-options-wrap">
                <Dropdown>
                    <Dropdown.Toggle variant="soft-secondary" className="btn-icon no-caret">
                        <span className="icon">
                            <span className="feather-icon">
                                <MoreVertical />
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
        </header>
    )
}

export default Header
