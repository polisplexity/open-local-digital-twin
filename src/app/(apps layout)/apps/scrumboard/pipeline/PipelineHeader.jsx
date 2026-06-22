import { Button, ButtonGroup, Form } from 'react-bootstrap';
import { Calendar, ChevronDown, ChevronUp, List, Trello } from 'react-feather';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

const PipelineHeader = ({ addNewDeal }) => {
    const { states, dispatch } = useGlobalStateContext();

    return (
        <header className="taskboard-header">
            <div className="d-flex align-items-center flex-1">
                <a className="taskboardapp-title link-dark" href="#some">
                    <h1>
                        Sales Pipeline
                    </h1>
                </a>
                <Button variant="primary" className="ms-3 d-xxl-inline-block d-none flex-shrink-0" onClick={addNewDeal}>Add Deal</Button>
                <ButtonGroup className="d-xxl-inline-flex d-none mx-3">
                    <Button variant="outline-light" className="btn-icon">
                        <span className="icon">
                            <span className="feather-icon"><Trello />
                            </span>
                        </span>
                    </Button>
                    <Button variant="outline-light" className="btn-icon">
                        <span className="icon">
                            <span className="feather-icon">
                                <List />
                            </span>
                        </span>
                    </Button>
                    <Button variant="outline-light" className="btn-icon">
                        <span className="icon">
                            <span className="feather-icon">
                                <Calendar />
                            </span>
                        </span>
                    </Button>
                </ButtonGroup>
            </div>
            <div className="d-md-flex flex-shrink-0 mx-3 d-none">
                <div className="d-flex align-items-center">
                    <span className="d-md-inline d-none">Pipeline Value:</span>
                    <span className="text-dark fs-5 fw-medium ps-2">$23,706</span>
                </div>
                <div className="v-separator" />
                <div className="d-flex align-items-center">
                    <span className="d-md-inline d-none">Total Value:</span>
                    <span className="text-dark fs-5 fw-medium ps-2">$100,000</span>
                </div>
            </div>
            <div className="taskboard-options-wrap flex-1 justify-content-end">
                <Form className="leave-search  d-lg-inline-block d-none" role="search">
                    <Form.Control type="text" placeholder="Search cards" />
                </Form>
                <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover hk-navbar-togglable d-sm-inline-block d-none" onClick={() => dispatch({ type: 'top_nav_toggle' })} >
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
        </header>
    )
}

export default PipelineHeader;