import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button, Dropdown } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';
import classNames from 'classnames';
import { ArrowDown, CornerUpRight, MoreHorizontal } from 'react-feather';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

//Images
import avatar8 from '@/assets/img/avatar8.jpg';
import avatar9 from '@/assets/img/avatar9.jpg';
import avatar10 from '@/assets/img/avatar10.jpg';

const GroupChatBody = () => {
    const { states } = useGlobalStateContext();
    const [messages, setMessages] = useState(states.chatState.grpMsg);

    //Get New Messages
    useEffect(() => {
        setMessages(states.chatState.grpMsg);
    }, [states.chatState, messages]);

    // 👇️ scroll to bottom every time messages change
    const scrollRef = useRef(null);
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <SimpleBar id="chat_body" className="chat-body">
            <ul className="list-unstyled chat-single-list">
                <li className="media received">
                    <div className="avatar avatar-xs avatar-rounded">
                        <Image src={avatar8} alt="user" className="avatar-img" />
                    </div>
                    <div className="media-body">
                        <div className="msg-box">
                            <div>
                                <p>Cool, lets talk about it tomorrow</p>
                                <span className="chat-time">10:52 PM</span>
                            </div>
                            <div className="msg-action">
                                <Button className="btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <CornerUpRight />
                                        </span>
                                    </span>
                                </Button>
                                <Dropdown>
                                    <Dropdown.Toggle className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover dropdown-toggle no-caret">
                                        <span className="icon">
                                            <span className="feather-icon">
                                                <MoreHorizontal />
                                            </span>
                                        </span>
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu align="end">
                                        <Dropdown.Item href="#forward">Forward</Dropdown.Item>
                                        <Dropdown.Item href="#copy">Copy</Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>
                        </div>
                        <div className="msg-box">
                            <div>
                                <p>Images for new marketing pages have been sent</p>
                                <span className="chat-time">10:53 PM</span>
                            </div>
                            <div className="msg-action">
                                <Button className="btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <CornerUpRight />
                                        </span>
                                    </span>
                                </Button>
                                <Dropdown>
                                    <Dropdown.Toggle className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover dropdown-toggle no-caret">
                                        <span className="icon">
                                            <span className="feather-icon">
                                                <MoreHorizontal />
                                            </span>
                                        </span>
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu align="end">
                                        <Dropdown.Item href="#forward">Forward</Dropdown.Item>
                                        <Dropdown.Item href="#copy">Copy</Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>
                        </div>
                    </div>
                </li>
                <li className="media media-attachment received">
                    <div className="avatar avatar-xs avatar-rounded">
                        <Image src={avatar9} alt="user" className="avatar-img" />
                    </div>
                    <div className="media-body msg-docs">
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
                                    <button className="btn btn-sm btn-icon btn-rounded btn-primary"><span className="icon">
                                        <span className="feather-icon">
                                            <ArrowDown />
                                        </span>
                                    </span></button>
                                </div>
                            </div>
                            <div className="msg-action">
                                <Button className="btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <CornerUpRight />
                                        </span>
                                    </span>
                                </Button>
                                <Dropdown>
                                    <Dropdown.Toggle className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover dropdown-toggle no-caret">
                                        <span className="icon">
                                            <span className="feather-icon">
                                                <MoreHorizontal />
                                            </span>
                                        </span>
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu align="end">
                                        <Dropdown.Item href="#forward">Forward</Dropdown.Item>
                                        <Dropdown.Item href="#copy">Copy</Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>
                        </div>
                    </div>
                </li>
                <li className="day-sep">
                    <span>Today</span>
                </li>
                <li className="media sent">
                    <div className="media-body">
                        <div className="msg-box">
                            <div>
                                <p>I need you help in it.</p>
                                <span className="chat-time">11:52 PM</span>
                            </div>
                            <div className="msg-action">
                                <Button className="btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <CornerUpRight />
                                        </span>
                                    </span>
                                </Button>
                                <Dropdown>
                                    <Dropdown.Toggle className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover dropdown-toggle no-caret">
                                        <span className="icon">
                                            <span className="feather-icon">
                                                <MoreHorizontal />
                                            </span>
                                        </span>
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu align="end">
                                        <Dropdown.Item href="#forward">Forward</Dropdown.Item>
                                        <Dropdown.Item href="#copy">Copy</Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>
                        </div>
                    </div>
                </li>
                <li className="media sent">
                    <div className="media-body">
                        <div className="msg-box">
                            <div>
                                <p>Haha, this joke is hilarious. Is it what your heart feel about the salary? 😍</p>
                                <span className="chat-time">10:52 PM</span>
                            </div>
                            <div className="msg-action">
                                <Button className="btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <CornerUpRight />
                                        </span>
                                    </span>
                                </Button>
                                <Dropdown>
                                    <Dropdown.Toggle className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover dropdown-toggle no-caret">
                                        <span className="icon">
                                            <span className="feather-icon">
                                                <MoreHorizontal />
                                            </span>
                                        </span>
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu align="end">
                                        <Dropdown.Item href="#forward">Forward</Dropdown.Item>
                                        <Dropdown.Item href="#copy">Copy</Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>
                        </div>
                    </div>
                </li>
                <li className="media received">
                    <div className="avatar avatar-xs avatar-rounded">
                        <Image src={avatar10} alt="user" className="avatar-img" />
                    </div>
                    <div className="media-body">
                        <div className="msg-box">
                            <div>
                                <p>Hey Ben, just a reminder that you are coming for the meeting today in the conference. We are proposing a change in the client briefing.</p>
                                <span className="chat-time">9:20 AM</span>
                            </div>
                            <div className="msg-action">
                                <Button className="btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret">
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <CornerUpRight />
                                        </span>
                                    </span>
                                </Button>
                                <Dropdown>
                                    <Dropdown.Toggle className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover dropdown-toggle no-caret">
                                        <span className="icon">
                                            <span className="feather-icon">
                                                <MoreHorizontal />
                                            </span>
                                        </span>
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu align="end">
                                        <Dropdown.Item href="#forward">Forward</Dropdown.Item>
                                        <Dropdown.Item href="#copy">Copy</Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>
                        </div>
                    </div>
                </li>
                {
                    messages.map((elem, index) => (
                        <li className={classNames("media", (elem.types))} key={index}>
                            {elem.types === "received" && <div className="avatar avatar-xs avatar-rounded">
                                {elem.avatar.type === "img" && <Image src={elem.avatar.src} alt="user" className="avatar-img" />}
                                {elem.avatar.type === "init" && <div className={`avatar avatar-xs avatar-${elem.avatar.variant} avatar-rounded`}>
                                    <span className="initial-wrap">{elem.avatar.title}</span>
                                </div>}
                            </div>}
                            <div className="media-body">
                                <div className="msg-box" id="msg-1" >
                                    <div>
                                        <p>{elem.text}</p>
                                        <span className="chat-time">{elem.time}</span>
                                    </div>
                                    <div className="msg-action">
                                        <Button className="btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret">
                                            <span className="icon">
                                                <span className="feather-icon">
                                                    <CornerUpRight />
                                                </span>
                                            </span>
                                        </Button>
                                        <Dropdown>
                                            <Dropdown.Toggle variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover dropdown-toggle no-caret">
                                                <span className="icon">
                                                    <span className="feather-icon">
                                                        <MoreHorizontal />
                                                    </span>
                                                </span>
                                            </Dropdown.Toggle>
                                            <Dropdown.Menu align="end">
                                                <Dropdown.Item href="#forward">Forward</Dropdown.Item>
                                                <Dropdown.Item href="#copy">Copy</Dropdown.Item>
                                            </Dropdown.Menu>
                                        </Dropdown>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))
                }
            </ul>
            <div ref={scrollRef} />
        </SimpleBar>
    )
}

export default GroupChatBody;