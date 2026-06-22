import classNames from 'classnames';
import { Button, Form } from 'react-bootstrap'
import { ChevronDown, ChevronUp } from 'react-feather';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

const Header = ({ toggleSidebar, show }) => {
    const { states, dispatch } = useGlobalStateContext();

    return (
        <header className="integrations-header">
            <div className="d-flex align-items-center flex-1">
                <a href="#" className="integrationsapp-title link-dark flex-shrink-0">
                    <h1>All Apps</h1>
                </a>
                <Form className="ms-3 w-xl-30 d-md-block d-none" role="search">
                    <Form.Control type="text" placeholder="Search by categories, name, tag" />
                </Form>
            </div>
            <div className="integrations-options-wrap">
                <Form.Select className="me-2">
                    <option value={0}>Popular</option>
                    <option value={1}>New Apps</option>
                    <option value={2}>Recommended</option>
                    <option value={3}>Developer&apos;s Tools</option>
                </Form.Select>
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