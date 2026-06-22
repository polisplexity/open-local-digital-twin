import Link from 'next/link';
import classNames from 'classnames';
import { Button } from 'react-bootstrap';
import { ChevronDown, ChevronLeft, ChevronUp } from 'react-feather';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

const Header = ({ toggleSidebar, show }) => {

    const { states, dispatch } = useGlobalStateContext();

    return (
        <header className="invoice-header">
            <div className="d-flex align-items-center">
                <Button as={Link} href="create-invoice" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                    <span className="icon">
                        <span className="feather-icon">
                            <ChevronLeft />
                        </span>
                    </span>
                </Button>
                <div className="v-separator d-sm-inline-block d-none" />
                <a href="#" className="invoiceapp-title link-dark ms-1 ms-sm-0">
                    <h1>Template Preview</h1>
                </a>
            </div>
            <div className="invoice-options-wrap">
                <Button variant="soft-primary" as={Link} href="/apps/invoices/create-invoice" className="flex-shrink-0 d-md-inline-block d-none">Start with Template</Button>
                <div className="v-separator d-md-inline-block d-none" />
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

export default Header;
