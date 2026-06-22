import classNames from 'classnames';
import { Button } from 'react-bootstrap';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'react-feather';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

const EditContactHeader = ({ toggleSidebar, show }) => {
    const { states, dispatch } = useGlobalStateContext();

    return (
        <header className="contact-header">
            <div className="d-flex align-items-center">
                <nav aria-label="breadcrumb">
                    <ol className="breadcrumb  mb-0">
                        <li className="breadcrumb-item"><a href="contact.html">Contacts</a></li>
                        <li className="breadcrumb-item active" aria-current="page">Morgan Freeman</li>
                    </ol>
                </nav>
            </div>
            <div className="contact-options-wrap">
                <div className="d-flex fs-7 align-items-center">1 of 30</div>
                <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover contactapp-info-toggle" href="#" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Previous">
                    <span className="icon">
                        <span className="feather-icon">
                            <ChevronLeft />
                        </span>
                    </span>
                </Button>
                <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover contactapp-info-toggle" href="#" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Next">
                    <span className="icon">
                        <span className="feather-icon">
                            <ChevronRight />
                        </span>
                    </span>
                </Button>
                <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover hk-navbar-togglable" onClick={() => dispatch({ type: "top_nav_toggle" })} >
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
            <div className={classNames("hk-sidebar-togglable", { "active": show })} onClick={toggleSidebar} />
        </header>
    )
}

export default EditContactHeader;