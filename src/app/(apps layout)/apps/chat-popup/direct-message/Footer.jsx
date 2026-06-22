import { useGlobalStateContext } from '@/context/GolobalStateProvider';
import { useState } from 'react';
import { Button, Dropdown, Form, InputGroup } from 'react-bootstrap';
import { Share, Smile } from 'react-feather';

const ChatPopupFooter = ({ directMsgs, DirectMsg }) => {
    const [messages, setMessages] = useState([]);
    const { dispatch } = useGlobalStateContext();

    //Get current system time
    const current = new Date();
    const currentTime = current.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
    });
    //Sent a new messages
    const sendMessage = () => {
        if (messages.length > 0) {

            dispatch({ type: "send_direct_msg", directMsgs: { text: messages, time: currentTime, types: "sent" } });
            //default response
            setTimeout(() => {
                dispatch({ type: "send_direct_msg", directMsgs: { text: "What are you saying?", time: currentTime, types: "received" } });
            }, 800);
        }
        else {
            alert("Please type something!");
        }
    }
    const onKeyDown = (e) => {  
        if (e.keyCode === 13) {
            sendMessage();
            setMessages("");
        }
    }

    return (
        <footer>
            <InputGroup>
                <div className="input-group-text overflow-show border-0">
                    <Dropdown>
                        <Dropdown.Toggle variant="flush-dark" className="btn-icon flush-soft-hover btn-rounded no-caret" >
                            <span className="icon">
                                <span className="feather-icon">
                                    <Share />
                                </span>
                            </span>
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <Dropdown.Item>
                                <div className="d-flex align-items-center">
                                    <div className="avatar avatar-icon avatar-xs avatar-soft-primary avatar-rounded me-3">
                                        <span className="initial-wrap">
                                            <i className="ri-image-line" />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="h6 mb-0">Photo or Video Library</span>
                                    </div>
                                </div>
                            </Dropdown.Item>
                            <Dropdown.Item>
                                <div className="d-flex align-items-center">
                                    <div className="avatar avatar-icon avatar-xs avatar-soft-info avatar-rounded me-3">
                                        <span className="initial-wrap">
                                            <i className="ri-file-4-line" />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="h6 mb-0">Documents</span>
                                    </div>
                                </div>
                            </Dropdown.Item>
                            <Dropdown.Item>
                                <div className="d-flex align-items-center">
                                    <div className="avatar avatar-icon avatar-xs avatar-soft-success avatar-rounded me-3">
                                        <span className="initial-wrap">
                                            <i className="ri-map-pin-line" />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="h6 mb-0">Location</span>
                                    </div>
                                </div>
                            </Dropdown.Item>
                            <Dropdown.Item>
                                <div className="d-flex align-items-center">
                                    <div className="avatar avatar-icon avatar-xs avatar-soft-blue avatar-rounded me-3">
                                        <span className="initial-wrap">
                                            <i className="ri-contacts-line" />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="h6 mb-0">Contact</span>
                                    </div>
                                </div>
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </div>
                <Form.Control type="text" id="input_msg_chat_popup_3" name="send-msg" className="input-msg-send border-0 shadow-none" placeholder="Type something..." value={messages} onChange={e => setMessages(e.target.value)} onKeyDown={onKeyDown} />
                <div className="input-group-text overflow-show border-0">
                    <Button variant="flush-dark" className="btn-icon flush-soft-hover btn-rounded">
                        <span className="icon">
                            <span className="feather-icon">
                                <Smile />
                            </span>
                        </span>
                    </Button>
                </div>
            </InputGroup>
        </footer>
    )
}


export default ChatPopupFooter;