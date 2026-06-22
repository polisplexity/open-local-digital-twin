import React from 'react';
import { Copy, Download, Eye, Info, Link2, MoreHorizontal, SkipForward, Trash2, UserPlus } from 'react-feather';
import { Dropdown } from 'react-bootstrap';
import classNames from 'classnames';

//Images
import avatar2 from '@/assets/img/avatar2.jpg';
import avatar12 from '@/assets/img/avatar12.jpg';
import avatar13 from '@/assets/img/avatar13.jpg';
import avatar14 from '@/assets/img/avatar14.jpg';
import mock7 from '@/assets/img/gallery/mock7.jpg';
import mock8 from '@/assets/img/gallery/mock8.jpg';
import Link from 'next/link';
import Image from 'next/image';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';


//Custom Avatar Container
export const nameFormater = (cell) => {

    return (
        cell.map((data, indx) => (
            <div className="media fmapp-info-trigger" key={indx} >
                <div className="media-head me-3">
                    {data.icons && <div className={classNames("avatar avatar-icon avatar-sm", (`avatar-soft-${data.iconBg}`))}>
                        <span className="initial-wrap">
                            <i className={`ri-${data.icons}`} />
                        </span>
                    </div>}
                    {data.img && <Image src={data.img} alt="user" className="d-block img-fluid w-50p" />}
                </div>
                <div className="media-body">
                    <div className="file-name">{data.fileName}</div>
                    <div>{data.fileType}</div>
                </div>
            </div >
        ))
    )
}


//Custom Sharing Container
export const sharingFormater = (cell) => {
    return (
        <div className="avatar-group avatar-group-overlapped">
            {cell.map((data, indx) => (
                <React.Fragment key={indx}>
                    {
                        data.img && <HkTooltip placement="top" title={data.userName} >
                            <div className="avatar avatar-rounded" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Dean" >
                                <Image src={data.img} alt="user" className="avatar-img" />
                            </div>
                        </HkTooltip>
                    }
                    {
                        data.intAvt && <HkTooltip placement="top" title={data.userName} >
                            <div className={classNames("avatar avatar-rounded", (`avatar-soft-${data.initAvtBg}`))} data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Tom">
                                <span className="initial-wrap">{data.intAvt}</span>
                            </div>
                        </HkTooltip>
                    }
                    {data.blank && <span>-</span>}
                </React.Fragment>
            ))}
        </div>

    )
}

//Custom Action Container
export const actionFormater = (cell) => {
    return (
        cell.map((data, indx) => (
            <span className="text-right" key={indx}>
                <Dropdown>
                    <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret" >
                        <span className="icon">
                            <span className="feather-icon">
                                <MoreHorizontal />
                            </span>
                        </span>
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        <Dropdown.Item as={Link} href={data.preview} >
                            <span className="feather-icon dropdown-icon">
                                <Eye />
                            </span>
                            <span>Preview</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Copy />
                            </span>
                            <span>Duplicate</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <SkipForward />
                            </span>
                            <span>Move</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <UserPlus />
                            </span>
                            <span>Invite</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Link2 />
                            </span>
                            <span>Share Link</span>
                        </Dropdown.Item>
                        <div className="dropdown-divider" />
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Info />
                            </span>
                            <span>View Details</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Download />
                            </span>
                            <span>Download</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Trash2 />
                            </span>
                            <span>Delete</span>
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
            </span>
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
        // events: {
        //     onClick: (e) => {
        //         e.preventDefault();
        //         sessionStorage.setItem("FmInfo", true);
        //     }
        // },
    },
    {
        accessor: "sharing",
        title: "Sharing",
        sort: true,
        cellFormatter: sharingFormater,
    },
    {
        accessor: "modified",
        title: "Modified",
        sort: true,
    },
    {
        accessor: "size",
        title: "Size",
        sort: true,
    },
    {
        accessor: "actions",
        title: "Action",
        cellFormatter: actionFormater,
    },
];

export const data = [
    {
        id: 1,
        starred: true,
        name: [{ icons: "file-excel-2-fill", iconBg: "blue", fileName: "Website_content.exl", fileType: "exel" }],
        sharing: [{ img: avatar13, userName: "Dean" }, { img: avatar14, userName: "Danial" }],
        modified: "Today 11:02 AM",
        size: "2,637KB",
        actions: [{ preview: "#", }]
    },
    {
        id: 2,
        starred: false,
        name: [{ img: mock7, fileName: "bruce-mars-fiEG-Pk6ZEZLA", fileType: "png" }],
        sharing: [{ intAvt: "B", initAvtBg: "success", userName: "Tom" }],
        modified: "Yesterday, 2:40 PM",
        size: "4,178 KB",
        actions: [{ preview: "#", }]
    },
    {
        id: 3,
        starred: false,
        name: [{ icons: "folder-2-fill", iconBg: "warning", fileName: "Jampack - HTML - v1.0", fileType: "folder" }],
        sharing: [{ img: avatar2, userName: "Danial" },],
        modified: "13 Jul, 1:46 PM",
        size: "501 KB",
        actions: [{ preview: "#", }]
    },
    {
        id: 4,
        starred: false,
        name: [{ icons: "folder-zip-fill", iconBg: "blue", fileName: "jampack.zip", fileType: "zip" }],
        sharing: [{ img: avatar12, userName: "Danial" },],
        modified: "10 Jun, 8:00 AM",
        size: "2.45 GB",
        actions: [{ preview: "#", }]
    },
    {
        id: 5,
        starred: true,
        name: [{ icons: "folder-5-fill", iconBg: "warning", fileName: "Jampack", fileType: "folder" }],
        sharing: [{ blank: true }],
        modified: "24 Jun, 6:55 PM",
        size: "1.6 GB",
        actions: [{ preview: "#", }]
    },
    {
        id: 6,
        starred: false,
        name: [{ icons: "file-text-fill", iconBg: "blue", fileName: "minutes_meeting.doc", fileType: "document" }],
        sharing: [{ img: avatar12, userName: "Dean" }, { img: avatar13, userName: "Danial" },],
        modified: "18 Feb, 12:25 PM",
        size: "20 KB",
        actions: [{ preview: "#", }]
    },
    {
        id: 7,
        starred: false,
        name: [{ icons: "file-text-fill", iconBg: "blue", fileName: "expenses.doc", fileType: "document" }],
        sharing: [{ img: avatar12, userName: "Danial" },],
        modified: "12 Feb, 12:30 PM",
        size: "76.3 KB",
        actions: [{ preview: "#", }]
    },
    {
        id: 8,
        starred: false,
        name: [{ img: mock8, fileName: "joel-mott-LaK153ghdigdss", fileType: "jpeg" }],
        sharing: [{ blank: true }],
        modified: "02 Jan, 4:32 PM",
        size: "3,028 KB",
        actions: [{ preview: "#", }]
    },
    {
        id: 9,
        starred: false,
        name: [{ icons: "file-word-fill", iconBg: "blue", fileName: "proposal.doc", fileType: "word document" }],
        sharing: [{ img: avatar12, userName: "Katharine" }, { img: avatar13, userName: "Danial" }, { img: avatar14, userName: "Dean" }, { intAvt: "B", initAvtBg: "success", userName: "Tom" }],
        modified: "02 Jan, 9:45 AM",
        size: "951 KB",
        actions: [{ preview: "#", }]
    },
    {
        id: 10,
        starred: false,
        name: [{ icons: "file-pdf-fill", iconBg: "danger", fileName: "jampack.pdf", fileType: "pdf" }],
        sharing: [{ blank: true }],
        modified: "Today, 4:30 PM",
        size: "21.73 MB",
        actions: [{ preview: "#", }]
    },

];