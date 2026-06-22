import classNames from 'classnames';
import { Button, Dropdown, Form } from 'react-bootstrap';
import { ChevronDown, ChevronUp, Download, FolderPlus, Grid, List, Server, UploadCloud } from 'react-feather';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import * as Icons from 'react-feather';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

const GalleryHeader = ({ toggleSidebar, showSidebar, toggleInfo }) => {

    const { states, dispatch } = useGlobalStateContext();

    return (
        <header className="gallery-header">
            <div className="d-flex align-items-center flex-grow-1">
                <Dropdown>
                    <Dropdown.Toggle as="a" href="#" variant="link-dark" className="galleryapp-title link-dark">
                        <h1>Media Gallery</h1>
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Icons.HardDrive />
                            </span>
                            <span>Gallery</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Icons.Folder />
                            </span>
                            <span>Collections</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Icons.Upload />
                            </span>
                            <span>Shared with me</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Icons.Star />
                            </span>
                            <span>Favorite</span>
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
                <Form className="mx-3 flex-grow-1 mw-400p" role="search">
                    <Form.Control type="text" placeholder="Search media by Name" />
                </Form>
            </div>
            <div className="gallery-options-wrap">
                <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover btn-file-download disabled d-xl-inline-block d-none" href="#">
                    <span className="icon">
                        <span className="feather-icon">
                            <Download />
                        </span>
                    </span>
                </Button>
                <div className="v-separator d-xl-inline-block d-none" />
                <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover ms-0 d-xl-inline-block d-none" href="#">
                    <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="Add New Folder">
                        <span className="icon">
                            <span className="feather-icon">
                                <FolderPlus />
                            </span>
                        </span>
                    </HkTooltip>
                </Button>
                <Button as="a" variant="flush-dark" className="btn-icon btn-rounded btn-file flush-soft-hover  d-md-inline-block d-none" href="#">
                    <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="Upload">
                        <span className="icon">
                            <span className="feather-icon">
                                <UploadCloud />
                            </span>
                        </span>
                    </HkTooltip>
                </Button>
                <div className="v-separator d-lg-inline-block d-none" />
                <Dropdown>
                    <Dropdown.Toggle as="a" variant="flush-dark" className=" btn btn-icon btn-flush-dark flush-soft-hover dropdown-toggle no-caret active ms-lg-0 d-sm-inline-block d-none">
                        <span className="icon">
                            <span className="feather-icon">
                                <List />
                            </span>
                        </span>
                    </Dropdown.Toggle>
                    <Dropdown.Menu align="end">
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <List />
                            </span>
                            <span>List View</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Grid />
                            </span>
                            <span>Grid View</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Server />
                            </span>
                            <span>Compact View</span>
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
                <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover hk-navbar-togglable" onClick={() => dispatch({ type: "top_nav_toggle" })} >
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
            <div className={classNames("hk-sidebar-togglable", { "active": !showSidebar })} onClick={toggleSidebar} />
        </header>
    )
}

export default GalleryHeader;