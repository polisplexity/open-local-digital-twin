import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import classNames from 'classnames';
import { Button, ButtonGroup, Dropdown, Form, InputGroup } from 'react-bootstrap';
import { ChevronDown, ChevronUp, Columns, Maximize, Minimize, Plus, Sidebar, Star } from 'react-feather';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

//Images
import avatar2 from '@/assets/img/avatar2.jpg';
import avatar8 from '@/assets/img/avatar8.jpg';
import avatar13 from '@/assets/img/avatar13.jpg';


const AppHeader = ({ toggleSidebar, showSidebar }) => {
    const { states, dispatch } = useGlobalStateContext();
    const [isFullscreen, setIsFullscreen] = useState(false);

    const fullScreen = (e) => {
        e.preventDefault();
        setIsFullscreen(!isFullscreen);

        if (!isFullscreen) {
            document.body.requestFullscreen();
        }
        else {
            document.exitFullscreen();
        }
    }

    return (
        <header className="todo-header">
            <div className="d-flex align-items-center flex-1">
                <div className="d-flex">
                    <Link href="#" className="todoapp-title link-dark">
                        <h1>
                            Jampack
                            <span className="task-star marked">
                                <span className="feather-icon">
                                    <Star />
                                </span>
                            </span>
                        </h1>
                    </Link>
                    <div className="mx-3">
                        <InputGroup>
                            <span className="input-affix-wrapper">
                                <span className="input-prefix"><i className="ri-lock-line" /></span>
                                <Form.Select>
                                    <option value={1}>Private Board</option>
                                    <option value={2}>Public Board</option>
                                </Form.Select>
                            </span>
                        </InputGroup>
                    </div>
                </div>
            </div>
            <ButtonGroup className="d-md-inline-flex d-none" role="group" id="modes-filter">
                <Button name="modes" id="qday" variant="outline-light" onClick={() => dispatch({ type: "change_vm", vm: "QuarterDay" })} active={states.todoState.vm === "QuarterDay"} >Quarter Day</Button>
                <Button name="modes" id="hday" variant="outline-light" onClick={() => dispatch({ type: "change_vm", vm: "Half Day" })} active={states.todoState.vm === "Half Day"} >Half Day</Button>
                <Button name="modes" id="day" variant="outline-light" onClick={() => dispatch({ type: "change_vm", vm: "Day" })} active={states.todoState.vm === "Day"}>Day</Button>
                <Button name="modes" id="week" variant="outline-light" onClick={() => dispatch({ type: "change_vm", vm: "Week" })} active={states.todoState.vm === "Week"} >Week</Button>
                <Button name="modes" id="month" variant="outline-light" onClick={() => dispatch({ type: "change_vm", vm: "Month" })} active={states.todoState.vm === "Month"} >Month</Button>
            </ButtonGroup>
            <div className="todo-options-wrap flex-lg-grow-1 flex-lg-shrink-1 flex-basis-0">
                <div className="d-flex ms-auto">
                    <div className="avatar-group avatar-group-overlapped d-xl-flex d-none me-3">
                        <div className="avatar avatar-rounded">
                            <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="Katharine">
                                <Image src={avatar8} alt="user" className="avatar-img" />
                            </HkTooltip>
                        </div>
                        <div className="avatar avatar-rounded">
                            <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="Dean">
                                <Image src={avatar13} alt="user" className="avatar-img" />
                            </HkTooltip>
                        </div>
                        <div className="avatar avatar-xs avatar-soft-danger avatar-rounded">
                            <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="Tom">
                                <span className="initial-wrap">T</span>
                            </HkTooltip>
                        </div>
                        <div className="avatar avatar-rounded">
                            <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="Morgan">
                                <Image src={avatar2} alt="user" className="avatar-img" />
                            </HkTooltip>
                        </div>
                        <div className="avatar avatar-icon avatar-primary avatar-rounded">
                            <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="Tooltip">
                                <span className="initial-wrap"><span className="feather-icon"><Plus /></span></span>
                            </HkTooltip>
                        </div>
                    </div>
                    <div className="v-separator  d-lg-inline-block d-none" />
                    <Dropdown>
                        <Dropdown.Toggle as="a" className="btn btn-icon btn-flush-dark flush-soft-hover no-caret active ms-0  d-lg-inline-block d-none">
                            <span className="icon">
                                <span className="feather-icon">
                                    <Columns />
                                </span>
                            </span>
                        </Dropdown.Toggle>
                        <Dropdown.Menu align="end" className="mnw-0">
                            <Dropdown.Item>
                                <span className="feather-icon dropdown-icon me-0">
                                    <Sidebar />
                                </span>
                            </Dropdown.Item>
                            <Dropdown.Item>
                                <span className="feather-icon dropdown-icon me-0">
                                    <Columns />
                                </span>
                            </Dropdown.Item>
                            <Dropdown.Item>
                                <span className="feather-icon dropdown-icon me-0 icon-flip-y">
                                    <Sidebar />
                                </span>
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                    <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title={isFullscreen ? "Minimize" : "Maximize"}>
                        <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover full-screenapp" onClick={fullScreen} >
                            <span className="icon">
                                <span className="feather-icon">
                                    {isFullscreen ? <Minimize /> : <Maximize />}
                                </span>

                            </span>
                        </Button>
                    </HkTooltip>
                    <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover hk-navbar-togglable d-sm-inline-block d-none" onClick={() => dispatch({ type: "top_nav_toggle" })} >
                        <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="Collapse" >
                            <span className="icon">
                                <span className="feather-icon">
                                    {
                                        states.layoutState.topNavCollapse ? <ChevronDown /> : <ChevronUp />
                                    }
                                </span>
                            </span>
                        </HkTooltip>
                    </Button>
                </div>
            </div>
            <div className={classNames("hk-sidebar-togglable", { "active": showSidebar })} onClick={toggleSidebar} />
        </header>
    )
}


export default AppHeader;