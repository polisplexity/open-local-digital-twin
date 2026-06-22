import Image from 'next/image';
import classNames from 'classnames';
import { Draggable } from '@hello-pangea/dnd';
import { Card, Dropdown } from 'react-bootstrap';
import { AlertTriangle, ChevronLeft, ChevronRight, Monitor, Phone } from 'react-feather';

const Task = (props) => {
    return (
        <>
            <Draggable
                draggableId={props.task.id}
                index={props.index}
            >
                {(provided, snapshot) => (

                    <Card
                        className={classNames("card-border spipeline-card", { "lost-deal": props.task.status === "lost" }, { "won-deal": props.task.status === "won" })}
                        key={props.task.id}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                    // isDragging={snapshot.isDragging}
                    >
                        <Card.Body>
                            <div className="card-action-wrap">
                                <Dropdown>
                                    <Dropdown.Toggle
                                        variant={classNames(
                                            { "light": props.task.growth === "normal" || !props.task.growth },
                                            { "primary": props.task.growth === "high" },
                                            { "warning": props.task.growth === "average" },
                                            { "danger": props.task.growth === "low" },
                                        )}
                                        size="xs"
                                        className="btn-icon btn-rounded no-caret"
                                    >
                                        <span className="icon">
                                            <span className="feather-icon">
                                                {(props.task.growth === "normal" || props.task.growth === "high" || !props.task.growth) && <ChevronRight />}
                                                {props.task.growth === "low" && <ChevronLeft />}
                                                {props.task.growth === "average" && <AlertTriangle />}
                                            </span>
                                        </span>
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu align="end" className="dropdown-menu-icon-text spipeline-dropdown">
                                        <Dropdown.Header className="text-muted">Scheduled activity</Dropdown.Header>
                                        <Dropdown.Item>
                                            <div className="d-flex align-items-center">
                                                <div className="me-3 position-relative text-disabled">
                                                    <i className="ri-checkbox-blank-circle-line" />
                                                </div>
                                                <div className="mw-175p">
                                                    <div className="h6 mb-0 text-truncate">Call arranged with James</div>
                                                    <p className="dropdown-item-text text-truncate text-danger">Yesterday 4:30 pm</p>
                                                </div>
                                                <div className="avatar avatar-icon avatar-xxs avatar-soft-danger avatar-rounded ms-3">
                                                    <span className="initial-wrap">
                                                        <span className="feather-icon"><Phone /> </span>
                                                    </span>
                                                </div>
                                            </div>
                                        </Dropdown.Item>
                                        <Dropdown.Item>
                                            <div className="d-flex align-items-center">
                                                <div className="me-3 position-relative text-disabled">
                                                    <i className="ri-checkbox-blank-circle-line" />
                                                </div>
                                                <div className="mw-175p">
                                                    <div className="h6 mb-0 text-truncate">Call arranged with Locus</div>
                                                    <p className="dropdown-item-text text-truncate">21 Jan 20, 12:40 pm</p>
                                                </div>
                                                <div className="avatar avatar-icon avatar-xxs avatar-light avatar-rounded ms-3">
                                                    <span className="initial-wrap">
                                                        <span className="feather-icon"><Phone /> </span>
                                                    </span>
                                                </div>
                                            </div>
                                        </Dropdown.Item>
                                        <Dropdown.Item>
                                            <div className="d-flex align-items-center">
                                                <div className="me-3 position-relative text-disabled">
                                                    <i className="ri-checkbox-blank-circle-line" />
                                                </div>
                                                <div className="mw-175p">
                                                    <div className="h6 mb-0 text-truncate">Demo arranged with Locus strong</div>
                                                    <p className="dropdown-item-text text-truncate">9 Nov 20, 9:40 am</p>
                                                </div>
                                                <div className="avatar avatar-icon avatar-xxs avatar-soft-primary avatar-rounded ms-3">
                                                    <span className="initial-wrap">
                                                        <span className="feather-icon"><Monitor /> </span>
                                                    </span>
                                                </div>
                                            </div>
                                        </Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>
                            <div className="media">
                                <div className="media-head">
                                    {props.task.symbolLogo && <div className="avatar avatar-logo avatar-rounded">
                                        <span className="initial-wrap">
                                            <Image src={props.task.symbolLogo} alt="logo" />
                                        </span>
                                    </div>}
                                    {props.task.logo && <div className="avatar avatar-rounded">
                                        <Image src={props.task.logo} alt="user" className="avatar-img" />
                                    </div>}
                                    {props.task.initLogo && <div className={classNames("avatar avatar-rounded", (props.task.logoBg))}>
                                        <span className="initial-wrap">{props.task.initLogo}</span>
                                    </div>}
                                </div>
                                <div className="media-body">
                                    <div className="brand-name">{props.task.brandName}</div>
                                    <div className="price-estimation">{props.task.price}</div>
                                    <div className="brand-cat">{props.task.type}</div>
                                    <div className="media align-items-center">
                                        <div className="media-head">
                                            <div className="avatar avatar-xs avatar-rounded d-4 d-flex">
                                                <Image src={props.task.avatar} alt="user" className="avatar-img" />
                                            </div>
                                        </div>
                                        <div className="media-body">
                                            <p className={classNames({ "text-danger": props.task.status === "lost" })} >{props.task.lastUsed}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card.Body>
                    </Card>

                )}
            </Draggable>
        </>
    )
}

export default Task
