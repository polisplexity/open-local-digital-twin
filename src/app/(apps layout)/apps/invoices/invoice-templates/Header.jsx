import classNames from 'classnames';
import { Button } from 'react-bootstrap';
import { ChevronDown, ChevronUp } from 'react-feather';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

const Header = ({ toggleSidebar, show }) => {
    const { states, dispatch } = useGlobalStateContext();

    return (
        <header className="invoice-header">
            <div className="d-flex align-items-center">
                <a href="#" className="invoiceapp-title link-dark">
                    <h1>Invoice Templates</h1>
                </a>
            </div>
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
            <div className={classNames("hk-sidebar-togglable", { "active": !show })} onClick={toggleSidebar} />
        </header>
    )
}
export default Header;