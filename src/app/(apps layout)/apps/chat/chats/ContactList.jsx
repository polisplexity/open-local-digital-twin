import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import SimpleBar from 'simplebar-react';
import classNames from 'classnames';
import * as Icons from 'react-feather';
import { Dropdown, Form, ListGroup } from 'react-bootstrap';
import { useWindowWidth } from '@react-hook/window-size';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';
import contacts from '@/data/chat/contact-list';

//Images
import avatar1 from '@/assets/img/avatar1.jpg';
import avatar8 from '@/assets/img/avatar8.jpg';
import avatar15 from '@/assets/img/avatar15.jpg';


const ContactList = ({ invitePeople }) => {

    const { states, dispatch } = useGlobalStateContext();
    const [list, setList] = useState(contacts)
    const [searchValue, setSearchValue] = useState("");
    const width = useWindowWidth();

    const Conversation = (index, id) => {
        (list[index].avatar) ? dispatch({ type: "set_user", userId: list[index].id, avatar: list[index].avatar, userName: list[index].name, status: list[index].status }) : dispatch({ type: "set_user", userId: list[index].id, avatar: list[index].initAvatar, userName: list[index].name, status: list[index].status })

        const updatedContacts = contacts.map((contactList) =>
            contactList.id === id ? { ...contactList, unread: 0 } : contactList
        );
        setList(updatedContacts);

        if (width <= 991) {
            dispatch({ type: "start_chat" })
            dispatch({ type: "top_nav_toggle" })
        }

    }

    const searchOnChange = (event) => {
        setSearchValue(event.target.value);
        // Create copy of item list
        var updatedList = [...contacts];
        // Include all elements which includes the search query
        updatedList = updatedList.filter((item) => searchValue.length > 1 ? item.name.toString().toLowerCase().includes(searchValue.toLocaleLowerCase()) : item
        );
        // Trigger render with updated values
        setList(updatedList);
    }

    return (
        <>
            <div className="chatapp-aside">
                <header className="aside-header">
                    <Dropdown>
                        <Dropdown.Toggle as="a" className="chatapp-title link-dark" href="#" >
                            <h1>Chat</h1>
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
                            <Dropdown.Toggle as="a" href="#" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover dropdown-toggle no-caret me-1">
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
                        <a className="btn btn-icon btn-rounded btn-primary" onClick={invitePeople} >
                            <span className="icon">
                                <span className="feather-icon">
                                    <Icons.Plus />
                                </span>
                            </span>
                        </a>
                    </div>
                </header>
                <SimpleBar style={{ height: "100%" }} className="aside-body" >
                    <Form className="aside-search" role="search">
                        <Form.Control type="text" placeholder="Search Chats" value={searchValue} onChange={searchOnChange} />
                    </Form>
                    <div className="frequent-contact">
                        <div className="title-sm text-primary"><span>Frequent contact</span></div>
                        <ul className="hk-list">
                            <li>
                                <div className="avatar avatar-sm avatar-primary position-relative avatar-rounded">
                                    <span className="initial-wrap">H</span>
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
                            </li>
                            <li>
                                <div className="avatar avatar-sm avatar-primary position-relative avatar-rounded">
                                    <Image src={avatar1} alt="user" className="avatar-img" />
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
                            </li>
                            <li>
                                <div className="avatar avatar-sm avatar-soft-danger avatar-rounded position-relative">
                                    <span className="initial-wrap">W</span>
                                    <span className="badge badge-success badge-indicator badge-indicator-lg position-bottom-end-overflow-1" />
                                </div>
                            </li>
                            <li>
                                <div className="avatar avatar-sm avatar-rounded position-relative">
                                    <Image src={avatar8} alt="user" className="avatar-img" />
                                    <span className="badge badge-success badge-indicator badge-indicator-lg position-bottom-end-overflow-1" />
                                </div>
                            </li>
                            <li>
                                <div className="avatar avatar-sm avatar-rounded">
                                    <Image src={avatar15} alt="user" className="avatar-img" />
                                </div>
                            </li>
                        </ul>
                    </div>
                    <ListGroup variant="flush" className="chat-contacts-list">
                        {
                            list.map((elem, index) => (
                                <ListGroup.Item onClick={() => Conversation(index, elem.id)} key={index} >
                                    <div className={classNames("media", { "active-user": elem.id === states.chatState.userId }, { "read-chat": !elem.unread })}>
                                        <div className="media-head">
                                            {elem.avatar && <div className="avatar avatar-sm avatar-rounded position-relative">
                                                <Image src={elem.avatar.src} alt="user" className="avatar-img" />
                                                {elem.status === "online" && <span className="badge badge-success badge-indicator badge-indicator-lg position-bottom-end-overflow-1" />}
                                            </div>}
                                            {elem.initAvatar && <div className={`avatar avatar-sm avatar-${elem.initAvatar.variant} avatar-rounded`}>
                                                <span className="initial-wrap">{elem.initAvatar.title}</span>
                                            </div>}
                                        </div>
                                        <div className="media-body">
                                            <div>
                                                <div className="user-name">{elem.name}</div>
                                                <div className="user-last-chat">{elem.lastChat}</div>
                                            </div>
                                            <div>
                                                <div className="last-chat-time">{elem.time}</div>
                                                {elem.unread > 0 && <div className="badge badge-primary badge-sm badge-pill">{elem.unread}</div>}
                                                <div className="dropdown action-drp">
                                                    <a href="#" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover dropdown-toggle no-caret" data-bs-toggle="dropdown"><span className="icon"><span className="feather-icon"><i data-feather="more-horizontal" /></span></span></a>
                                                    <div className="dropdown-menu dropdown-menu-end">
                                                        <a className="dropdown-item" href="#">Mute Chat</a>
                                                        <a className="dropdown-item" href="#">Archive Chat</a>
                                                        <a className="dropdown-item" href="#">Delete Chat</a>
                                                        <a className="dropdown-item link-danger" href="#">Block</a>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </ListGroup.Item>
                            ))
                        }
                    </ListGroup>
                </SimpleBar>
            </div>
        </>
    )
}

export default ContactList;