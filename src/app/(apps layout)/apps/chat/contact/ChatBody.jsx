import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import SimpleBar from 'simplebar-react';
import classNames from 'classnames';
import { Button, Dropdown } from 'react-bootstrap';
import { CornerUpRight, MoreHorizontal } from 'react-feather';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

//Images
import emptyChat from '@/assets/img/start-conversation.png';
import avatar2 from '@/assets/img/avatar2.jpg';

const ChatBody = ({ contactMsg }) => {
    const { states } = useGlobalStateContext();
    const [messages, setMessages] = useState(states.chatState.contactMsg);
    const [startConversation, setStartConversation] = useState(false);

    const handleConversation = () => {
        setStartConversation(true);
        if (startConversation) {
            document.getElementById("input_contact_chat").focus();
        }
    }

    //Get New Messages
    useEffect(() => {
        setMessages(states.chatState.contactMsg);
    }, [states.chatState, messages]);

    // 👇️ scroll to bottom every time messages change
    const scrollRefs = useRef(null);
    useEffect(() => {
        scrollRefs.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    return (
        <SimpleBar id="chat_body" className="chat-body">
            {
                (messages.length > 1)
                    ?
                    <ul className="list-unstyled chat-single-list">
                        {
                            messages.map((elem, index) => (
                                <li className={classNames("media", (elem.types))} key={index}>
                                    {elem.types === "received" && <div className="avatar avatar-xs avatar-rounded">
                                        <Image src={avatar2} alt="user" className="avatar-img" />
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
                    :
                    <div className="start-conversation">
                        <Image className="d-block img-fluid" src={emptyChat} alt="empty-chat" />
                        <Button variant="soft-primary" size="lg" className="mt-3" onClick={handleConversation} >Start Conversation</Button>
                    </div>
            }
            <div ref={scrollRefs} />

        </SimpleBar>
    )
}

export default ChatBody;