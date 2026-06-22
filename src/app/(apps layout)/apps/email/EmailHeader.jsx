import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';
import { Button, Dropdown } from 'react-bootstrap';
import { Archive, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Flag, Folder, MoreVertical, Printer, Trash2 } from 'react-feather';


const EmailHeader = () => {
    const { states, dispatch } = useGlobalStateContext();
    const BackToContactList = () => {
        dispatch({ type: "open_email" });
        dispatch({ type: "top_nav_toggle" });
    }

    return (
        <header className="email-header">
            <Button as="a" size="sm" href="#" className="btn-icon btn-flush-dark btn-rounded flush-soft-hover back-user-list" onClick={BackToContactList} >
                <span className="icon">
                    <span className="feather-icon">
                        <ChevronLeft />
                    </span>
                </span>
            </Button>
            <div className="email-options-wrap">
                <Button as="a" href="#" className="btn-icon btn-flush-dark btn-rounded flush-soft-hover d-xl-inline-block d-none">
                    <HkTooltip id="tooltip1" placement={states.emailState.topNavCollapse ? "bottom" : "top"} title="Add Flag" >
                        <span className="icon">
                            <span className="feather-icon">
                                <Flag />
                            </span>
                        </span>
                    </HkTooltip>
                </Button>
                <Button as="a" href="#" className="btn-icon btn-flush-dark btn-rounded flush-soft-hover">
                    <HkTooltip id="tooltip2" placement={states.emailState.topNavCollapse ? "bottom" : "top"} title="Archive" >
                        <span className="icon">
                            <span className="feather-icon">
                                <Archive />
                            </span>
                        </span>
                    </HkTooltip>
                </Button>
                <Button as="a" href="#" className="btn-icon btn-flush-dark btn-rounded flush-soft-hover d-xl-inline-block d-none">
                    <HkTooltip id="tooltip3" placement={states.emailState.topNavCollapse ? "bottom" : "top"} title="Folder" >
                        <span className="icon">
                            <span className="feather-icon">
                                <Folder />
                            </span>
                        </span>
                    </HkTooltip>
                </Button>
                <Button as="a" href="#" className="btn-icon btn-flush-dark btn-rounded flush-soft-hover d-xl-inline-block d-none">
                    <HkTooltip id="tooltip4" placement={states.emailState.topNavCollapse ? "bottom" : "top"} title="Snooze" >
                        <span className="icon">
                            <span className="feather-icon">
                                <Clock />
                            </span>
                        </span>
                    </HkTooltip>
                </Button>
                <div className="v-separator" />
                <Button as="a" href="#" className="btn-icon btn-flush-dark btn-rounded flush-soft-hover ms-0">
                    <HkTooltip id="tooltip5" placement={states.emailState.topNavCollapse ? "bottom" : "top"} title="Print" >
                        <span className="icon">
                            <span className="feather-icon">
                                <Printer />
                            </span>
                        </span>
                    </HkTooltip>
                </Button>
                <Button as="a" href="#" className="btn-icon btn-flush-dark btn-rounded flush-soft-hover" >
                    <HkTooltip id="tooltip6" placement={states.emailState.topNavCollapse ? "bottom" : "top"} title="Delete" >
                        <span className="icon">
                            <span className="feather-icon">
                                <Trash2 />
                            </span>
                        </span>
                    </HkTooltip>
                </Button>
            </div>
            <div className="email-options-wrap">
                <Button as="a" href="#" className="btn-icon btn-flush-dark btn-rounded flush-soft-hover dropdown-toggle no-caret d-xl-inline-block d-none">
                    <HkTooltip id="tooltip6" placement={states.emailState.topNavCollapse ? "bottom" : "top"} title="Previous" >
                        <span className="icon">
                            <span className="feather-icon">
                                <ChevronLeft />
                            </span>
                        </span>
                    </HkTooltip>
                </Button>
                <Button as="a" href="#" className="btn-icon btn-flush-dark btn-rounded flush-soft-hover emailapp-info-toggle d-xl-inline-block d-none">
                    <HkTooltip id="tooltip7" placement={states.emailState.topNavCollapse ? "bottom" : "top"} title="Next" >
                        <span className="icon">
                            <span className="feather-icon">
                                <ChevronRight />
                            </span>
                        </span>
                    </HkTooltip>
                </Button>
                <Dropdown className="inline-block ms-1">
                    <Dropdown.Toggle as="a" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover dropdown-toggle no-caret" href="#">
                        <HkTooltip placement={states.emailState.topNavCollapse ? "bottom" : "top"} title="More">
                            <span className="icon">
                                <span className="feather-icon">
                                    <MoreVertical />
                                </span>
                            </span>
                        </HkTooltip>
                    </Dropdown.Toggle>
                    <Dropdown.Menu align="end" >
                        <Dropdown.Item>Mark as read</Dropdown.Item>
                        <Dropdown.Item>Mark as important</Dropdown.Item>
                        <Dropdown.Item>Mute</Dropdown.Item>
                        <Dropdown.Item>Delete</Dropdown.Item>
                        <Dropdown.Item>Block Contact</Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
                <Button as="a" href="#" className="btn-icon btn-flush-dark btn-rounded flush-soft-hover hk-navbar-togglable" onClick={() => dispatch({ type: "top_nav_toggle" })} >
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
        </header >
    )
}


export default EmailHeader;