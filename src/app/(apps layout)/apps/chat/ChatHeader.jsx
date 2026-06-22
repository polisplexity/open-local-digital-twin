import Image from 'next/image';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button, Dropdown } from 'react-bootstrap';
import { useWindowWidth } from '@react-hook/window-size';
import classNames from 'classnames';
import { Archive, ChevronDown, ChevronLeft, ChevronUp, ExternalLink, Info, MoreVertical, Phone, Slash, Star, UserPlus, Video } from 'react-feather';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import HkBadge from '@/components/@hk-badge/@hk-badge';
import AudioCallModal from './AudioCallModal';
import VideoCallModal from './VideoCallModal';

//Images
import avatar2 from '@/assets/img/avatar2.jpg';


const ChatHeader = ({ infoState, infoToggle, invitePeople }) => {
    const { states, dispatch } = useGlobalStateContext();
    const [audioCall, setAudioCall] = useState(false);
    const [videoCall, setVideoCall] = useState(false);

    const pathname = usePathname()
    const chatsRoute = pathname.match("/apps/chat/chats");
    const groupRoutes = pathname.match("/apps/chat/groups");
    const contactsRoute = pathname.match("/apps/chat/contact");

    const width = useWindowWidth();
    const BackToContactList = () => {
        dispatch({ type: "start_chat" })
        dispatch({ type: "top_nav_toggle" })
    }

    return (
        <>
            <header className="chat-header">
                <Button as="a" href="#" variant="flush-dark" size="sm" className="btn-icon btn-rounded flush-soft-hover back-user-list" onClick={BackToContactList} > {/*onClick={BackToContactList}*/}
                    <span className="icon">
                        <span className="feather-icon">
                            <ChevronLeft />
                        </span>
                    </span>
                </Button>
                {chatsRoute &&
                    <div className="media">
                        <div className="media-head">
                            <div className="avatar avatar-sm avatar-rounded position-relative">
                                {states.chatState.avatar.type === "img" && <Image src={states.chatState.avatar.src} alt="user" className="avatar-img" />}
                                {states.chatState.avatar.type === "init" && <div className={`avatar avatar-sm avatar-${states.chatState.avatar.variant} avatar-rounded`}>
                                    <span className="initial-wrap">{states.chatState.avatar.title}</span>
                                </div>}
                                {(states.chatState.status === "Online" || states.chatState.status === "Typing") && <HkBadge bg="success" indicator className="badge-indicator-lg position-bottom-end-overflow-1" />}
                            </div>
                        </div>
                        <div className="media-body">
                            <div className="user-name">{states.chatState.userName}</div>
                            <div className="user-status">
                                {states.chatState.status}
                                {states.chatState.status === "Typing" && <><span className="one">.</span><span className="two">.</span><span className="three">.</span></>}
                            </div>
                        </div>
                    </div>
                }

                {groupRoutes && <div className="media">
                    <div className="media-head">
                        <div className={states.chatState.grpAvatar.type === "img" ? "avatar avatar-sm position-relative avatar-rounded avatar-primary" : `avatar avatar-sm position-relative avatar-rounded avatar-${states.chatState.grpAvatar.variant}`}>
                            {states.chatState.grpAvatar.type === "img" && <Image src={states.chatState.grpAvatar.src} alt="user" className="avatar-img" />}
                            {states.chatState.grpAvatar.type === "init" && <span className="initial-wrap">{states.chatState.grpAvatar.title}</span>}
                            <div className="badge-icon badge-circle badge-icon-xxs text-white position-bottom-end-overflow-1">
                                <div className="badge-icon-wrap">
                                    <i className="ri-group-fill text-light" />
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 141 141">
                                    <g transform="translate(-79 -975)">
                                        <path d="M70.5,0A70.5,70.5,0,1,1,0,70.5,70.5,70.5,0,0,1,70.5,0Z" transform="translate(79 975)" fill="#fff" />
                                        <path d="M55.5,0A55.5,55.5,0,1,1,0,55.5,55.5,55.5,0,0,1,55.5,0Z" transform="translate(94 990)" fill="#fff" />
                                    </g>
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div className="media-body">
                        <div className="user-name">{states.chatState.groupName}</div>
                        <div className="user-status">{states.chatState.grpStatus}</div>
                    </div>
                </div>}

                {contactsRoute && <div className="media">
                    <div className="media-head">
                        <div className="avatar avatar-sm avatar-rounded position-relative">
                            <Image src={avatar2} alt="user" className="avatar-img" />
                            <HkBadge bg="success" indicator className="badge-indicator-lg position-bottom-end-overflow-1" />
                        </div>
                    </div>
                    <div className="media-body">
                        <div className="user-name">Alan Rickman</div>
                        <div className="user-status">Online</div>
                    </div>
                </div>}

                <div className="chat-options-wrap">
                    <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover d-none d-xl-block" onClick={invitePeople} >
                        <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="Invite people">
                            <span className="feather-icon">
                                <UserPlus />
                            </span>
                        </HkTooltip>
                    </Button>
                    <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover d-none d-xl-block" onClick={() => setAudioCall(!audioCall)} >
                        <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="Audio Call">
                            <span className="icon"  >
                                <span className="feather-icon">
                                    <Phone />
                                </span>
                            </span>
                        </HkTooltip>
                    </Button>
                    <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover d-none d-xl-block" onClick={() => setVideoCall(!videoCall)} >
                        <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="Video Call">
                            <span className="feather-icon">
                                <Video />
                            </span>
                        </HkTooltip>
                    </Button>
                    <Button as="a" variant="flush-dark" className={classNames("btn-icon btn-rounded flush-soft-hover chatapp-info-toggle", { "active": infoState })} onClick={infoToggle} >
                        <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="Info">
                            <span className="icon">
                                <span className="feather-icon">
                                    <Info />
                                </span>
                            </span>
                        </HkTooltip>
                    </Button>
                    <Dropdown className="inline-block ms-1" >
                        <Dropdown.Toggle as="a" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret" href="#">
                            <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="More">
                                <span className="feather-icon">
                                    <MoreVertical />
                                </span>
                            </HkTooltip>
                        </Dropdown.Toggle>
                        <Dropdown.Menu align="end" >
                            <Dropdown.Item className="d-xl-none" onClick={invitePeople}>
                                <span className="feather-icon dropdown-icon">
                                    <UserPlus />
                                </span>
                                <span>Invite People</span>
                            </Dropdown.Item>
                            <Dropdown.Item className="d-xl-none" onClick={() => setAudioCall(!audioCall)} >
                                <span className="feather-icon dropdown-icon">
                                    <Phone />
                                </span>
                                <span>Audio Call</span>
                            </Dropdown.Item>
                            <Dropdown.Item className="d-xl-none" onClick={() => setVideoCall(!videoCall)} >
                                <span className="feather-icon dropdown-icon">
                                    <Video />
                                </span>
                                <span>Video Call</span>
                            </Dropdown.Item>
                            <Dropdown.Divider className="d-xl-none" />
                            <Dropdown.Item>
                                <span className="feather-icon dropdown-icon">
                                    <Star />
                                </span>
                                <span>Stared Messages</span>
                            </Dropdown.Item>
                            <Dropdown.Item><span className="feather-icon dropdown-icon">
                                <Archive />
                            </span>
                                <span>Archive Messages</span>
                            </Dropdown.Item>
                            <div className="dropdown-divider" />
                            <Dropdown.Item><span className="feather-icon dropdown-icon">
                                <Slash />
                            </span>
                                <span>Block Content</span>
                            </Dropdown.Item>
                            <Dropdown.Item><span className="feather-icon dropdown-icon">
                                <ExternalLink />
                            </span>
                                <span>Feedback</span>
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                    <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover hk-navbar-togglable d-none d-lg-block" onClick={() => dispatch({ type: "top_nav_toggle" })} >
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
            </header>

            {/*Audio Call Window */}
            <AudioCallModal show={audioCall} hide={() => setAudioCall(!audioCall)} />
            {/*Video Call Window */}
            <VideoCallModal show={videoCall} hide={() => setVideoCall(!videoCall)} />
        </>
    )
}

export default ChatHeader;