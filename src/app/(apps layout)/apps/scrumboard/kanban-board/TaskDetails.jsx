import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import * as Icons from 'react-feather';
import { Button, Card, Col, Dropdown, Form, ListGroup, Modal, Nav, Row, Tab } from 'react-bootstrap';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import DateRangePicker from 'react-bootstrap-daterangepicker';
import { nanoid } from 'nanoid';
import classNames from 'classnames';
import HkInlineEdit from '@/components/@hk-editable-component/HkInlineEdit';
import HkDropZone from '@/components/@hk-drop-zone/HkDropZone';
import HkAlert from '@/components/@hk-alert/@hk-alert';
import HkChips from '@/components/@hk-chips/@hk-chips';
import HkCollapse from '@/components/@hk-collapse/@hk-collapse';

//Images
import avatar2 from '@/assets/img/avatar2.jpg';
import avatar3 from '@/assets/img/avatar3.jpg';
import avatar4 from '@/assets/img/avatar4.jpg';
import avatar5 from '@/assets/img/avatar5.jpg';
import avatar6 from '@/assets/img/avatar6.jpg';
import avatar7 from '@/assets/img/avatar7.jpg';
import avatar8 from '@/assets/img/avatar8.jpg';
import avatar13 from '@/assets/img/avatar13.jpg';
import thumb1 from '@/assets/img/avatar1.jpg';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });



const TaskDetails = ({ show, onHide }) => {

    const [recipients, setRecipients] = useState(["Framework", "Html"]);
    const [checkList, setCheckList] = useState([
        { label: "Video conference with canada Team", checked: true, editable: false },
        { label: "Client objective meeting", checked: true, editable: false },
        { label: "Invite jaqueline on video conference", checked: false, editable: false },
    ]);
    const [teamCheckList, setTeamCheckList] = useState([
        { label: "Upgrade dependency on resources", checked: true, editable: false },
        { label: "Invite jaqueline on video conference", checked: false, editable: false },
    ]);

    const [newListLabel1, setnewListLabel1] = useState("");
    const [newListLabel2, setnewListLabel2] = useState("");
    const [showAddButton, setshowAddButton] = useState(true);
    const [newRecipient, setNewRecipient] = useState("");


    //Creating New Chips
    const handleRecipients = () => {
        setRecipients(recipients => recipients.concat(newRecipient));
    }
    const onEnter = ({ key }) => {
        if (key === "Enter") {
            handleRecipients();
            setNewRecipient("");
        }
    }

    //Handle CheckList Checkbox
    const handleCheck = (id, indx) => {
        if (id === "list1") {
            const newCheckList = [...checkList]
            newCheckList[indx].checked = !newCheckList[indx].checked
            setCheckList(newCheckList);
        }
        else if (id === "list2") {
            const newCheckList = [...teamCheckList]
            newCheckList[indx].checked = !newCheckList[indx].checked
            setTeamCheckList(newCheckList);
        }
    }
    //Update CheckList
    const updateCheckList = (id, index) => {
        if (id === "label1") {
            const newCheckLists = [...checkList]
            newCheckLists[index].label = newListLabel1;
            newCheckLists[index].editable = false;
            setCheckList(newCheckLists);
            setnewListLabel1("");
        }
        else if (id === "label2") {
            const newCheckLists = [...teamCheckList]
            newCheckLists[index].label = newListLabel2;
            newCheckLists[index].editable = false;
            setTeamCheckList(newCheckLists);
            setnewListLabel2("");
        };
        setshowAddButton(!showAddButton);
    }

    //add new CheckList
    const addItem = (id, event) => {
        event.preventDefault();
        if (id === "list-1") {
            const newItem = {
                id: nanoid(),
                label: "",
                checked: false,
                editable: true,
            }
            setCheckList([...checkList, newItem]);
        }
        else if (id === "list-2") {
            const newItem = {
                id: nanoid(),
                label: "",
                checked: false,
                editable: true,
            }
            setTeamCheckList([...teamCheckList, newItem])
        };

        setshowAddButton(!showAddButton);

    }

    //Delete CheckList
    const deleteItem = (id, itemId) => {
        if (id === "list1") {
            const newList = [...checkList];
            // const index = checkList.findIndex((item) => item.id === itemId);
            newList.splice(itemId, 1);
            setCheckList(newList);
        }
        else if (id === "list2") {
            const newList = [...teamCheckList];
            // const index = checkList.findIndex((item) => item.id === itemId);
            newList.splice(itemId, 1);
            setTeamCheckList(newList);
        };
    }

    //Apex chart options
    var options = {
        chart: {
            type: 'radialBar',
            width: 50,
            height: 50,
            sparkline: {
                enabled: true
            }
        },
        colors: ['#007D88'],
        dataLabels: {
            enabled: false
        },
        plotOptions: {
            radialBar: {
                hollow: {
                    margin: 0,
                    size: '80%'
                },
                track: {
                    margin: 0,
                    strokeWidth: '97%',
                },
            }
        },
        labels: ['8/12'],

    };
    const series = [85];

    return (
        <Modal show={show} onHide={onHide} size="xl" centered dialogClassName="modal-dialog-centered task-detail-modal" >
            <div className="modal-content">
                <Modal.Body className="p-0">
                    <header className="task-header">
                        <div className="d-flex align-items-center">
                            <ReactApexChart options={options} series={series} type="radialBar" height={50} width={50} />
                            <Form.Check label="Mark as completed" className="mx-lg-3 ms-3" defaultChecked />
                            <Button variant="flush-light" className="flush-outline-hover d-lg-inline-block d-none">
                                <span>
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <Icons.Link />
                                        </span>
                                    </span>
                                    <span>Copy Link</span>
                                </span>
                            </Button>
                            <Button variant="light" className="btn-icon btn-rounded d-lg-none d-lg-inline-block ms-1">
                                <span>
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <Icons.Link />
                                        </span>
                                    </span>
                                </span>
                            </Button>
                        </div>
                        <div className="task-options-wrap">
                            <span className="task-star marked">
                                <span className="feather-icon">
                                    <Icons.Star />
                                </span>
                            </span>
                            <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover ms-1 d-lg-inline-block d-none">
                                <span className="icon">
                                    <span className="feather-icon">
                                        <Icons.Trash2 />
                                    </span>
                                </span>
                            </Button>
                            <Dropdown>
                                <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <Icons.MoreVertical />
                                        </span>
                                    </span>
                                </Dropdown.Toggle>
                                <Dropdown.Menu align="end">
                                    <Dropdown.Header>Action</Dropdown.Header>
                                    <Dropdown.Item><span className="feather-icon dropdown-icon">
                                        <Icons.Edit />
                                    </span>
                                        <span>Assign to</span>
                                    </Dropdown.Item>
                                    <Dropdown.Item><span className="feather-icon dropdown-icon">
                                        <Icons.User />
                                    </span>
                                        <span>Attach files</span>
                                    </Dropdown.Item>
                                    <Dropdown.Item><span className="feather-icon dropdown-icon">
                                        <Icons.Paperclip />
                                    </span>
                                        <span>Apply Labels</span>
                                    </Dropdown.Item>
                                    <Dropdown.Item><span className="feather-icon dropdown-icon">
                                        <Icons.Tag />
                                    </span>
                                        <span>Set Due Date</span>
                                    </Dropdown.Item>
                                    <Dropdown.Item><span className="feather-icon dropdown-icon">
                                        <Icons.Calendar />
                                    </span>
                                        <span>Follow Task</span>
                                    </Dropdown.Item>
                                    <Dropdown.Item><span className="feather-icon dropdown-icon">
                                        <Icons.Bookmark />
                                    </span>
                                        <span>Set Due Date</span>
                                    </Dropdown.Item>
                                    <Dropdown.Divider as="div" />
                                    <Dropdown.Item><span className="feather-icon dropdown-icon">
                                        <Icons.ArrowUp />
                                    </span>
                                        <span>Set as Top Priority</span>
                                    </Dropdown.Item>
                                    <Dropdown.Item><span className="feather-icon dropdown-icon">
                                        <Icons.Repeat />
                                    </span>
                                        <span>Change Status</span>
                                    </Dropdown.Item>
                                    <Dropdown.Item><span className="feather-icon dropdown-icon">
                                        <Icons.Pocket />
                                    </span>
                                        <span>Save as Template</span>
                                    </Dropdown.Item>
                                    <Dropdown.Item><span className="feather-icon dropdown-icon">
                                        <Icons.Archive />
                                    </span>
                                        <span>Move to archive</span>
                                    </Dropdown.Item>
                                    <Dropdown.Item className="delete-task"><span className="feather-icon dropdown-icon">
                                        <Icons.Trash2 />
                                    </span>
                                        <span>Delete</span>
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </div>
                    </header>
                    <div className="task-detail-body">
                        <HkAlert variant="primary" className="alert-wth-icon" >
                            <span className="alert-icon-wrap"><span className="feather-icon"><i className="zmdi zmdi-lock" /></span></span> This task is private for Jampack Team
                        </HkAlert>
                        <HkInlineEdit as="h4" id="edit1" className="fw-bold mb-0" value="Framworking Building" />
                        <HkInlineEdit as="p" id="edit2" className="mb-0" value="Instant rebuilding of assets during development" />
                        <div className="avatar-group avatar-group-lg avatar-group-overlapped mt-3">
                            <div className="avatar avatar-rounded" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Katharine">
                                <Image src={avatar8} alt="user" className="avatar-img" />
                            </div>
                            <div className="avatar avatar-rounded" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Dean">
                                <Image src={avatar13} alt="user" className="avatar-img" />
                            </div>
                            <div className="avatar avatar-xs avatar-soft-danger avatar-rounded" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Tom">
                                <span className="initial-wrap">T</span>
                            </div>
                            <div className="avatar avatar-rounded" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Morgan">
                                <Image src={avatar2} alt="user" className="avatar-img" />
                            </div>
                            <div className="avatar avatar-icon avatar-primary avatar-rounded" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Tooltip text">
                                <span className="initial-wrap"><span className="feather-icon"><Icons.Plus /></span></span>
                            </div>
                        </div>
                        <Row as={Form} >
                            <Col md={4}>
                                <div className="title title-wth-divider my-4"><span>Assignee</span></div>
                                <div className="media align-items-center">
                                    <div className="media-head">
                                        <div className="avatar avatar-sm avatar-primary avatar-rounded">
                                            <span className="initial-wrap">H</span>
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div className="as-name">Hencework</div>
                                        <div className="as-date">4 july 2022, 8:30pm</div>
                                    </div>
                                </div>
                            </Col>
                            <Col md={4}>
                                <div className="title title-wth-divider my-4"><span>Due Date</span></div>
                                <DateRangePicker
                                    initialSettings={{
                                        singleDatePicker: true,
                                        timePicker: true,
                                        showDropdowns: true,
                                        startDate: new Date(),
                                        locale: {
                                            format: 'M/DD/YYYY hh:mm A',
                                        },
                                    }}
                                >
                                    <Form.Control type="text" name="single-date" />
                                </DateRangePicker>
                            </Col>
                            <Col md={4}>
                                <div className="title title-wth-divider my-4"><span>Status</span></div>
                                <Dropdown>
                                    <Dropdown.Toggle variant="warning" className="btn-rounded">
                                        In Progress
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu>
                                        <Dropdown.Item>Action</Dropdown.Item>
                                        <Dropdown.Item>Another action</Dropdown.Item>
                                        <Dropdown.Item>Something else here</Dropdown.Item>
                                        <Dropdown.Divider as="div" />
                                        <Dropdown.Item>Separated link</Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                            </Col>
                            <Col md={12}>
                                <div className="title title-wth-divider my-4"><span>Labels</span></div>
                                <div className="d-flex flex-wrap">
                                    {recipients.map((data, i) => (
                                        <HkChips key={i} className="mb-2 me-2" variant="outline-secondary" dismissable >
                                            {data}
                                        </HkChips>
                                    ))}
                                    <Form.Control type="text" className="border-0 p-0 shadow-none flex-1 mb-2 me-2" placeholder="Add Chips" value={newRecipient} onChange={e => setNewRecipient(e.target.value)} onKeyPress={onEnter} />
                                </div>
                            </Col>
                        </Row>
                        <Tab.Container defaultActiveKey="tabChecklist" >
                            <Nav as="ul" variant="tabs" justify className="nav-light nav-segmented-tabs active-theme mt-4">
                                <Nav.Item as="li">
                                    <Nav.Link eventKey="tabChecklist">
                                        <span className="nav-link-text">Checklist</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link eventKey="tabComments">
                                        <span className="nav-link-text badge-on-text">Comments</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link eventKey="tabFiles">
                                        <span className="nav-link-text badge-on-text">Files</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item as="li">
                                    <Nav.Link eventKey="tabActivity">
                                        <span className="nav-link-text badge-on-text">Activity</span>
                                    </Nav.Link>
                                </Nav.Item>
                            </Nav>
                            <Tab.Content className="mt-7">
                                <Tab.Pane eventKey="tabChecklist">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <div className="title title-lg mb-0">
                                            <span>Checklist</span>
                                        </div>
                                        <Button variant="light" size="xs" className="btn-icon btn-rounded">
                                            <HkTooltip placement="top" title="Add Category" >
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <Icons.Plus />
                                                    </span>
                                                </span>
                                            </HkTooltip>
                                        </Button>
                                    </div>
                                    <div className="hk-checklist">

                                        {checkList.map((data, index) => (
                                            <Form.Check key={index} id={`check_${index}`} >
                                                <Form.Check.Input type="checkbox" checked={data.checked} onChange={() => handleCheck("list1", index)} />
                                                {!data.editable ?
                                                    <Form.Check.Label htmlFor={`check_${index}`}>
                                                        {data.label}
                                                        <span className="done-strikethrough" />
                                                    </Form.Check.Label>
                                                    :
                                                    <Form.Check.Label className="mb-3" >
                                                        <Form.Control className="checklist-input" type="text" placeholder="Add new Item" value={newListLabel1} onChange={e => setnewListLabel1(e.target.value)} onKeyPress={e => { if (e.key === "Enter") updateCheckList("label1", index) }} autoFocus />
                                                    </Form.Check.Label>
                                                }
                                                <Link href="#" className="btn btn-xs btn-icon btn-rounded btn-flush-light flush-soft-hover delete-checklist" onClick={() => deleteItem("list1", index)} >
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <Icons.Trash2 />
                                                        </span>
                                                    </span>
                                                </Link>
                                            </Form.Check>
                                        ))}
                                        {showAddButton && <Link href="#" className={classNames("d-flex align-items-center add-new-checklist")} onClick={e => addItem("list-1", e)}>
                                            <span className="feather-icon fe-x me-2"><Icons.PlusSquare /> </span>
                                            <span>New Item</span>
                                        </Link>}
                                    </div>
                                    <div className="d-flex align-items-center justify-content-between">
                                        <div className="title title-wth-divider flex-grow-1 my-4 me-2"><span>Canada team task</span></div>
                                        <div>
                                            <a href="#some" className="btn btn-xs btn-icon btn-rounded btn-flush-light flush-soft-hover delete-checklist" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Edit"><span className="icon">
                                                <span className="feather-icon">
                                                    <Icons.Edit2 /></span></span></a>
                                            <a href="#some" className="btn btn-xs btn-icon btn-rounded btn-flush-light flush-soft-hover delete-checklist"><span className="icon">
                                                <span className="feather-icon">

                                                    <Icons.Trash2 /> </span></span></a>
                                        </div>
                                    </div>
                                    <div className="hk-checklist">
                                        {teamCheckList.map((data, index) => (
                                            <Form.Check key={index} id={`check_${index}_team`} >
                                                <Form.Check.Input type="checkbox" checked={data.checked} onChange={() => handleCheck("list2", index)} />
                                                {!data.editable ?
                                                    <Form.Check.Label htmlFor={`check_${index}_team`}>
                                                        {data.label}
                                                        <span className="done-strikethrough" />
                                                    </Form.Check.Label>
                                                    :
                                                    <Form.Check.Label className="mb-3" >
                                                        <Form.Control className="checklist-input" type="text" placeholder="Add new Item" value={newListLabel2} onChange={e => setnewListLabel2(e.target.value)} onKeyPress={e => { if (e.key === "Enter") updateCheckList("label2", index) }} autoFocus />
                                                    </Form.Check.Label>
                                                }
                                                <Link href="#" className="btn btn-xs btn-icon btn-rounded btn-flush-light flush-soft-hover delete-checklist" onClick={() => deleteItem("list2", index)} >
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <Icons.Trash2 />
                                                        </span>
                                                    </span>
                                                </Link>
                                            </Form.Check>
                                        ))}
                                        {showAddButton && <Link href="#" className={classNames("d-flex align-items-center add-new-checklist")} onClick={e => addItem("list-2", e)}>
                                            <span className="feather-icon fe-x me-2"><Icons.PlusSquare /> </span>
                                            <span>New Item</span>
                                        </Link>}

                                    </div>
                                    <div className="d-flex align-items-center justify-content-between mt-5 mb-2">
                                        <div className="title title-lg mb-0"><span>Notes</span></div>
                                        <a href="#some" className="btn btn-xs btn-icon btn-rounded btn-light" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Add Category"><span className="icon">
                                            <span className="feather-icon">
                                                <Icons.Plus /></span></span></a>
                                    </div>
                                    <div className="card card-border note-block bg-orange-light-5">
                                        <div className="card-body">
                                            <div className="card-action-wrap">
                                                <button className="btn btn-xs btn-icon btn-flush-dark btn-rounded flush-soft-hover dropdown-toggle no-caret" aria-expanded="false" data-bs-toggle="dropdown"><span className="icon">
                                                    <span className="feather-icon">
                                                        <Icons.MoreVertical /></span></span></button>
                                                <div role="menu" className="dropdown-menu dropdown-menu-end">
                                                    <a className="dropdown-item" href="#some">Action</a>
                                                    <a className="dropdown-item" href="#some">Another action</a>
                                                    <a className="dropdown-item" href="#some">Something else here</a>
                                                    <div className="dropdown-divider" />
                                                    <a className="dropdown-item" href="#some">Separated link</a>
                                                </div>
                                            </div>
                                            <div className="media align-items-center">
                                                <div className="media-head">
                                                    <div className="avatar avatar-sm avatar-rounded">
                                                        <Image src={avatar2} alt="user" className="avatar-img" />
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div>Martin Luther</div>
                                                    <div>9 Apr, 20, 7:14 AM</div>
                                                </div>
                                            </div>
                                            <p>@<a href="#some" className="fw-medium">Charlie Darvin</a> From there, you can run grunt compile, grunt migrate and grunt test to compile your contracts, deploy those contracts to the network, and run their associated unit tests.</p>
                                        </div>
                                    </div>
                                    <div className="card card-border note-block bg-orange-light-5">
                                        <div className="card-body">
                                            <div className="card-action-wrap">
                                                <button className="btn btn-xs btn-icon btn-flush-dark btn-rounded flush-soft-hover dropdown-toggle no-caret" aria-expanded="false" data-bs-toggle="dropdown"><span className="icon">
                                                    <span className="feather-icon">
                                                        <Icons.MoreVertical /></span></span></button>
                                                <div role="menu" className="dropdown-menu dropdown-menu-end">
                                                    <a className="dropdown-item" href="#some">Action</a>
                                                    <a className="dropdown-item" href="#some">Another action</a>
                                                    <a className="dropdown-item" href="#some">Something else here</a>
                                                    <div className="dropdown-divider" />
                                                    <a className="dropdown-item" href="#some">Separated link</a>
                                                </div>
                                            </div>
                                            <div className="media align-items-center">
                                                <div className="media-head">
                                                    <div className="avatar avatar-sm avatar-rounded">
                                                        <Image src={avatar3} alt="user" className="avatar-img" />
                                                    </div>
                                                </div>
                                                <div className="media-body">
                                                    <div>Katherine Jones</div>
                                                    <div>8 Apr, 20, 5:30 PM</div>
                                                </div>
                                            </div>
                                            <p>@<a href="#some" className="fw-medium">Martin Luther</a> Viscosity ratio for &quot;Appear view&quot; link text is 3.7:1 which is less </p>
                                        </div>
                                    </div>
                                    <a href="#some" className="btn btn-outline-light btn-block">View more</a>
                                </Tab.Pane>
                                <Tab.Pane eventKey="tabComments">
                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                        <div className="title title-lg mb-0"><span>3 Responses</span></div>
                                        <a href="#some" className="btn btn-xs btn-icon btn-rounded btn-light" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Add Board"><span className="icon">
                                            <span className="feather-icon">
                                                <Icons.Plus /></span></span></a>
                                    </div>
                                    <div className="comment-block">
                                        <div className="media">
                                            <div className="media-head">
                                                <div className="avatar avatar-xs avatar-rounded">
                                                    <Image src={avatar4} alt="user" className="avatar-img" />
                                                </div>
                                            </div>
                                            <div className="media-body">
                                                <div>
                                                    <span className="cm-name">Martin Luther</span>
                                                    <span className="badge badge-soft-violet">Manager</span>
                                                </div>
                                                <p>@<a href="#some" className="fw-medium">Charlie Darvin</a> From there, you can run truffle compile, truffle migrate and truffle test to compile your contracts, deploy those contracts to the network, and run their associated unit tests.</p>
                                                <div className="comment-action-wrap mt-3">
                                                    <span>3 hours ago</span>
                                                    <span className="comment-dot-sep">●</span>
                                                    <a href="#some">Reply</a>
                                                    <span className="comment-dot-sep">●</span>
                                                    <a href="#some">Like</a>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="separator separator-light" />
                                        <div className="media">
                                            <div className="media-head">
                                                <div className="avatar avatar-xs avatar-rounded">
                                                    <Image src={avatar2} alt="user" className="avatar-img" />
                                                </div>
                                            </div>
                                            <div className="media-body">
                                                <div>
                                                    <span className="cm-name">Katherine Jones</span>
                                                </div>
                                                <p>Dynamically beautiful work done by @<a href="#some" className="fw-medium">Ashton Kutcher</a></p>
                                                <div className="comment-action-wrap mt-3">
                                                    <span>3 hours ago</span>
                                                    <span className="comment-dot-sep">●</span>
                                                    <a href="#some">Reply</a>
                                                    <span className="comment-dot-sep">●</span>
                                                    <a href="#some">Like</a>
                                                </div>
                                                <div className="media">
                                                    <div className="media-head">
                                                        <div className="avatar avatar-xs avatar-rounded">
                                                            <Image src={avatar3} alt="user" className="avatar-img" />
                                                        </div>
                                                    </div>
                                                    <div className="media-body">
                                                        <div>
                                                            <span className="cm-name">Ashton Kutche</span>
                                                            <span className="badge badge-soft-danger">Designer</span>
                                                        </div>
                                                        <p>@<a href="#some" className="fw-medium">Katherine Jones</a> Thank you :)</p>
                                                        <div className="comment-action-wrap mt-3">
                                                            <span>3 hours ago</span>
                                                            <span className="comment-dot-sep">●</span>
                                                            <a href="#some">Reply</a>
                                                            <span className="comment-dot-sep">●</span>
                                                            <a href="#some">Like</a>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="separator separator-light" />
                                        <form>
                                            <div className="form-group">
                                                <label className="form-label">Add Comment</label>
                                                <textarea className="form-control" rows={5} defaultValue={""} />
                                            </div>
                                            <div className="d-flex align-items-center justify-content-between">
                                                <button className="btn btn-primary">Send</button>
                                                <small className="form-text text-muted mt-0">Basic HTML is allowed</small>
                                            </div>
                                        </form>
                                    </div>
                                </Tab.Pane>
                                <Tab.Pane eventKey="tabFiles">
                                    <Row>
                                        <Col sm>
                                            <HkDropZone>
                                                Drop files here to upload
                                            </HkDropZone>
                                        </Col>
                                    </Row>
                                    <div className="mt-5 mb-2">
                                        <div className="title title-lg mb-0"><span>Shared files</span></div>
                                    </div>
                                    <div className="file-block">
                                        <div className="collapse-simple">
                                            <HkCollapse
                                                bsPrefix="a"
                                                href="#"
                                                targetId="files_collapse_1"
                                                title="Yesterday"
                                                collapsed={false}
                                            >
                                                <ul className="sh-files">
                                                    <li>
                                                        <div className="media">
                                                            <div className="media-head">
                                                                <div className="avatar avatar-icon avatar-sm avatar-soft-blue">
                                                                    <span className="initial-wrap fs-3">
                                                                        <i className="ri-file-excel-2-fill" />
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="media-body">
                                                                <div>
                                                                    <p className="file-name">website_content.exl</p>
                                                                    <p className="file-size">2,635 KB</p>
                                                                </div>
                                                                <div>
                                                                    <div className="avatar avatar-xs avatar-rounded me-2">
                                                                        <Image src={avatar2} alt="user" className="avatar-img" />
                                                                    </div>
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle size="sm" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <Icons.MoreVertical />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end" >
                                                                            <Dropdown.Item className="ms-0">Download</Dropdown.Item>
                                                                            <Dropdown.Item className="ms-0 link-danger">Delete</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                    <li>
                                                        <div className="media">
                                                            <div className="media-head">
                                                                <div className="avatar avatar-icon avatar-sm avatar-soft-light">
                                                                    <span className="initial-wrap fs-3">
                                                                        <i className="ri-file-text-fill" />
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="media-body">
                                                                <div>
                                                                    <p className="file-name">jampack.pdf</p>
                                                                    <p className="file-size">1.3 GB</p>
                                                                </div>
                                                                <div>
                                                                    <div className="avatar avatar-xs avatar-rounded me-2">
                                                                        <Image src={avatar3} alt="user" className="avatar-img" />
                                                                    </div>
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle size="sm" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <Icons.MoreVertical />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end" >
                                                                            <Dropdown.Item className="ms-0">Download</Dropdown.Item>
                                                                            <Dropdown.Item className="ms-0 link-danger">Delete</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                    <li>
                                                        <div className="media">
                                                            <div className="media-head">
                                                                <div className="avatar avatar-icon avatar-sm avatar-soft-warning">
                                                                    <span className="initial-wrap fs-3">
                                                                        <i className="ri-file-zip-fill" />
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="media-body">
                                                                <div>
                                                                    <p className="file-name">jampack.zip</p>
                                                                    <p className="file-size">2.45 GB</p>
                                                                </div>
                                                                <div>
                                                                    <div className="avatar avatar-xs avatar-soft-danger avatar-rounded me-2">
                                                                        <span className="initial-wrap">H</span>
                                                                    </div>
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle size="sm" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <Icons.MoreVertical />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end" >
                                                                            <Dropdown.Item className="ms-0">Download</Dropdown.Item>
                                                                            <Dropdown.Item className="ms-0 link-danger">Delete</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                    <li>
                                                        <div className="media">
                                                            <div className="media-head">
                                                                <div className="avatar avatar-logo avatar-sm">
                                                                    <span className="initial-wrap">
                                                                        <Image src={avatar2} alt="user" />
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="media-body">
                                                                <div>
                                                                    <p className="file-name">bruce-mars-fiEG-Pk6ZASFPk6ZASF</p>
                                                                    <p className="file-size">4,178 KB</p>
                                                                </div>
                                                                <div>
                                                                    <div className="avatar avatar-xs avatar-rounded me-2">
                                                                        <Image src={avatar5} alt="user" className="avatar-img" />
                                                                    </div>
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle size="sm" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <Icons.MoreVertical />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end" >
                                                                            <Dropdown.Item className="ms-0">Download</Dropdown.Item>
                                                                            <Dropdown.Item className="ms-0 link-danger">Delete</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                    <li>
                                                        <div className="media">
                                                            <div className="media-head">
                                                                <div className="avatar avatar-logo avatar-sm">
                                                                    <span className="initial-wrap">
                                                                        <Image src={avatar2} alt="user" />
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="media-body">
                                                                <div>
                                                                    <p className="file-name">jonas-kakaroto-KIPqvvTKIPqvvT</p>
                                                                    <p className="file-size">951 KB</p>
                                                                </div>
                                                                <div>
                                                                    <div className="avatar avatar-xs avatar-rounded me-2">
                                                                        <Image src={avatar6} alt="user" className="avatar-img" />
                                                                    </div>
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle size="sm" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <Icons.MoreVertical />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end" >
                                                                            <Dropdown.Item className="ms-0">Download</Dropdown.Item>
                                                                            <Dropdown.Item className="ms-0 link-danger">Delete</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                </ul>
                                            </HkCollapse>
                                            <HkCollapse
                                                bsPrefix="a"
                                                href="#"
                                                targetId="files_collapse_2"
                                                title="23 April"
                                                collapsed={false}
                                            >
                                                <ul className="sh-files">
                                                    <li>
                                                        <div className="media">
                                                            <div className="media-head">
                                                                <div className="avatar avatar-icon avatar-sm avatar-soft-light">
                                                                    <span className="initial-wrap fs-3">
                                                                        <i className="ri-keynote-fill" />
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="media-body">
                                                                <div>
                                                                    <p className="file-name">presentation.keynote</p>
                                                                    <p className="file-size">20 KB</p>
                                                                </div>
                                                                <div>
                                                                    <div className="avatar avatar-xs avatar-rounded me-2">
                                                                        <Image src={avatar5} alt="user" className="avatar-img" />
                                                                    </div>
                                                                    <Dropdown>
                                                                        <Dropdown.Toggle size="sm" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret">
                                                                            <span className="icon">
                                                                                <span className="feather-icon">
                                                                                    <Icons.MoreVertical />
                                                                                </span>
                                                                            </span>
                                                                        </Dropdown.Toggle>
                                                                        <Dropdown.Menu align="end" >
                                                                            <Dropdown.Item className="ms-0">Download</Dropdown.Item>
                                                                            <Dropdown.Item className="ms-0 link-danger">Delete</Dropdown.Item>
                                                                        </Dropdown.Menu>
                                                                    </Dropdown>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                    <li>
                                                        <div className="media">
                                                            <div className="media-head">
                                                                <div className="avatar avatar-icon avatar-sm avatar-soft-warning">
                                                                    <span className="initial-wrap fs-3">
                                                                        <i className="ri-file-zip-fill" />
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="media-body">
                                                                <div>
                                                                    <p className="file-name">PACK-TRIAL.zip</p>
                                                                    <p className="file-size">2.45 GB</p>
                                                                </div>
                                                                <div>
                                                                    <div className="avatar avatar-xs avatar-rounded me-2">
                                                                        <Image src={avatar2} alt="user" className="avatar-img" />
                                                                    </div>
                                                                    <a href="#some" className="btn btn-sm btn-icon btn-flush-dark btn-rounded flush-soft-hover dropdown-toggle no-caret" data-bs-toggle="dropdown"><span className="icon">
                                                                        <span className="feather-icon">
                                                                            <Icons.MoreVertical /></span></span></a>
                                                                    <div className="dropdown-menu dropdown-menu-end">
                                                                        <a className="dropdown-item ms-0" href="#some">Download</a>
                                                                        <a className="dropdown-item ms-0" href="#some">Delete</a>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                    <li>
                                                        <div className="media">
                                                            <div className="media-head">
                                                                <div className="avatar avatar-sm">
                                                                    <Image src={thumb1} alt="user" className="avatar-img" />
                                                                </div>
                                                            </div>
                                                            <div className="media-body">
                                                                <div>
                                                                    <p className="file-name">joel-mott-LaK153ghdigaghdi</p>
                                                                    <p className="file-size">3,028 KB</p>
                                                                </div>
                                                                <div>
                                                                    <div className="avatar avatar-xs avatar-rounded me-2">
                                                                        <Image src={avatar8} alt="user" className="avatar-img" />
                                                                    </div>
                                                                    <a href="#some" className="btn btn-sm btn-icon btn-flush-dark btn-rounded flush-soft-hover dropdown-toggle no-caret" data-bs-toggle="dropdown"><span className="icon">
                                                                        <span className="feather-icon">
                                                                            <Icons.MoreVertical /></span></span></a>
                                                                    <div className="dropdown-menu dropdown-menu-end">
                                                                        <a className="dropdown-item ms-0" href="#some">Download</a>
                                                                        <a className="dropdown-item ms-0" href="#some">Delete</a>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                </ul>
                                            </HkCollapse>
                                        </div>
                                    </div>
                                </Tab.Pane>
                                <Tab.Pane eventKey="tabActivity">
                                    <div className="mt-5 mb-2">
                                        <div className="title title-lg mb-0"><span>Latest activity</span></div>
                                    </div>
                                    <div className="collapse-simple">
                                        <HkCollapse
                                            bsPrefix="a"
                                            href="#"
                                            targetId="activity_1"
                                            title="Today"
                                            collapsed={false}
                                        >
                                            <ListGroup as="ul" variant="flush" className="activity-list">
                                                <ListGroup.Item as="li">
                                                    <div className="media">
                                                        <div className="media-head">
                                                            <div className="avatar avatar-sm avatar-primary avatar-rounded">
                                                                <span className="initial-wrap">H</span>
                                                            </div>
                                                        </div>
                                                        <div className="media-body">
                                                            <p><span className="text-dark">Hencework</span> on Documentation link is working now - <a href="#some" className="link-url"><u>ttps://hencework.com/theme/jampa</u></a></p>
                                                            <div className="last-activity-time">Oct 15, 2021, 12:34 PM</div>
                                                        </div>
                                                    </div>
                                                </ListGroup.Item>
                                                <ListGroup.Item as="li">
                                                    <div className="media">
                                                        <div className="media-head">
                                                            <div className="avatar avatar-sm avatar-rounded">
                                                                <Image src={avatar2} alt="user" className="avatar-img" />
                                                            </div>
                                                        </div>
                                                        <div className="media-body">
                                                            <p><span className="text-dark">Morgan Fregman</span> completed react conversion of <a href="#some" className="link-default"><u>components</u></a></p>
                                                            <div className="last-activity-time">Sep 16, 2021, 4:54 PM</div>
                                                        </div>
                                                    </div>
                                                </ListGroup.Item>
                                                <ListGroup.Item as="li">
                                                    <div className="media">
                                                        <div className="media-head">
                                                            <div className="avatar avatar-sm avatar-rounded">
                                                                <Image src={avatar13} alt="user" className="avatar-img" />
                                                            </div>
                                                        </div>
                                                        <div className="media-body">
                                                            <p><span className="text-dark">Jimmy Carry</span>completed side bar menu on <a href="#some" className="link-default"><u>elements</u></a></p>
                                                            <div className="last-activity-time">Sep 10, 2021, 10:13 AM</div>
                                                        </div>
                                                    </div>
                                                </ListGroup.Item>
                                                <ListGroup.Item as="li">
                                                    <div className="media">
                                                        <div className="media-head">
                                                            <div className="avatar avatar-sm avatar-rounded">
                                                                <Image src={avatar7} alt="user" className="avatar-img" />
                                                            </div>
                                                        </div>
                                                        <div className="media-body">
                                                            <p><span className="text-dark">Charlie Chaplin</span> deleted empty cards on <a href="#some" className="link-default"><u>completed</u></a></p>
                                                            <div className="last-activity-time">Sep 10, 2021, 10:13 AM</div>
                                                        </div>
                                                    </div>
                                                </ListGroup.Item>
                                            </ListGroup>
                                        </HkCollapse>
                                        <HkCollapse
                                            bsPrefix="a"
                                            href="#"
                                            targetId="activity_2"
                                            title="Yesterday"
                                            collapsed={false}
                                        >
                                            <ListGroup as="ul" variant="flush" className="activity-list">
                                                <ListGroup.Item as="li">
                                                    <div className="media">
                                                        <div className="media-head">
                                                            <div className="avatar avatar-sm avatar-soft-danger avatar-rounded">
                                                                <span className="initial-wrap">W</span>
                                                            </div>
                                                        </div>
                                                        <div className="media-body">
                                                            <p><span className="text-dark">Winston Churchills</span> created a note on UI components task list</p>
                                                            <div className="last-activity-time">Sep 2, 2021, 9:23 AM</div>
                                                        </div>
                                                    </div>
                                                </ListGroup.Item>
                                                <ListGroup.Item as="li">
                                                    <div className="media">
                                                        <div className="media-head">
                                                            <div className="avatar avatar-sm avatar-rounded">
                                                                <Image src={avatar2} alt="user" className="avatar-img" />
                                                            </div>
                                                        </div>
                                                        <div className="media-body">
                                                            <p><span className="text-dark">Morgan Fregman</span> completed react conversion of <a href="#some" className="link-default"><u>components</u></a></p>
                                                            <div className="last-activity-time">Sep 16, 2021, 4:54 PM</div>
                                                        </div>
                                                    </div>
                                                </ListGroup.Item>
                                                <ListGroup.Item as="li">
                                                    <div className="media">
                                                        <div className="media-head">
                                                            <div className="avatar avatar-sm avatar-rounded">
                                                                <Image src={avatar13} alt="user" className="avatar-img" />
                                                            </div>
                                                        </div>
                                                        <div className="media-body">
                                                            <p><span className="text-dark">Jimmy Carry</span>added shared components to <a href="#some" className="link-default"><u>basic structure</u></a></p>
                                                            <div className="last-activity-time">Sep 10, 2021, 10:13 AM</div>
                                                        </div>
                                                    </div>
                                                </ListGroup.Item>
                                                <ListGroup.Item as="li">
                                                    <div className="media">
                                                        <div className="media-head">
                                                            <div className="avatar avatar-sm avatar-primary avatar-rounded">
                                                                <span className="initial-wrap">H</span>
                                                            </div>
                                                        </div>
                                                        <div className="media-body">
                                                            <p><span className="text-dark">Hencework</span> commented on <a href="#some" className="link-default"><u>basic structure</u></a></p>
                                                            <div className="last-activity-time">Sep 10, 2021, 10:13 AM</div>
                                                        </div>
                                                    </div>
                                                </ListGroup.Item>
                                                <ListGroup.Item as="li">
                                                    <div className="media">
                                                        <div className="media-head">
                                                            <div className="avatar avatar-sm avatar-rounded">
                                                                <Image src={avatar7} alt="user" className="avatar-img" />
                                                            </div>
                                                        </div>
                                                        <div className="media-body">
                                                            <p><span className="text-dark">Charlie Chaplin</span> moved components from all modules to in progress</p>
                                                            <div className="last-activity-time">Sep 10, 2021, 10:13 AM</div>
                                                        </div>
                                                    </div>
                                                </ListGroup.Item>
                                                <ListGroup.Item as="li">
                                                    <div className="media">
                                                        <div className="media-head">
                                                            <div className="avatar avatar-sm avatar-soft-danger avatar-rounded">
                                                                <span className="initial-wrap">W</span>
                                                            </div>
                                                        </div>
                                                        <div className="media-body">
                                                            <p><span className="text-dark">Winston Churchills</span> created a note on UI components task list</p>
                                                            <div className="last-activity-time">Sep 10, 2021, 10:13 AM</div>
                                                        </div>
                                                    </div>
                                                </ListGroup.Item>
                                            </ListGroup>
                                        </HkCollapse>
                                    </div>
                                </Tab.Pane>
                            </Tab.Content>
                        </Tab.Container>
                    </div>
                    <div className="task-action-wrap">
                        <div className="nicescroll-bar">
                            <div className="title title-xs text-primary"><span>Action</span></div>
                            <Nav className="nav-sm nav-icon nav-vertical nav-light">
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap"><span className="feather-icon"><Icons.Edit /> </span></span>
                                        <span className="nav-link-text">Edit</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap"><span className="feather-icon"><Icons.User /></span></span>
                                        <span className="nav-link-text">Assign to</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap"><span className="feather-icon"><Icons.Paperclip /></span></span>
                                        <span className="nav-link-text">Attach files</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap"><span className="feather-icon"><Icons.Tag /></span></span>
                                        <span className="nav-link-text">ApplyLabels</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap"><span className="feather-icon"><Icons.Calendar /></span></span>
                                        <span className="nav-link-text">Set Due Date</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap"><span className="feather-icon">
                                            <Icons.Bookmark /> </span></span>
                                        <span className="nav-link-text">Follow Task</span>
                                    </Nav.Link>
                                </Nav.Item>
                            </Nav>
                            <div className="hk-separator hk-separator-sm hk-secondary-separator" />
                            <Nav className="nav nav-sm nav-icon nav-vertical nav-light">
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap"><span className="feather-icon"><Icons.ArrowUp /> </span></span>
                                        <span className="nav-link-text">Set as Top Priority</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap"><span className="feather-icon"> <Icons.Repeat /> </span></span>
                                        <span className="nav-link-text">Change Status</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap"><span className="feather-icon"><Icons.Pocket /> </span></span>
                                        <span className="nav-link-text">Save as Template</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap"><span className="feather-icon"><Icons.Archive /> </span></span>
                                        <span className="nav-link-text">Move to archive</span>
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Nav.Link>
                                        <span className="nav-icon-wrap"><span className="feather-icon">
                                            <Icons.Trash2 /> </span></span>
                                        <span className="nav-link-text">Delete</span>
                                    </Nav.Link>
                                </Nav.Item>
                            </Nav>
                        </div>
                    </div>
                </Modal.Body>
            </div>
            {/* </div> */}
        </Modal>
    )
}

export default TaskDetails