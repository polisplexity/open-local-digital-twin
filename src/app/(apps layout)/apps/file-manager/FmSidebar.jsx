import { Button, Nav } from 'react-bootstrap';
import * as Icons from 'react-feather';
import SimpleBar from 'simplebar-react';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';

const FmSidebar = () => {
    return (
        <nav className="fmapp-sidebar">
            <SimpleBar className="nicescroll-bar">
                <div className="menu-content-wrap">
                    <div className="btn btn-primary btn-rounded btn-block btn-file mb-4">
                        Upload
                        <input type="file" className="upload" />
                    </div>
                    <div className="menu-group">
                        <ul className="nav nav-light navbar-nav flex-column">
                            <li className="nav-item active">
                                <a className="nav-link" href="#some">
                                    <span className="nav-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.HardDrive />
                                        </span>
                                    </span>
                                    <span className="nav-link-text">My Space</span>
                                </a>
                            </li>
                            <li className="nav-item">
                                <a className="nav-link" href="#some">
                                    <span className="nav-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.File />
                                        </span>
                                    </span>
                                    <span className="nav-link-text">All Files</span>
                                </a>
                            </li>
                            <li className="nav-item">
                                <a className="nav-link" href="#some">
                                    <span className="nav-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.Folder />
                                        </span>
                                    </span>
                                    <span className="nav-link-text">Folders</span>
                                </a>
                            </li>
                            <li className="nav-item">
                                <a className="nav-link" href="#some">
                                    <span className="nav-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.Upload />
                                        </span>
                                    </span>
                                    <span className="nav-link-text">Shared</span>
                                </a>
                            </li>
                            <li className="nav-item">
                                <a className="nav-link" href="#some">
                                    <span className="nav-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.Star />
                                        </span>
                                    </span>
                                    <span className="nav-link-text">Starred</span>
                                </a>
                            </li>
                            <li className="nav-item">
                                <a className="nav-link" href="#some">
                                    <span className="nav-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.Trash2 />
                                        </span>
                                    </span>
                                    <span className="nav-link-text">Trash</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div className="separator separator-light" />
                    <div className="menu-group">
                        <ul className="nav nav-light navbar-nav flex-column">
                            <li className="nav-item">
                                <a className="nav-link" href="#some">
                                    <span className="nav-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.Image />
                                        </span>
                                    </span>
                                    <span className="nav-link-text">Images</span>
                                </a>
                            </li>
                            <li className="nav-item">
                                <a className="nav-link" href="#some">
                                    <span className="nav-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.Video />
                                        </span>
                                    </span>
                                    <span className="nav-link-text">Videos</span>
                                </a>
                            </li>
                            <li className="nav-item">
                                <a className="nav-link" href="#some">
                                    <span className="nav-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.Play />
                                        </span>
                                    </span>
                                    <span className="nav-link-text">Audio</span>
                                </a>
                            </li>
                            <li className="nav-item">
                                <a className="nav-link" href="#some">
                                    <span className="nav-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.FileText />
                                        </span>
                                    </span>
                                    <span className="nav-link-text">Documents</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </SimpleBar>
            <div className="fmapp-storage">
                <p className="p-sm">Storage is 85% full. 78.5 GB of 1 TB used. You can buy more space.</p>
                <div className="progress-lb-wrap my-2">
                    <label className="progress-label text-uppercase fs-8 fw-medium">78.5 GB of 1 TB</label>
                    <div className="progress progress-bar-rounded progress-bar-xs">
                        <div className="progress-bar bg-danger w-85" role="progressbar" aria-valuenow={25} aria-valuemin={0} aria-valuemax={100} />
                    </div>
                </div>
                <a href="#some" className="fs-7"><u>Buy Storage</u></a>
            </div>
            {/*Sidebar Fixnav*/}
            <div className="fmapp-fixednav">
                <div className="hk-toolbar">
                    <Nav className="nav-light">
                        <Nav.Item className="nav-link">
                            <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                                <HkTooltip id="tooltip2" placement="top" title="Settings" >
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <Icons.Settings />
                                        </span>
                                    </span>
                                </HkTooltip>
                            </Button>
                        </Nav.Item>
                        <Nav.Item className="nav-link">
                            <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                                <HkTooltip id="tooltip3" placement="top" title="Archive" >
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <Icons.Archive />
                                        </span>
                                    </span>
                                </HkTooltip>
                            </Button>
                        </Nav.Item>
                        <Nav.Item className="nav-link">
                            <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                                <HkTooltip id="tooltip2" placement="top" title="Help" >
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <Icons.Book />
                                        </span>
                                    </span>
                                </HkTooltip>
                            </Button>
                        </Nav.Item>
                    </Nav>
                </div>
            </div>
            {/*/ Sidebar Fixnav*/}
        </nav>
    )
}

export default FmSidebar
