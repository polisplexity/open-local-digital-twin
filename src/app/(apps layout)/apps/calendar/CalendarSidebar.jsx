import { useState } from 'react';
import SimpleBar from 'simplebar-react';
import DatePicker from 'react-datepicker';
import { Archive, Bell, Book, Calendar, Plus, Settings } from 'react-feather';
import { Badge, Button, Dropdown, Form, Nav } from 'react-bootstrap';
import AddCategory from './AddCategory';
import SetReminder from './SetReminder';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import "react-datepicker/dist/react-datepicker.css";

const CalendarSidebar = ({ createNewEvent }) => {
    const [addCategory, setAddCategory] = useState(false);
    const [reminder, setReminder] = useState(false);
    const [startDate, setStartDate] = useState(new Date());
    const onChange = (dates) => {
        const [start] = dates;
        setStartDate(start);
    };
    return (
        <>
            <nav className="calendarapp-sidebar">
                <SimpleBar className="nicescroll-bar">
                    <div className="menu-content-wrap">
                        <Dropdown>
                            <Dropdown.Toggle variant="primary" className="btn-rounded btn-block">Create</Dropdown.Toggle>
                            <Dropdown.Menu>
                                <Dropdown.Item onClick={createNewEvent} >
                                    <span className="feather-icon dropdown-icon">
                                        <Calendar />
                                    </span>
                                    <span>Create an Event</span>
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => setReminder(!reminder)} >
                                    <span className="feather-icon dropdown-icon">
                                        <Bell />
                                    </span>
                                    <span>Set a Reminder</span>
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                        <div className="text-center mt-4">
                            <div id="inline_calendar" className="d-inline-block">
                                <DatePicker
                                    selected={startDate}
                                    onChange={onChange}
                                    dateFormatCalendar={"MMM yyyy"}
                                    selectsRange
                                    inline
                                />
                            </div>
                        </div>
                        <div className="separator separator-light" />
                        <div className="title-sm text-primary">Upcoming Events</div>
                        <div className="upcoming-event-wrap">
                            <Nav as="ul" className="nav-light navbar-nav flex-column">
                                <Nav.Item as="li">
                                    <Nav.Link>
                                        <div className="d-flex align-items-center">
                                            <Badge bg="violet" className="badge-indicator badge-indicator-lg me-2" />
                                            <span className="event-time">Today, 5:00 onwards</span>
                                        </div>
                                        <div className="event-name">Jampack Team Meet</div>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link>
                                        <div className="d-flex align-items-center">
                                            <Badge bg="primary" className="badge-indicator badge-indicator-lg me-2" />
                                            <span className="event-time">Tomorrow, 2:35 PM</span>
                                        </div>
                                        <div className="event-name">Indigo Flight to Indonesia</div>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link>
                                        <div className="d-flex align-items-center">
                                            <Badge bg="warning" className="badge-indicator badge-indicator-lg me-2" />
                                            <span className="event-time">24 Jul, 9:30 AM</span>
                                        </div>
                                        <div className="event-name">Awwwards Conference</div>
                                    </Nav.Link>
                                </Nav.Item>
                            </Nav>
                        </div>
                        <div className="separator separator-light" />
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <div className="title-sm text-primary mb-0">Categories</div>
                            <Button size="xs" variant="light" className="btn-icon btn-rounded" onClick={() => setAddCategory(!addCategory)} >
                                <HkTooltip id="tooltip1" placement="top" title="Add Category" >
                                    <span className="feather-icon">
                                        <Plus />
                                    </span>
                                </HkTooltip>
                            </Button>
                        </div>
                        <div className="categories-wrap">
                            <Form.Check
                                id="customChecksc1"
                                type="checkbox"
                                label="Meetings"
                                defaultChecked
                            />
                            <Form.Check
                                id="customChecksc2"
                                type="checkbox"
                                label="Flights"
                                defaultChecked
                            />
                            <Form.Check
                                id="customChecksc3"
                                type="checkbox"
                                label="Birthday"
                                defaultChecked
                            />
                            <Form.Check
                                id="customChecksc4"
                                type="checkbox"
                                label="Conferences"
                            />
                        </div>
                    </div>
                </SimpleBar>
                {/*Sidebar Fixnav*/}
                <div className="calendarapp-fixednav">
                    <div className="hk-toolbar">
                        <Nav className="nav-light">
                            <Nav.Item className="nav-link">
                                <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                                    <HkTooltip id="tooltip2" placement="top" title="Settings" >
                                        <span className="icon">
                                            <span className="feather-icon">
                                                <Settings />
                                            </span>
                                        </span>
                                    </HkTooltip>
                                </Button>
                            </Nav.Item>
                            <Nav.Item className="nav-link">
                                <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                                    <HkTooltip id="tooltip3" placement="top" title="Archive" >
                                        <span className="icon">
                                            <span className="feather-icon">
                                                <Archive />
                                            </span>
                                        </span>
                                    </HkTooltip>
                                </Button>
                            </Nav.Item>
                            <Nav.Item className="nav-link">
                                <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                                    <HkTooltip id="tooltip2" placement="top" title="Help" >
                                        <span className="icon">
                                            <span className="feather-icon">
                                                <Book />
                                            </span>
                                        </span>
                                    </HkTooltip>
                                </Button>
                            </Nav.Item>
                        </Nav>
                    </div>
                </div>
            </nav>

            {/* Add Category */}
            <AddCategory show={addCategory} hide={() => setAddCategory(!addCategory)} />
            {/* New Event */}
            <SetReminder show={reminder} hide={() => setReminder(!reminder)} />
        </>
    )
}

export default CalendarSidebar;
