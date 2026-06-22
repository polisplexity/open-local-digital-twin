import { useState } from 'react';
import Image from 'next/image';
import classNames from 'classnames';
import { Button, Dropdown, Form, ListGroup, Nav } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';
import * as Icons from 'react-feather';
import InvitePeopleModal from '../InvitePeopleModal';
import { useWindowWidth } from '@react-hook/window-size';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';
import groupList from '@/data/chat/group-list';
import Link from 'next/link';

const GroupList = () => {

    const { states, dispatch } = useGlobalStateContext();
    const [list, setList] = useState(groupList);
    const [searchTerm, setSearchTerm] = useState("");
    const [showInviteModal, setShowInviteModal] = useState(false);

    const width = useWindowWidth();

    const Conversation = (index) => {

        (list[index].avatar) ? dispatch({ type: "select_group", grpId: list[index].id, grpAvatar: list[index].avatar, groupName: list[index].group, grpStatus: list[index].status }) : dispatch({ type: "select_group", grpId: list[index].id, grpAvatar: list[index].initAvatar, groupName: list[index].group, grpStatus: list[index].status })

        if (width <= 991) {
            dispatch({ type: "start_chat" })
            dispatch({ type: "top_nav_toggle" })
        }
    }

    const searchFilter = (event) => {
        setSearchTerm(event.target.value);
        // Create copy of item list
        var updatedList = [...groupList];
        // Include all elements which includes the search query
        updatedList = updatedList.filter((item) => searchTerm.length > 1 ? item.group.toString().toLowerCase().includes(searchTerm.toLocaleLowerCase()) : item
        );
        // Trigger render with updated values
        setList(updatedList);
    }

    return (
        <>
            <InvitePeopleModal show={showInviteModal} onClose={() => setShowInviteModal(!showInviteModal)} />
            <div className="chatapp-aside">
                <header className="aside-header">
                    <Dropdown>
                        <Dropdown.Toggle as="a" href="#" className="chatapp-title link-dark" >
                            <h1>Groups</h1>
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <Dropdown.Item as={Link} href="chats">
                                <span className="feather-icon dropdown-icon">
                                    <Icons.MessageSquare />
                                </span>
                                <span>Chats</span>
                            </Dropdown.Item>
                            <Dropdown.Item as={Link} href="contact">
                                <span className="feather-icon dropdown-icon">
                                    <Icons.Book />
                                </span>
                                <span>Contacts</span>
                            </Dropdown.Item>
                            <Dropdown.Item as={Link} href="groups">
                                <span className="feather-icon dropdown-icon">
                                    <Icons.User />
                                </span>
                                <span>Groups</span>
                            </Dropdown.Item>
                            <Dropdown.Item href="#">
                                <span className="feather-icon dropdown-icon">
                                    <Icons.Archive />
                                </span>
                                <span>Archived</span>
                            </Dropdown.Item>
                            <Dropdown.Item href="#">
                                <span className="feather-icon dropdown-icon">
                                    <Icons.Star />
                                </span>
                                <span>Favorites</span>
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                    <div className="d-flex">
                        <Dropdown>
                            <Dropdown.Toggle as="a" href="#" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret me-1">
                                <span className="icon">
                                    <span className="feather-icon">
                                        <Icons.Settings />
                                    </span>
                                </span>
                            </Dropdown.Toggle>
                            <Dropdown.Menu align="end" >
                                <Dropdown.Item href="#">
                                    <span className="feather-icon dropdown-icon">
                                        <Icons.UserCheck />
                                    </span>
                                    <span>Active Contacts</span>
                                </Dropdown.Item>
                                <Dropdown.Item href="#">
                                    <span className="feather-icon dropdown-icon">
                                        <Icons.MessageSquare />
                                    </span>
                                    <span>Chat Requests</span>
                                </Dropdown.Item>
                                <Dropdown.Item href="#">
                                    <span className="feather-icon dropdown-icon">
                                        <Icons.Archive />
                                    </span>
                                    <span>Archived Chats</span>
                                </Dropdown.Item>
                                <Dropdown.Item href="#">
                                    <span className="feather-icon dropdown-icon">
                                        <Icons.ToggleRight />
                                    </span>
                                    <span>Unread Chats</span>
                                </Dropdown.Item>
                                <Dropdown.Divider as="div" />
                                <Dropdown.Item href="#">Settings</Dropdown.Item>
                                <Dropdown.Item href="#">Help</Dropdown.Item>
                                <Dropdown.Item href="#">Report a problem	</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                        <Button variant="primary" className="btn-icon btn-rounded" onClick={() => setShowInviteModal(!showInviteModal)} >
                            <span className="icon">
                                <span className="feather-icon">
                                    <Icons.Plus />
                                </span>
                            </span>
                        </Button>
                    </div>
                </header>
                <SimpleBar style={{ height: "100%" }} className="aside-body">
                    <Form className="aside-search" role="search">
                        <Form.Control type="text" placeholder="Search Contacts" value={searchTerm} onChange={searchFilter} />
                    </Form>
                    <ListGroup as="ul" variant="flush" className="chat-contacts-list">
                        {list.map((item, index) => (
                            <ListGroup.Item as="li" onClick={() => Conversation(index)} key={index}>
                                <div className={classNames("media", { "active-user read-chat": item.id === states.chatState.grpId })}>
                                    <div className="media-head">
                                        <div className={item.avatar ? "avatar avatar-sm position-relative avatar-rounded avatar-primary" : `avatar avatar-sm position-relative avatar-rounded avatar-${item.initAvatar.variant}`}>
                                            {item.avatar && <Image src={item.avatar.src} alt="user" className="avatar-img" />}
                                            {item.initAvatar && <span className="initial-wrap">{item.initAvatar.title}</span>}
                                            <div className="badge-icon badge-circle badge-icon-xxs text-white position-bottom-end-overflow-1">
                                                <div className="badge-icon-wrap">
                                                    <i className="ri-group-fill text-light" />
                                                </div>
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 127 127">
                                                    <g data-name="Ellipse 302" transform="translate(8 8)" strokeWidth={3}>
                                                        <circle cx="55.5" cy="55.5" r="55.5" stroke="currentColor" />
                                                        <circle cx="55.5" cy="55.5" r="59.5" fill="currentColor" />
                                                    </g>
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div>
                                            <div className="user-name">{item.group}</div>
                                            <div className="user-last-chat">{item.lastChat}</div>
                                        </div>
                                        <div>
                                            <Dropdown className="action-drp">
                                                <Dropdown.Toggle href="#" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret">
                                                    <span className="btn-icon-wrap">
                                                        <span className="feather-icon">
                                                            <Icons.MoreHorizontal />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item href="#exit">Exit Group</Dropdown.Item>
                                                    <Dropdown.Item href="#delete">Delete Group</Dropdown.Item>
                                                    <Dropdown.Item href="#mute">Mute Group</Dropdown.Item>
                                                    <Dropdown.Item className="link-danger" href="#block">Block</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </ListGroup.Item>
                        ))}
                    </ListGroup>
                    <div className="title-xs text-uppercase text-primary mt-4"><span>Channels</span></div>
                    <Nav variant="light" className="channels-list flex-column">
                        <Nav.Item>
                            <Nav.Link className="link-dark">#Developer</Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link className="link-dark">#Designer&apos;ss</Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link className="link-dark">#HRManagement</Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link className="link-dark">#Team_goals</Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link className="link-dark">#Support_jampack</Nav.Link>
                        </Nav.Item>
                    </Nav>
                </SimpleBar>
            </div >
        </>
    )
}

export default GroupList;

