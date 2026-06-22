import { Nav, Tab, } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';
import { columns, data } from '@/data/file-manager/fmListData';
import HkDataTable from '@/components/@hk-data-table'


const FmList = ({ toggleInfo }) => {

    return (
        <div className="fm-body">
            <SimpleBar className="nicescroll-bar">
                <div className="file-list-view">
                    <Tab.Container defaultActiveKey="cloud_doc" >
                        <Nav as="ul" variant="tabs" className="nav-line nav-icon nav-light">
                            <Nav.Item as="li">
                                <Nav.Link eventKey="cloud_doc">
                                    <span className="nav-link-text">Cloud Documents</span>
                                </Nav.Link>
                            </Nav.Item>
                            <Nav.Item as="li">
                                <Nav.Link>
                                    <span className="nav-link-text">Shared with me</span>
                                </Nav.Link>
                            </Nav.Item>
                        </Nav>
                        <Tab.Content>
                            <Tab.Pane eventKey="cloud_doc">
                                <HkDataTable
                                    column={columns}
                                    rowData={data}
                                    rowSelection={true}
                                    markStarred={true}
                                    classes="nowrap w-100 mb-5"
                                    responsive
                                />
                            </Tab.Pane>
                        </Tab.Content>
                    </Tab.Container>
                </div>
            </SimpleBar>
        </div>
    )
}

export default FmList
