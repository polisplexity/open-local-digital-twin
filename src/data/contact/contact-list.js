import Image from "next/image"
import classNames from "classnames";
import HkBadge from "@/components/@hk-badge/@hk-badge";
import { Button, Dropdown } from "react-bootstrap";
import { Archive, Copy, Edit, MoreVertical, Star, Trash, Trash2 } from "react-feather";
import Link from "next/link";

//Images
import avatar1 from '@/assets/img/avatar1.jpg';
import avatar2 from '@/assets/img/avatar2.jpg';
import avatar3 from '@/assets/img/avatar3.jpg';
import avatar7 from '@/assets/img/avatar7.jpg';
import avatar8 from '@/assets/img/avatar8.jpg';
import avatar9 from '@/assets/img/avatar9.jpg';
import avatar10 from '@/assets/img/avatar10.jpg';
import avatar13 from '@/assets/img/avatar13.jpg';

//Custom Star Formatter
const starFormatter = (cell) => (
    <div className="d-flex align-items-center">
        <span className={classNames("contact-star", { "marked": cell })}>
            <span className="feather-icon">
                <Star />
            </span>
        </span>
    </div>

)

//Custom Name Formatter
const nameFormater = (cell) => {
    return (
        cell.map((data, indx) => (
            <div className="media align-items-center" key={indx} >
                <div className="media-head me-2">
                    <div className={classNames("avatar avatar-xs avatar-rounded", (data.cstmAvt ? `avatar-soft-${data.avtBg}` : ""))}>
                        {data.Img && <Image src={data.Img} alt="user" className="avatar-img" />}
                        {data.cstmAvt && <span className="initial-wrap">{data.cstmAvt}</span>}
                    </div>
                </div>
                <div className="media-body">
                    <span className="d-block text-high-em">{data.userName}</span>
                </div>
            </div>
        ))
    )
}

//Custom Mail Formatter
const mailFormatter = (mail) => (
    <span className="text-truncate mw-150p d-block">{mail}</span>
)


//Custom Tag Container
const tagFormater = (cell) => {
    return (
        cell.map((data, indx) => (
            <HkBadge bg={data.bg} soft className="my-1  me-2" key={indx} >{data.title}</HkBadge>
        ))
    )
}

//Custom Action Container
const actionFormater = (cell) => {
    return (
        cell.map((data, indx) => (
            <div className="d-flex align-items-center" key={indx} >
                <div className="d-flex">
                    <Button variant="flush-dark" as={Link} href={data.archiveLink} className="btn-icon btn-rounded flush-soft-hover" data-bs-toggle="tooltip" data-placement="top" data-bs-original-title="Archive">
                        <span className="icon">
                            <span className="feather-icon">
                                <Archive />
                            </span>
                        </span>
                    </Button>
                    <Button variant="flush-dark" as={Link} href={data.editLink} className="btn-icon btn-rounded flush-soft-hover" data-bs-toggle="tooltip" data-placement="top" data-bs-original-title="Edit">
                        <span className="icon">
                            <span className="feather-icon">
                                <Edit />
                            </span>
                        </span>
                    </Button>
                    <Button variant="flush-dark" as={Link} href={data.deleteLink} className="btn-icon btn-rounded flush-soft-hover del-button" data-bs-toggle="tooltip" data-placement="top" data-bs-original-title="Delete">
                        <span className="icon">
                            <span className="feather-icon">
                                <Trash />
                            </span>
                        </span>
                    </Button>
                </div>
                <Dropdown>
                    <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret" aria-expanded="false" data-bs-toggle="dropdown">
                        <span className="icon">
                            <span className="feather-icon">
                                <MoreVertical />
                            </span>
                        </span>
                    </Dropdown.Toggle>
                    <Dropdown.Menu align="end">
                        <Dropdown.Item as={Link} href={data.editLink}>
                            <span className="feather-icon dropdown-icon">
                                <Edit />
                            </span>
                            <span>Edit Contact</span>
                        </Dropdown.Item>
                        <Dropdown.Item as={Link} href="#">
                            <span className="feather-icon dropdown-icon">
                                <Trash2 />
                            </span>
                            <span>Delete</span>
                        </Dropdown.Item>
                        <Dropdown.Item as={Link} href="#">
                            <span className="feather-icon dropdown-icon">
                                <Copy />
                            </span>
                            <span>Duplicate</span>
                        </Dropdown.Item>
                        <Dropdown.Divider as="div" />
                        <Dropdown.Header className="dropdown-header-bold">Change Labels</Dropdown.Header>
                        <Dropdown.Item as="a" href="#">Design</Dropdown.Item>
                        <Dropdown.Item as="a" href="#">Developer</Dropdown.Item>
                        <Dropdown.Item as="a" href="#">Inventory</Dropdown.Item>
                        <Dropdown.Item as="a" href="#">Human Resource</Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            </div>
        ))
    )
}


export const columns = [
    {
        accessor: "id",
        title: "Product ID",
        hidden: true,
    },
    {
        accessor: "starred",
        title: "",
        hidden: true,
    },
    {
        accessor: "name",
        title: "Name",
        sort: true,
        cellFormatter: nameFormater,
    },
    {
        accessor: "email",
        title: "Email Address",
        sort: true,
        cellFormatter: (cell) => <span className="text-truncate mw-150p d-block">{cell}</span>,
    },
    {
        accessor: "phone",
        title: "Phone",
        sort: true,
    },
    {
        accessor: "tags",
        title: "Tags",
        sort: true,
        cellFormatter: tagFormater,
    },
    {
        accessor: "labels",
        title: "Labels",
        sort: true,
    },
    {
        accessor: "dateCreated",
        title: "Date Created",
        sort: true,
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
        name: [{ Img: avatar1, userName: "Morgan Freeman" }],
        email: "morgan@jampack.com",
        phone: "+145 52 5689",
        tags: [{ title: "Promotion", bg: "violet" }, { title: "Collaborator", bg: "danger" }],
        labels: "Design",
        dateCreated: "13 Jan, 2020",
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },

    {
        id: 2,
        starred: true,
        name: [{ Img: avatar9, userName: "Huma Therman" }],
        email: "huma@clariesup.au",
        phone: "+234 48 2365",
        tags: [{ title: "Collaborator", bg: "danger" }, { title: "Angular Developer", bg: "success" },],
        labels: "Developer",
        dateCreated: "13 Jan, 2020",
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },

    {
        id: 3,
        starred: false,
        name: [{ cstmAvt: "C", avtBg: "info", userName: "Charlie Chaplin" }],
        email: "charlie@leernoca.monster",
        phone: "+741 56 7896",
        tags: [{ title: "Collaborator", bg: "danger" },],
        labels: "Inventory",
        dateCreated: "13 Jan, 2019",
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },

    {
        id: 4,
        starred: true,
        name: [{ Img: avatar10, userName: "Winston Churchil" }],
        email: "winston@worthniza.ga",
        phone: "+145 52 5463",
        tags: [{ title: "Promotion", bg: "danger" }, { title: "Advertisement", bg: "light" },],
        labels: "Human Resource",
        dateCreated: "13 Jan, 2020",
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    {
        id: 5,
        starred: false,
        name: [{ Img: avatar3, userName: "Jaquiline Joker" }],
        email: "jaquljoker@jampack.com",
        phone: "+145 53 4715",
        tags: [{ title: "Promotion", bg: "violet" }, { title: "Collaborator", bg: "danger" },],
        labels: "Design",
        dateCreated: "3 July, 2020",
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },

    {
        id: 6,
        starred: true,
        name: [{ Img: avatar7, userName: "Tom Cruz" }],
        email: "tomcz@jampack.com",
        phone: "+456 52 4862",
        tags: [{ title: "Collaborator", bg: "danger" }, { title: "Angular Developer", bg: "warning" },],
        labels: "Inventory",
        dateCreated: "24 Jun, 2019",
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },
    {
        id: 7,
        starred: false,
        name: [{ Img: avatar2, userName: "Danial Craig" }],
        email: "danialc@jampack.com",
        phone: "+145 52 5689",
        tags: [{ title: "Collaborator", bg: "danger" },],
        labels: "Developer",
        dateCreated: "24 Jun, 2019",
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },

    {
        id: 8,
        starred: false,
        name: [{ Img: avatar8, userName: "Katharine Jones" }],
        email: "joneskath@jampack.com",
        phone: "+741 56 7896",
        tags: [{ title: "Promotion", bg: "violet" },],
        labels: "Inventory",
        dateCreated: "24 Jun, 2019",
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },

    {
        id: 9,
        starred: true,
        name: [{ cstmAvt: "H", avtBg: "primary", userName: "Hence Work" }],
        email: "contact@hencework.com",
        phone: "+145 52 5463",
        tags: [{ title: "Promotion", bg: "violet" },],
        labels: "Design",
        dateCreated: "30 Mar, 2019",
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },

    {
        id: 10,
        starred: true,
        name: [{ Img: avatar13, userName: "Dean Shaw" }],
        email: "dean-shaw@poww.me",
        phone: "+234 48 2365",
        tags: [{ title: "Collaborator", bg: "danger" }, { title: "Angular Developer", bg: "success" },],
        labels: "Design",
        dateCreated: "21 Feb, 2019",
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },

    {
        id: 11,
        starred: false,
        name: [{ cstmAvt: "J", avtBg: "danger", userName: "John Brother" }],
        email: "john@cryodrakon.info",
        phone: "+456 52 4862",
        tags: [{ title: "Promotion", bg: "violet" }, { title: "Collaborator", bg: "danger" },],
        labels: "Human Resource",
        dateCreated: "14 Jan, 2019",
        actions: [{ archiveLink: "#", editLink: "edit-contact", deleteLink: "#" }]
    },


];