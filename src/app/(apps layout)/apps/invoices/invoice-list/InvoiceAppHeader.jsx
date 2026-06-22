import classNames from 'classnames';
import { Button, Dropdown } from 'react-bootstrap';
import { Archive, ChevronDown, ChevronUp, Edit, ExternalLink, MoreVertical, RefreshCw, Settings, Slash, Star, Trash2, Users } from 'react-feather';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

const InvoiceAppHeader = ({ toggleSidebar, show }) => {
    const { states, dispatch } = useGlobalStateContext();

    return (
        <header className="invoice-header">
            <div className="d-flex align-items-center">
                <Dropdown>
                    <Dropdown.Toggle as="a" href="#" className="invoiceapp-title link-dark">
                        <h1>All invoices</h1>
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Users />
                            </span>
                            <span>All Invoices</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Star />
                            </span>
                            <span>Sent</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Archive />
                            </span>
                            <span>Archive</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Edit />
                            </span>
                            <span>Pending</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Trash2 />
                            </span>
                            <span>Deleted</span>
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            </div>
            <div className="invoice-options-wrap">
                <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret flex-shrink-0 d-lg-inline-block d-none" href="#">
                    <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="Refresh">
                        <span className="icon">
                            <span className="feather-icon">
                                <RefreshCw />
                            </span>
                        </span>
                    </HkTooltip>
                </Button>
                <div className="v-separator d-lg-inline-block d-none" />
                <Dropdown>
                    <Dropdown.Toggle as="a" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret ms-0  d-sm-inline-block d-none">
                        <span className="icon">
                            <span className="feather-icon">
                                <Settings />
                            </span>
                        </span>
                    </Dropdown.Toggle>
                    <Dropdown.Menu align="end">
                        <Dropdown.Item>Manage Contact</Dropdown.Item>
                        <Dropdown.Item>Import</Dropdown.Item>
                        <Dropdown.Item>Export</Dropdown.Item>
                        <div className="dropdown-divider" />
                        <Dropdown.Item>Send Messages</Dropdown.Item>
                        <Dropdown.Item>Delegate Access</Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
                <Dropdown as="a" >
                    <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret">
                        <span className="icon" data-bs-toggle="tooltip" data-placement="top" data-bs-original-title="More">
                            <span className="feather-icon">
                                <MoreVertical />
                            </span>
                        </span>
                    </Dropdown.Toggle>
                    <Dropdown.Menu align="end">
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Star />
                            </span>
                            <span>Stared Contacts</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Archive />
                            </span>
                            <span>Archive Contacts</span>
                        </Dropdown.Item>
                        <div className="dropdown-divider" />
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Slash />
                            </span>
                            <span>Block Content</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <ExternalLink />
                            </span>
                            <span>Feedback</span>
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
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
            <div className={classNames("hk-sidebar-togglable", { "active": !show })} onClick={toggleSidebar} />
        </header>
    )
}


export default InvoiceAppHeader;