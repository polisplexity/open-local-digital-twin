import { Edit2, Trash } from 'react-feather';
import HkBadge from "@/components/@hk-badge/@hk-badge";
import { Button, ProgressBar } from "react-bootstrap";
import { ArrowsSort, SortAscending, SortDescending } from 'tabler-icons-react';

//Images
import avatar1 from '@/assets/img/logo-avatar-1.png';
import avatar2 from '@/assets/img/logo-avatar-2.png';
import avatar3 from '@/assets/img/logo-avatar-3.png'
import avatar4 from '@/assets/img/logo-avatar-4.png'
import avatar5 from '@/assets/img/logo-avatar-5.png'
import avatar6 from '@/assets/img/logo-avatar-6.png'
import Image from 'next/image';
// import HkProgressBar from '@/components/@hk-progressbar/HkProgressBar';


//Custom Avatar Container
const avatarFormater = (cell) => {
    return (
        cell.map((data, indx) => (
            <div className="media align-items-center" key={indx} >
                <div className="media-head me-2">
                    <div className="avatar avatar-xs avatar-rounded">
                        <Image src={data.Img} alt="user" className="avatar-img" />
                    </div>
                </div>
                <div className="media-body">
                    <div className="text-high-em">{data.productName}</div>
                    <div className="fs-7"><a href="#" className="table-link-text link-medium-em">{data.productLink}</a></div>
                </div>
            </div>
        ))
    )
}

//Custom Ussage Container
const usageFormater = (cell) => {
    return (
        cell.map((data, indx) => (
            <div className="progress-lb-wrap" style={{ width: 251 }} key={indx} >
                <div className="d-flex align-items-center">
                    {/* <HkProgressBar variant={data.variant} now={data.value} size="xs" rounded className="flex-1" /> */}
                    <ProgressBar variant={data.variant} now={data.value} className="flex-1 progress-bar-rounded progress-bar-xs" />
                    <div className="fs-8 ms-3">{data.value}%</div>
                </div>
            </div>
        ))
    )
}

//Custom Tag Container
const tagFormater = (cell) => {
    return (
        cell.map((data, indx) => (
            <HkBadge bg="secondary" soft className="my-1  me-2" key={indx} >{data}</HkBadge>
        ))
    )
}

//Custom Action Container
const actionFormater = (cell) => {
    return (
        cell.map((data, indx) => (
            <div className="d-flex align-items-center" key={indx} >
                <Button as="a" href={data.editLink} variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover" data-bs-toggle="tooltip" data-placement="top" data-bs-original-title="Edit">
                    <span className="icon">
                        <span className="feather-icon">
                            <Edit2 />
                        </span>
                    </span>
                </Button>
                <Button as="a" href={data.deletLink} variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover del-button" data-bs-toggle="tooltip" data-placement="top" data-bs-original-title="Delete">
                    <span className="icon">
                        <span className="feather-icon">
                            <Trash />
                        </span>
                    </span>
                </Button>
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
        accessor: "name",
        title: "Name",
        sort: true,
        cellFormatter: avatarFormater,
    },
    {
        accessor: "usage",
        title: "Usage",
        sort: true,
        cellFormatter: usageFormater,
    },
    {
        accessor: "lastUpdate",
        title: "Last Update",
        sort: true,
    },
    {
        accessor: "tags",
        title: "Tags",
        sort: true,
        cellFormatter: tagFormater,
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
        name: [{ Img: avatar1, productName: "Phone Pay", productLink: "phonepay.in", }],
        usage: [{ value: 90, variant: "blue-dark-3" }],
        lastUpdate: "10 June, 2022",
        tags: ["admin", "Finance"],
        actions: [{ editLink: "#", deletLink: "#" }]
    },

    {
        id: 2,
        name: [{ Img: avatar2, productName: "Swiggy", productLink: "swiggy.com", }],
        usage: [{ value: 75, variant: "blue" }],
        lastUpdate: "09 July, 2022",
        tags: ["customer data", "admin", "+4"],
        actions: [{ editLink: "#", deletLink: "#" }]
    },

    {
        id: 3,
        name: [{ Img: avatar3, productName: "Coursera", productLink: "coursera.com", }],
        usage: [{ value: 50, variant: "primary" }],
        lastUpdate: "24 Aug, 2022",
        tags: ["education", "admin", "+3"],
        actions: [{ editLink: "#", deletLink: "#" }]
    },

    {
        id: 4,
        name: [{ Img: avatar4, productName: "Tinder", productLink: "tinder.com", }],
        usage: [{ value: 60, variant: "primary" }],
        lastUpdate: "17 May, 2022",
        tags: ["Social",],
        actions: [{ editLink: "#", deletLink: "#" }]
    },

    {
        id: 5,
        name: [{ Img: avatar5, productName: "PCD", productLink: "pcdeals.com", }],
        usage: [{ value: 30, variant: "grey" }],
        lastUpdate: "13 July, 2022",
        tags: ["Portal", "admin", "+3"],
        actions: [{ editLink: "#", deletLink: "#" }]
    },
    {
        id: 6,
        name: [{ Img: avatar6, productName: "Icons 8", productLink: "icons8.com", }],
        usage: [{ value: 45, variant: "green-dark-1" }],
        lastUpdate: "14 July, 2022",
        tags: ["Library", "Asset",],
        actions: [{ editLink: "#", deletLink: "#" }]
    },


];