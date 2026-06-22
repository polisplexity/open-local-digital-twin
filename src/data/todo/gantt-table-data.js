import Image from 'next/image';
import classNames from 'classnames';
import { Badge, Dropdown } from 'react-bootstrap';
import { MoreVertical, Star } from 'react-feather';

//Images
import avatar2 from '@/assets/img/avatar2.jpg';
import avatar7 from '@/assets/img/avatar7.jpg';
import avatar9 from '@/assets/img/avatar9.jpg';
import avatar10 from '@/assets/img/avatar10.jpg';
import avatar15 from '@/assets/img/avatar15.jpg';


const taskFormater = (cell) => {
    return (
        cell.map((data, indx) => (
            <div className="d-flex align-items-center gt-single-task" key={indx}>
                <div>
                    <span className={classNames("todo-star", { "marked": data.mark })}><span className="feather-icon"><Star /> </span></span>
                    <span className="todo-text">{data.text}</span>
                </div>
            </div>
        ))
    )
}

const avatarFormater = (cell) => {
    return (
        cell.map((data, indx) => (
            <div className="media align-items-center" key={indx} >
                <div className="media-head me-2">
                    <div className={classNames("avatar avatar-xs avatar-rounded", (data.cstmAvt ? `avatar-${data.avtBg}` : ""))}>
                        {data.Img && <Image src={data.Img} alt="user" className="avatar-img" />}
                        {data.cstmAvt && <span className="initial-wrap">{data.cstmAvt}</span>}
                    </div>
                </div>
                <div className="media-body">
                    {data.userName}
                </div>
            </div>
        ))
    )
}


//Custom Tag Container
const tagFormater = (cell) => (
    cell ? <Badge
        size="sm"
        bg="white"
        className={classNames("badge-outline badge-wth-icon", { "badge-danger": cell === "High" || cell === "Urgent" }, { "badge-warning": cell === "Low" }, { "badge-orange": cell === "Medium" })}
    >
        <span>
            <i className="badge-dot ri-checkbox-blank-circle-fill" />
            {cell}
        </span>
    </Badge>
        :
        null
)

//Status Container
const statusFormater = (cell) => {
    return (
        cell.map((data, indx) => (
            <Dropdown className="selectable-dropdown" key={indx}>
                <Dropdown.Toggle variant={data.variant} className="btn-rounded" type="button">{data.status}</Dropdown.Toggle>
                <Dropdown.Menu>
                    <Dropdown.Item data-color="#5e7d8a">On Hold</Dropdown.Item>
                    <Dropdown.Item data-color="#FFC400">In Progress</Dropdown.Item>
                    <Dropdown.Item data-color="#9e9e9e">To-Do</Dropdown.Item>
                    <Dropdown.Item data-color="#007D88">Done</Dropdown.Item>
                    <Dropdown.Item data-color="#FF0101">Pending</Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>
        ))
    )
}

//Custom Action Container
const actionFormater = (cell) => {
    return (
        cell.map((data, indx) => (
            <Dropdown key={indx}>
                <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret">
                    <span className="icon">
                        <span className="feather-icon">
                            <MoreVertical />
                        </span>
                    </span>
                </Dropdown.Toggle>
                <Dropdown.Menu align="end" >
                    <Dropdown.Item data-color="#5e7d8a">On Hold</Dropdown.Item>
                    <Dropdown.Item data-color="#FFC400">In Progress</Dropdown.Item>
                    <Dropdown.Item data-color="#9e9e9e">To-Do</Dropdown.Item>
                    <Dropdown.Item data-color="#007D88">Done</Dropdown.Item>
                    <Dropdown.Item data-color="#FF0101">Pending</Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>
        ))
    )
}


export const columns = [
    {
        accessor: "id",
        title: "ID",
        hidden: true,
    },
    {
        accessor: "task",
        title: "Task",
        sort: true,
        // cellFormatter: taskFormater,
    },
    {
        accessor: "priority",
        title: "Priority",
        sort: true,
        cellFormatter: tagFormater,
    },
    {
        accessor: "assignee",
        title: "Assignee",
        sort: true,
        cellFormatter: avatarFormater,
        sortValue: (cell, row) => (cell.map((data) => (data.userName))),
    },
    {
        accessor: "due_date",
        title: "Due Date",
        sort: true,
    },
    {
        accessor: "status",
        title: "Status",
        sort: true,
        cellFormatter: statusFormater,
    },
    {
        accessor: "actions",
        title: "",
        cellFormatter: actionFormater,
    },
];

export const data = [
    {
        id: 1,
        starred: true,
        task: "Video conference with Canada Team",
        priority: "High",
        assignee: [{ Img: avatar7, userName: " Tom Cruz" }],
        due_date: "Tomorrow",
        status: [{ status: "To-Do", variant: "secondary" }],
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    {
        id: 2,
        starred: false,
        task: "Client objective meeting",
        priority: "High",
        assignee: [{ Img: avatar9, userName: "Katherine Jones" }],
        due_date: <span className="text-danger">Yesterday</span>,
        status: [{ status: "In Progres", variant: "warning" }],
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    {
        id: 3,
        starred: false,
        task: "Target market trend analysis on the go",
        assignee: [{ Img: avatar7, userName: "Tom Cruz" }],
        due_date: "Today",
        status: [{ status: "Done", variant: "primary" }],
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    {
        id: 4,
        starred: true,
        task: "Send revised proposal to Mr. Dow Jones",
        priority: "Low",
        assignee: [{ Img: avatar10, userName: "Martin Lutherking" }],
        due_date: "Saturday",
        status: [{ status: "On Hold", variant: "info" }],
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    {
        id: 5,
        starred: false,
        task: "Set up first call for demo",
        assignee: [{ cstmAvt: "H", avtBg: "primary", userName: "Hencework" }],
        due_date: "Sunday",
        status: [{ status: "In Progress", variant: "warning" }],
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    {
        id: 6,
        starred: true,
        task: "Upgrade dependency on resouces",
        priority: "Medium",
        assignee: [{ Img: avatar15, userName: "Boss Baby" }],
        due_date: "27 Nov, 2020",
        status: [{ status: "Pending", variant: "danger" }],
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    {
        id: 7,
        starred: false,
        task: "Update contribution guidelines and licence",
        assignee: [{ Img: avatar15, userName: "Boss Baby" }],
        due_date: "Today",
        status: [{ status: "Done", variant: "primary" }],
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    {
        id: 8,
        starred: false,
        task: "Fix tooltip word wrap/break rules",
        priority: "High",
        assignee: [{ Img: avatar2, userName: "Morgan Freeman" }],
        due_date: <span className="text-danger">4 Days ago</span>,
        status: [{ status: "In Progress", variant: "warning" }],
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    {
        id: 9,
        starred: true,
        task: "Redesigning the base model",
        priority: "Urgent",
        assignee: [{ Img: avatar2, userName: "Charlie Chaplin" }],
        due_date: "3 Aug, 2020",
        status: [{ status: "In Progress", variant: "warning" }],
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    {
        id: 10,
        starred: true,
        task: "Configure security analysis feature",
        priority: "Medium",
        assignee: [{ Img: avatar2, userName: "Tom Cruz" }],
        due_date: "8 Aug, 2020",
        status: [{ status: "On Hold", variant: "info" }],
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    {
        id: 11,
        starred: false,
        task: "Remove notifications panel from inbox",
        priority: "Urgent",
        assignee: [{ Img: avatar2, userName: "Boss Baby" }],
        due_date: "24 Sep, 2020",
        status: [{ status: "To-Do", variant: "secondary" }],
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    {
        id: 12,
        starred: false,
        task: "Send an invite to join project",
        priority: "Low",
        assignee: [{ Img: avatar7, userName: "Tom Cruz" }],
        due_date: <span className="text-danger">Yesterday</span>,
        status: [{ status: "In Progress", variant: "warning" }],
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    {
        id: 13,
        starred: false,
        task: "Connect to software tools",
        priority: "High",
        assignee: [{ Img: avatar10, userName: "Martin Lutherking" }],
        due_date: "Saturday",
        status: [{ status: "Done", variant: "primary" }],
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    {
        id: 14,
        starred: false,
        task: "Speed up project review with planner",
        priority: "High",
        assignee: [{ Img: avatar9, userName: "Katherine Jones" }],
        due_date: "15 Oct, 2020",
        status: [{ status: "Done", variant: "primary" }],
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    // {
    //     id: 4,
    //     task: [{ text: "Update contribution guidelines and licence", mark: false }],
    //     priority: "Low",
    //     assignee: [{ Img: avatar7, userName: "Morgan Freeman" }],
    //     due_date: "Today",
    //     status: [{ status: "Done", variant: "primary" }],
    //     actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    // },

]