import classNames from 'classnames';
import { Button, Dropdown, Form } from 'react-bootstrap';
import { AlignCenter, ChevronDown, ChevronUp, Clock, Droplet, List } from 'react-feather';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

const TodoHeader = ({ toggleSidebar, showSidebar, toggleInfo }) => {

    const { states, dispatch } = useGlobalStateContext();

    return (
        <header className="todo-header">
            <div className="d-flex align-items-center">
                <Dropdown>
                    <Dropdown.Toggle as="a" href="#" className="todoapp-title link-dark" >
                        <h1>All Tasks</h1>
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <AlignCenter />
                            </span><span>All Tasks</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <List />
                            </span><span>My Tasks</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Clock />
                            </span><span>Pending Tasks</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Droplet />
                            </span><span>In Progress Tasks</span>
                        </Dropdown.Item>
                        <Dropdown.Divider as="div" />
                        <Dropdown.Item>Urgent Priority</Dropdown.Item>
                        <Dropdown.Item>High Priority</Dropdown.Item>
                        <Dropdown.Item>Low Priority</Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            </div>
            <div className="todo-options-wrap">
                <Form className="d-sm-block d-none" role="search">
                    <Form.Control type="text" placeholder="Search tasks" />
                </Form>
                <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover hk-navbar-togglable" onClick={() => dispatch({ type: 'top_nav_toggle' })} >
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
            <div className={classNames("hk-sidebar-togglable", { "active": showSidebar })} onClick={toggleSidebar} />
        </header>
    )
}


export default TodoHeader;