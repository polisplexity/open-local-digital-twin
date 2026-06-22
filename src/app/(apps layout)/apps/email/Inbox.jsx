import Image from 'next/image';
import { useState } from 'react';
import { Badge, Button, Dropdown, Form, ListGroup } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';
import classNames from 'classnames';
import { useWindowWidth } from '@react-hook/window-size';
import { Archive, Calendar, Check, Edit, Inbox, Layout, Mail, RefreshCw, Send, Settings, Star, Trash2 } from 'react-feather';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';
import ComposeEmail from './ComposeEmail';

//Images
import avatar2 from '@/assets/img/avatar2.jpg';
import avatar3 from '@/assets/img/avatar3.jpg';
import avatar7 from '@/assets/img/avatar7.jpg';
import avatar8 from '@/assets/img/avatar8.jpg';
import avatar9 from '@/assets/img/avatar9.jpg';
import avatar10 from '@/assets/img/avatar10.jpg';

const InboxList = ({ show, toggleSidebar }) => {
    const { states, dispatch } = useGlobalStateContext();
    const [showComposePopup, setShowComposePopup] = useState(false);

    const width = useWindowWidth();
    const Conversation = () => {
        if (width <= 991) {
            dispatch({ type: "open_email" })
            dispatch({ type: "top_nav_toggle" })

        }
    }

    return (
        <>
            <div className="emailapp-aside">
                <header className="aside-header">
                    <Dropdown>
                        <Dropdown.Toggle as="a" className="emailapp-title link-dark" href="#">
                            <h1>Inbox</h1>
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <Dropdown.Item>
                                <span className="feather-icon dropdown-icon">
                                    <Inbox />
                                </span>
                                <span>Inbox</span>
                            </Dropdown.Item>
                            <Dropdown.Item>
                                <span className="feather-icon dropdown-icon">
                                    <Send />
                                </span>
                                <span>Sent</span>
                            </Dropdown.Item>
                            <Dropdown.Item>
                                <span className="feather-icon dropdown-icon">
                                    <Archive />
                                </span>
                                <span>Archive</span>
                            </Dropdown.Item>
                            <Dropdown.Item>
                                <span className="feather-icon dropdown-icon">
                                    <Edit />
                                </span>
                                <span>Draft</span>
                            </Dropdown.Item>
                            <Dropdown.Item>
                                <span className="feather-icon dropdown-icon">
                                    <Trash2 />
                                </span>
                                <span>Trash</span>
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                    <div className="d-flex">
                        <Button as="a" href="#" className="btn-icon btn-flush-dark btn-rounded flush-soft-hover me-0">
                            <span className="icon">
                                <span className="feather-icon">
                                    <RefreshCw />
                                </span>
                            </span>
                        </Button>
                        <Dropdown>
                            <Dropdown.Toggle as="a" href="#" className="btn btn-icon  btn-rounded flush-soft-hover btn-flush-dark dropdown-toggle no-caret me-1">
                                <span className="icon">
                                    <span className="feather-icon">
                                        <Settings />
                                    </span>
                                </span>
                            </Dropdown.Toggle>
                            <Dropdown.Menu align="end" >
                                <Dropdown.Item>
                                    <span className="feather-icon dropdown-icon">
                                        <Mail />
                                    </span>
                                    <span>Show unread messages</span>
                                </Dropdown.Item>
                                <Dropdown.Item>
                                    <span className="feather-icon dropdown-icon">
                                        <Star />
                                    </span>
                                    <span>Show Starred Messages</span>
                                </Dropdown.Item>
                                <Dropdown.Item>
                                    <span className="feather-icon dropdown-icon">
                                        <Calendar />
                                    </span>
                                    <span>Sort by Date</span>
                                </Dropdown.Item>
                                <Dropdown.Item>
                                    <span className="feather-icon dropdown-icon">
                                        <Layout />
                                    </span>
                                    <span>Sort by Category</span>
                                </Dropdown.Item>
                                <Dropdown.Item>
                                    <span className="feather-icon dropdown-icon">
                                        <Check />
                                    </span>
                                    <span>Mark all as read</span></Dropdown.Item>
                                <div className="dropdown-divider" />
                                <Dropdown.Item>Settings</Dropdown.Item>
                                <Dropdown.Item>Help</Dropdown.Item>
                                <Dropdown.Item>Report a problem	</Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                        <Button as="a" href="#" className="btn-icon btn-rounded show-compose-popup" onClick={() => dispatch({ type: "compose_email", composeEmail: !states.emailState.composeEmail })} >
                            <span className="icon">
                                <span className="feather-icon">
                                    <Edit />
                                </span>
                            </span>
                        </Button>
                    </div>
                    <div className={classNames("hk-sidebar-togglable", { "active": !show })} onClick={toggleSidebar} />
                </header>
                <SimpleBar className="aside-body">
                    <Form className="aside-search" role="search">
                        <Form.Control type="text" placeholder="Search inbox" />
                    </Form>
                    <ListGroup as="ul" variant="flush" className="email-list">
                        <ListGroup.Item as="li" onClick={Conversation} >
                            <div className="media">
                                <div className="media-head">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar2} alt="user" className="avatar-img" />
                                    </div>
                                    <Badge bg="primary" className="badge-indicator badge-indicator-nobdr" />
                                </div>
                                <div className="media-body">
                                    <div>
                                        <div>
                                            <div className="email-head">Morgan Freeman</div>
                                            <div>
                                                <span className="email-star marked">
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                <div className="email-time">9:30 AM</div>
                                            </div>
                                        </div>
                                        <div className="email-subject">Creation timelines for our forth</div>
                                        <div className="email-text">
                                            <p>Abilities or he perfectly pretended so strangers be exquisite. Oh to anothe.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item as="li" onClick={Conversation} >
                            <div className="media read-email">
                                <div className="media-head">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar9} alt="user" className="avatar-img" />
                                    </div>
                                </div>
                                <div className="media-body">
                                    <div>
                                        <div>
                                            <div className="email-head">Huma Therman</div>
                                            <Badge pill bg="warning" className="badge-sm ">updates</Badge>
                                            <div>
                                                <span className="email-star"><span className="feather-icon"><Star /></span></span>
                                                <div className="email-time">7:51 AM</div>
                                            </div>
                                        </div>
                                        <div className="email-subject">Proposal for 3rd quarter.</div>
                                        <div className="email-text">
                                            <p>Excellent so to no sincerity smallness. Removal request delight if on he we can grow together.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item as="li" onClick={Conversation} >
                            <div className="media read-email active-user">
                                <div className="media-head">
                                    <div className="avatar avatar-sm avatar-soft-success avatar-rounded">
                                        <span className="initial-wrap">C</span>
                                    </div>
                                </div>
                                <div className="media-body">
                                    <div>
                                        <div>
                                            <div className="email-head">Charlie Chaplin</div>
                                            <div>
                                                <span className="email-star"><span className="feather-icon"><Star /></span></span>
                                                <div className="email-time">Yesterday</div>
                                            </div>
                                        </div>
                                        <div className="email-subject">Built a robust platform for jampack.</div>
                                        <div className="email-text">
                                            <p>So how did the classical latin become so insensive about things tiy do things you change in the world that is insane.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item as="li" onClick={Conversation} >
                            <div className="media">
                                <div className="media-head">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar10} alt="user" className="avatar-img" />
                                    </div>
                                    <Badge bg="primary" className="badge-indicator badge-indicator-nobdr" />
                                </div>
                                <div className="media-body">
                                    <div>
                                        <div>
                                            <div className="email-head">Winston Churchil</div>
                                            <div>
                                                <span className="email-star marked"><span className="feather-icon"><Star /></span></span>
                                                <div className="email-time">3 Mar</div>
                                            </div>
                                        </div>
                                        <div className="email-subject">Transactions in your account for.</div>
                                        <div className="email-text">
                                            <p>Letter wooded direct two men indeed income sister. Impression up admiration he by partiality is.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item as="li" onClick={Conversation} >
                            <div className="media read-email">
                                <div className="media-head">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar3} alt="user" className="avatar-img" />
                                    </div>
                                </div>
                                <div className="media-body">
                                    <div>
                                        <div>
                                            <div className="email-head">Jaquiline Joker</div>
                                            <Badge bg="primary" pill className="badge-sm">Team</Badge>
                                            <div>
                                                <span className="email-star marked"><span className="feather-icon"><Star /></span></span>
                                                <div className="email-time">3 Mar</div>
                                            </div>
                                        </div>
                                        <div className="email-subject">Launching jampack beta version</div>
                                        <div className="email-text">
                                            <p>Instantly immediate his saw one day perceived. Old blushes respect but offices hearted minutes effects.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item as="li" onClick={Conversation} >
                            <div className="media read-email">
                                <div className="media-head">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar7} alt="user" className="avatar-img" />
                                    </div>
                                </div>
                                <div className="media-body">
                                    <div>
                                        <div>
                                            <div className="email-head">Tom Cruz</div>
                                            <Badge bg="success" pill className="badge-sm">support</Badge>
                                            <div>
                                                <span className="email-star"><span className="feather-icon"><Star /></span></span>
                                                <div className="email-time">28 Feb</div>
                                            </div>
                                        </div>
                                        <div className="email-subject">Charges and brokerage plans issue.</div>
                                        <div className="email-text">
                                            <p>Son read such next see the rest two. Was use extent old entire sus. Curiosity remaining own see repulsive.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item as="li" onClick={Conversation} >
                            <div className="media">
                                <div className="media-head">
                                    <div className="avatar avatar-sm avatar-soft-danger avatar-rounded">
                                        <span className="initial-wrap">D</span>
                                    </div>
                                    <Badge bg="primary" className="badge-indicator badge-indicator-nobdr" />
                                </div>
                                <div className="media-body">
                                    <div>
                                        <div>
                                            <div className="email-head">Danial Craig</div>
                                            <div>
                                                <span className="email-star"><span className="feather-icon"><Star /></span></span>
                                                <div className="email-time">25 Feb</div>
                                            </div>
                                        </div>
                                        <div className="email-subject">Invoice for design services.</div>
                                        <div className="email-text">
                                            <p>Supposing exquisite daughters eagerness why repulsive for. Praise turned it lovers be warmly by.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item as="li" onClick={Conversation} >
                            <div className="media read-email">
                                <div className="media-head">
                                    <div className="avatar avatar-sm avatar-rounded">
                                        <Image src={avatar8} alt="user" className="avatar-img" />
                                    </div>
                                    <Badge bg="primary" className="badge-indicator badge-indicator-nobdr" />
                                </div>
                                <div className="media-body">
                                    <div>
                                        <div>
                                            <div className="email-head">Katherine Jones</div>
                                            <div>
                                                <span className="email-star marked">
                                                    <span className="feather-icon">
                                                        <Star />
                                                    </span>
                                                </span>
                                                <div className="email-time">22 Feb</div>
                                            </div>
                                        </div>
                                        <div className="email-subject">Welcome to Jampack team.</div>
                                        <div className="email-text">
                                            <p>Incommode our not one ourselves residence. Shall there whose those stand she end.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ListGroup.Item>
                        <ListGroup.Item as="li" onClick={Conversation} >
                            <div className="media read-email">
                                <div className="media-head">
                                    <div className="avatar avatar-sm avatar-success avatar-rounded">
                                        <span className="initial-wrap">H</span>
                                    </div>
                                </div>
                                <div className="media-body">
                                    <div>
                                        <div>
                                            <div className="email-head">Hencework</div>
                                            <div>
                                                <span className="email-star marked"><span className="feather-icon"><Star /></span></span>
                                                <div className="email-time">30 Jan</div>
                                            </div>
                                        </div>
                                        <div className="email-subject">Dear Danial, regarding reversal of.</div>
                                        <div className="email-text">
                                            <p>So unaffected partiality indulgence dispatched to of celebrated remarkably. Unfeeling are had allowance..</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ListGroup.Item>
                    </ListGroup>
                </SimpleBar>
            </div>
            {/* Compose email */}
            <ComposeEmail show={showComposePopup} onClose={() => setShowComposePopup(!showComposePopup)} />
            {/* /Compose email */}
        </>
    )
}


export default InboxList;
