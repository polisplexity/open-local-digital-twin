import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import classNames from 'classnames';
import { Button, Dropdown, ListGroup } from 'react-bootstrap';
import { ArrowDown, MoreHorizontal, MoreVertical } from 'react-feather';
import SimpleBar from 'simplebar-react';
import HkBadge from '@/components/@hk-badge/@hk-badge';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

//Images
import avatar1 from '@/assets/img/avatar1.jpg';
import avatar2 from '@/assets/img/avatar2.jpg';
import avatar3 from '@/assets/img/avatar3.jpg';
import avatar4 from '@/assets/img/avatar4.jpg';
import avatar7 from '@/assets/img/avatar7.jpg';
import avatar8 from '@/assets/img/avatar8.jpg';
import avatar9 from '@/assets/img/avatar9.jpg';
import avatar11 from '@/assets/img/avatar11.jpg';
import avatar15 from '@/assets/img/avatar15.jpg';
import gify from '@/assets/img/giphy.gif';

const ChatPopupBody = ({ showContactList }) => {
    const { states } = useGlobalStateContext();
    const [messages, setMessages] = useState(states.chatPopupState.directMsgs);
    const [isTyping, setIsTyping] = useState(true);

    //Get New Messages
    useEffect(() => {
        setMessages(states.chatPopupState.directMsgs);
        if (messages.length > 0) {
            setIsTyping(false);
        }
    }, [states, messages]);

    // 👇️ scroll to bottom every time messages change
    const bottomRef = useRef(null);
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    return (
        <div className="chat-popup-body">
            <SimpleBar className="nicescroll-bar">
                <div>
                    <div className={classNames("contact-list-wrap", { "d-none": !showContactList })}>
                        <ListGroup as="ul" variant="flush" className="chat-contacts-list">
                            <li>
                                <div className="title title-wth-divider text-primary my-3"><span>A</span></div>
                            </li>
                            <ListGroup.Item as="li">
                                <div className="media">
                                    <div className="media-head">
                                        <div className="avatar avatar-sm avatar-rounded position-relative">
                                            <Image src={avatar2} alt="user" className="avatar-img" />
                                            <HkBadge bg="success" indicator className="badge-indicator-lg position-bottom-end-overflow-1" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div>
                                            <div className="user-name">Alan Rickman</div>
                                            <div className="user-status">Today I don&apos;t feel like doing anything</div>
                                        </div>
                                        <div>
                                            <Dropdown className="action-drp">
                                                <Dropdown.Toggle as="a" href="#" className="btn-icon btn-rounded btn-flush-dark flush-soft-hover no-caret">
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreHorizontal />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Delete Chat</Dropdown.Item>
                                                    <Dropdown.Item className="link-danger">Block</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </ListGroup.Item>
                            <ListGroup.Item as="li">
                                <div className="media">
                                    <div className="media-head">
                                        <div className="avatar avatar-sm avatar-rounded position-relative">
                                            <Image src={avatar8} alt="user" className="avatar-img" />
                                            <HkBadge bg="success" indicator className="badge-indicator-lg position-bottom-end-overflow-1" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div>
                                            <div className="user-name">Ashley Jude</div>
                                            <div className="user-status">Ma life ma rules😍</div>
                                        </div>
                                        <div>
                                            <Dropdown className="action-drp">
                                                <Dropdown.Toggle as="a" href="#" className="btn-icon btn-rounded btn-flush-dark flush-soft-hover no-caret">
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreHorizontal />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Delete Chat</Dropdown.Item>
                                                    <Dropdown.Item className="link-danger">Block</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </ListGroup.Item>
                            <ListGroup.Item as="li">
                                <div className="media">
                                    <div className="media-head">
                                        <div className="avatar avatar-sm avatar-rounded position-relative">
                                            <Image src={avatar11} alt="user" className="avatar-img" />
                                            <HkBadge bg="success" indicator className="badge-indicator-lg position-bottom-end-overflow-1" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div>
                                            <div className="user-name">Adam Sandler</div>
                                            <div className="user-status">Hi There, I am using Jampack</div>
                                        </div>
                                        <div>
                                            <Dropdown className="action-drp">
                                                <Dropdown.Toggle as="a" href="#" className="btn-icon btn-rounded btn-flush-dark flush-soft-hover no-caret">
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreHorizontal />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Delete Chat</Dropdown.Item>
                                                    <Dropdown.Item className="link-danger">Block</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </ListGroup.Item>
                            <li>
                                <div className="title title-wth-divider text-primary my-3"><span>B</span></div>
                            </li>
                            <ListGroup.Item as="li">
                                <div className="media">
                                    <div className="media-head">
                                        <div className="avatar avatar-sm avatar-rounded position-relative">
                                            <Image src={avatar4} alt="user" className="avatar-img" />
                                            <HkBadge bg="success" indicator className="badge-indicator-lg position-bottom-end-overflow-1" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div>
                                            <div className="user-name">Billy Zen</div>
                                            <div className="user-status">👿Take me to the places!!</div>
                                        </div>
                                        <div>
                                            <Dropdown className="action-drp">
                                                <Dropdown.Toggle as="a" href="#" className="btn-icon btn-rounded btn-flush-dark flush-soft-hover no-caret">
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreHorizontal />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Delete Chat</Dropdown.Item>
                                                    <Dropdown.Item className="link-danger">Block</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </ListGroup.Item>
                            <ListGroup.Item as="li">
                                <div className="media">
                                    <div className="media-head">
                                        <div className="avatar avatar-sm avatar-rounded position-relative">
                                            <Image src={avatar1} alt="user" className="avatar-img" />
                                            <HkBadge bg="success" indicator className="badge-indicator-lg position-bottom-end-overflow-1" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div>
                                            <div className="user-name">Bradley Cooper</div>
                                            <div className="user-status">Always Busy</div>
                                        </div>
                                        <div>
                                            <Dropdown className="action-drp">
                                                <Dropdown.Toggle as="a" href="#" className="btn-icon btn-rounded btn-flush-dark flush-soft-hover no-caret">
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreHorizontal />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Delete Chat</Dropdown.Item>
                                                    <Dropdown.Item className="link-danger">Block</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </ListGroup.Item>
                            <ListGroup.Item as="li">
                                <div className="media">
                                    <div className="media-head">
                                        <div className="avatar avatar-sm avatar-rounded position-relative">
                                            <Image src={avatar15} alt="user" className="avatar-img" />
                                            <HkBadge bg="success" indicator className="badge-indicator-lg position-bottom-end-overflow-1" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div>
                                            <div className="user-name">Brad Pitt</div>
                                            <div className="user-status">No calls, telepathy only</div>
                                        </div>
                                        <div>
                                            <Dropdown className="action-drp">
                                                <Dropdown.Toggle as="a" href="#" className="btn-icon btn-rounded btn-flush-dark flush-soft-hover no-caret">
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreHorizontal />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Delete Chat</Dropdown.Item>
                                                    <Dropdown.Item className="link-danger">Block</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </ListGroup.Item>
                            <ListGroup.Item as="li">
                                <div className="media">
                                    <div className="media-head">
                                        <div className="avatar avatar-sm avatar-soft-danger avatar-rounded position-relative">
                                            <span className="initial-wrap">B</span>
                                            <HkBadge bg="success" indicator className="badge-indicator-lg position-bottom-end-overflow-1" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div>
                                            <div className="user-name">Ben Afflex</div>
                                            <div className="user-status">¬¬¬ on vacation</div>
                                        </div>
                                        <div>
                                            <Dropdown className="action-drp">
                                                <Dropdown.Toggle as="a" href="#" className="btn-icon btn-rounded btn-flush-dark flush-soft-hover no-caret">
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreHorizontal />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Delete Chat</Dropdown.Item>
                                                    <Dropdown.Item className="link-danger">Block</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </ListGroup.Item>
                            <ListGroup.Item as="li">
                                <div className="media">
                                    <div className="media-head">
                                        <div className="avatar avatar-sm avatar-rounded position-relative">
                                            <Image src={avatar3} alt="user" className="avatar-img" />
                                            <HkBadge bg="success" indicator className="badge-indicator-lg position-bottom-end-overflow-1" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div>
                                            <div className="user-name">Barbara Harshey</div>
                                            <div className="user-status">Dead like a python</div>
                                        </div>
                                        <div>
                                            <Dropdown className="action-drp">
                                                <Dropdown.Toggle as="a" href="#" className="btn-icon btn-rounded btn-flush-dark flush-soft-hover no-caret">
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreHorizontal />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Delete Chat</Dropdown.Item>
                                                    <Dropdown.Item className="link-danger">Block</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </ListGroup.Item>
                            <li>
                                <div className="title title-wth-divider text-primary my-3"><span>C</span></div>
                            </li>
                            <ListGroup.Item as="li">
                                <div className="media">
                                    <div className="media-head">
                                        <div className="avatar avatar-sm avatar-rounded position-relative">
                                            <Image src={avatar7} alt="user" className="avatar-img" />
                                            <HkBadge bg="success" indicator className="badge-indicator-lg position-bottom-end-overflow-1" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div>
                                            <div className="user-name">Colin Hanks</div>
                                            <div className="user-status">No calls. Always Busy</div>
                                        </div>
                                        <div>
                                            <Dropdown className="action-drp">
                                                <Dropdown.Toggle as="a" href="#" className="btn-icon btn-rounded btn-flush-dark flush-soft-hover no-caret">
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreHorizontal />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Delete Chat</Dropdown.Item>
                                                    <Dropdown.Item className="link-danger">Block</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </ListGroup.Item>
                            <ListGroup.Item as="li">
                                <div className="media">
                                    <div className="media-head">
                                        <div className="avatar avatar-sm avatar-rounded">
                                            <Image src={avatar9} alt="user" className="avatar-img" />
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div>
                                            <div className="user-name">Chuck Norris</div>
                                            <div className="user-status">Hi There, I am using Jampack</div>
                                        </div>
                                        <div>
                                            <Dropdown className="action-drp">
                                                <Dropdown.Toggle as="a" href="#" className="btn-icon btn-rounded btn-flush-dark flush-soft-hover no-caret">
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreHorizontal />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Delete Chat</Dropdown.Item>
                                                    <Dropdown.Item className="link-danger">Block</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </ListGroup.Item>
                            <ListGroup.Item as="li">
                                <div className="media">
                                    <div className="media-head">
                                        <div className="avatar avatar-sm avatar-soft-info avatar-rounded">
                                            <span className="initial-wrap">C</span>
                                        </div>
                                    </div>
                                    <div className="media-body">
                                        <div>
                                            <div className="user-name">Christian Bale</div>
                                            <div className="user-status">No status to show</div>
                                        </div>
                                        <div>
                                            <Dropdown className="action-drp">
                                                <Dropdown.Toggle as="a" href="#" className="btn-icon btn-rounded btn-flush-dark flush-soft-hover no-caret">
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreHorizontal />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Delete Chat</Dropdown.Item>
                                                    <Dropdown.Item className="link-danger">Block</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </ListGroup.Item>
                        </ListGroup>
                    </div>
                    <ul className={classNames("list-unstyled", { "d-none": showContactList })}>
                        <li className="media received">
                            <div className="avatar avatar-xs avatar-rounded">
                                <Image src={avatar8} alt="user" className="avatar-img" />
                            </div>
                            <div className="media-body">
                                <div className="msg-box">
                                    <div>
                                        <p>Cool, lets talk about it tomorrow</p>
                                        <span className="chat-time">10:52 PM</span>
                                        <div className="msg-action">
                                            <Dropdown>
                                                <Dropdown.Toggle variant="flush-dark" size="sm" href="#some" className="btn-icon btn-rounded flush-soft-hover no-caret" >
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreVertical />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Reply</Dropdown.Item>
                                                    <Dropdown.Item>Forward</Dropdown.Item>
                                                    <Dropdown.Item>Copy</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                                <div className="msg-box">
                                    <div>
                                        <p>Images for new marketing pages have been sent</p>
                                        <span className="chat-time">10:53 PM</span>
                                        <div className="msg-action">
                                            <Dropdown>
                                                <Dropdown.Toggle variant="flush-dark" size="sm" href="#some" className="btn-icon btn-rounded flush-soft-hover no-caret" >
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreVertical />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Reply</Dropdown.Item>
                                                    <Dropdown.Item>Forward</Dropdown.Item>
                                                    <Dropdown.Item>Copy</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                        <li className="day-sep">
                            <span>Today</span>
                        </li>
                        <li className="media media-attachment received">
                            <div className="avatar avatar-xs avatar-rounded">
                                <Image src={avatar8} alt="user" className="avatar-img" />
                            </div>
                            <div className="media-body msg-docs">
                                <div className="msg-box">
                                    <div>
                                        <div className="media">
                                            <div className="avatar avatar-icon avatar-sm avatar-blue">
                                                <span className="initial-wrap fs-3">
                                                    <i className="ri-file-excel-2-fill" />
                                                </span>
                                            </div>
                                            <div className="media-body">
                                                <p className="file-name">Website_content.xls</p>
                                                <p className="file-size">2,635 KB</p>
                                            </div>
                                        </div>
                                        <div className="file-overlay">
                                            <Button variant="primary" size="sm" className="btn-icon btn-rounded">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <ArrowDown />
                                                    </span>
                                                </span>
                                            </Button>
                                        </div>
                                        <div className="msg-action">
                                            <Dropdown>
                                                <Dropdown.Toggle variant="flush-dark" size="sm" href="#some" className="btn-icon btn-rounded flush-soft-hover no-caret" >
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreVertical />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Reply</Dropdown.Item>
                                                    <Dropdown.Item>Forward</Dropdown.Item>
                                                    <Dropdown.Item>Copy</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                                <div className="msg-box">
                                    <div>
                                        <div className="media">
                                            <div className="avatar avatar-icon avatar-sm avatar-warning">
                                                <span className="initial-wrap fs-3">
                                                    <i className="ri-file-zip-fill" />
                                                </span>
                                            </div>
                                            <div className="media-body">
                                                <p className="file-name">jampack.zip</p>
                                                <p className="file-size">2.45 GB</p>
                                            </div>
                                        </div>
                                        <div className="file-overlay">
                                            <Button variant="primary" size="sm" className="btn-icon btn-rounded">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <ArrowDown />
                                                    </span>
                                                </span>
                                            </Button>
                                        </div>
                                        <div className="msg-action">
                                            <Dropdown>
                                                <Dropdown.Toggle variant="flush-dark" size="sm" href="#some" className="btn-icon btn-rounded flush-soft-hover no-caret" >
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreVertical />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Reply</Dropdown.Item>
                                                    <Dropdown.Item>Forward</Dropdown.Item>
                                                    <Dropdown.Item>Copy</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                        <li className="media sent">
                            <div className="media-body">
                                <div className="msg-box">
                                    <div>
                                        <p>Anyways, I am working on something that you would like to know.</p>
                                        <span className="chat-time">11:52 PM</span>
                                        <div className="msg-action">
                                            <Dropdown>
                                                <Dropdown.Toggle variant="flush-dark" size="sm" href="#some" className="btn-icon btn-rounded flush-soft-hover no-caret" >
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreVertical />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Reply</Dropdown.Item>
                                                    <Dropdown.Item>Forward</Dropdown.Item>
                                                    <Dropdown.Item>Copy</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                        <li className="media media-attachment received">
                            <div className="avatar avatar-xs avatar-rounded">
                                <Image src={avatar8} alt="user" className="avatar-img" />
                            </div>
                            <div className="media-body msg-imgs">
                                <div className="msg-box">
                                    <div>
                                        <Image className="d-block img-fluid" src={gify} alt="gif" />
                                        <div className="msg-action">
                                            <Dropdown>
                                                <Dropdown.Toggle variant="flush-dark" size="sm" href="#some" className="btn-icon btn-rounded flush-soft-hover no-caret" >
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreVertical />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Reply</Dropdown.Item>
                                                    <Dropdown.Item>Forward</Dropdown.Item>
                                                    <Dropdown.Item>Copy</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                        <li className="media sent">
                            <div className="media-body">
                                <div className="msg-box">
                                    <div>
                                        <p>Haha, this is joke 😍</p>
                                        <span className="chat-time">10:52 PM</span>
                                        <div className="msg-action">
                                            <Dropdown>
                                                <Dropdown.Toggle variant="flush-dark" size="sm" href="#some" className="btn-icon btn-rounded flush-soft-hover no-caret" >
                                                    <span className="icon">
                                                        <span className="feather-icon">
                                                            <MoreVertical />
                                                        </span>
                                                    </span>
                                                </Dropdown.Toggle>
                                                <Dropdown.Menu align="end">
                                                    <Dropdown.Item>Reply</Dropdown.Item>
                                                    <Dropdown.Item>Forward</Dropdown.Item>
                                                    <Dropdown.Item>Copy</Dropdown.Item>
                                                </Dropdown.Menu>
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>

                        {
                            messages.map((elem, index) => (
                                <li className={classNames("media", (elem.types))} key={index}>
                                    {elem.types === "received" && <div className="avatar avatar-xs avatar-rounded">
                                        <Image src={avatar8} alt="user" className="avatar-img" />
                                    </div>}
                                    <div className="media-body">
                                        <div className="msg-box">
                                            <div>
                                                <p>{elem.text}</p>
                                                <span className="chat-time">{elem.time}</span>
                                                <div className="msg-action">
                                                    <Dropdown>
                                                        <Dropdown.Toggle variant="flush-dark" size="sm" href="#some" className="btn-icon btn-rounded flush-soft-hover no-caret" >
                                                            <span className="icon">
                                                                <span className="feather-icon">
                                                                    <MoreVertical />
                                                                </span>
                                                            </span>
                                                        </Dropdown.Toggle>
                                                        <Dropdown.Menu align="end">
                                                            <Dropdown.Item>Reply</Dropdown.Item>
                                                            <Dropdown.Item>Forward</Dropdown.Item>
                                                            <Dropdown.Item>Copy</Dropdown.Item>
                                                        </Dropdown.Menu>
                                                    </Dropdown>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ))
                        }
                        {isTyping && <li className="media received typing-wrap">
                            <div className="avatar avatar-xs avatar-rounded">
                                <Image src={avatar8} alt="user" className="avatar-img" />
                            </div>
                            <div className="media-body">
                                <div className="msg-box">
                                    <div>
                                        <div className="typing">
                                            <div className="dot" />
                                            <div className="dot" />
                                            <div className="dot" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>}
                    </ul>
                    <div ref={bottomRef} />
                </div>
            </SimpleBar>
        </div>
    )
}


export default ChatPopupBody;