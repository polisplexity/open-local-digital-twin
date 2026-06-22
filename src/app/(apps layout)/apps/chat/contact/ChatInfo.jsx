import Image from 'next/image';
import { Button, Form } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Briefcase, Mail, MapPin, Phone } from 'react-feather';
import { faDropbox, faFacebook, faGithub, faGoogle, faGoogleDrive } from '@fortawesome/free-brands-svg-icons';
import HkCollapse from '@/components/@hk-collapse/@hk-collapse';

//Image
import avatar2 from '@/assets/img/avatar2.jpg';

const ChatInfo = ({ infoToggle }) => {
    return (
        <div className="chat-info">
            <SimpleBar className="nicescroll-bar">
                <Button bsPrefix=" btn-close" className="info-close" onClick={infoToggle} >
                    <span aria-hidden="true">×</span>
                </Button>
                <div className="text-center">
                    <div className="avatar avatar-xxl avatar-rounded">
                        <Image src={avatar2} alt="user" className="avatar-img" />
                    </div>
                    <div className="cp-name text-truncate mt-2">Alan Rickman</div>
                    <p className="text-truncate">Today I don&apos;t feel like doing anything.. I just wanna laying in my bed</p>
                </div>
                <div className="mt-4">
                    <Form role="search">
                        <Form.Control type="text" placeholder="Search in conversation" />
                    </Form>
                    <div className="collapse-simple mt-3">
                        <HkCollapse
                            bsPrefix="a"
                            href="#"
                            targetId="contact_gn_info"
                            title="General Info"
                            collapsed={false}
                        >
                            <ul className="cp-info">
                                <li>
                                    <a href="#">
                                        <span className="cp-icon-wrap"><span className="feather-icon">
                                            <Briefcase />
                                        </span></span>
                                        Co-Founder
                                    </a>
                                </li>
                                <li>
                                    <a href="#">
                                        <span className="cp-icon-wrap"><span className="feather-icon">
                                            <Mail />
                                        </span></span>
                                        <span className="text-primary">contact@hencework.com</span>
                                    </a>
                                </li>
                                <li>
                                    <a href="#">
                                        <span className="cp-icon-wrap"><span className="feather-icon">
                                            <Phone />
                                        </span></span>
                                        +91-25-4125-2365
                                    </a>
                                </li>
                                <li>
                                    <a href="#">
                                        <span className="cp-icon-wrap"><span className="feather-icon">
                                            <MapPin />
                                        </span></span>
                                        Oslo, Canada
                                    </a>
                                </li>
                            </ul>
                        </HkCollapse>

                        <HkCollapse
                            bsPrefix="a"
                            href="#"
                            targetId="contact_social_profile"
                            title="Social Profile"
                            collapsed={false}
                        >
                            <ul className="hk-list hk-list-sm">
                                <li>
                                    <Button variant="primary" className="btn-icon btn-rounded"><span className="icon">
                                        <FontAwesomeIcon icon={faFacebook} />
                                    </span></Button>
                                </li>
                                <li>
                                    <Button variant="warning" className="btn-icon btn-rounded"><span className="icon">
                                        <FontAwesomeIcon icon={faGoogleDrive} />
                                    </span></Button>
                                </li>
                                <li>
                                    <Button variant="info" className="btn-icon btn-rounded"><span className="icon">
                                        <FontAwesomeIcon icon={faDropbox} />
                                    </span></Button>
                                </li>
                                <li>
                                    <Button variant="dark" className="btn-icon btn-rounded"><span className="icon">
                                        <FontAwesomeIcon icon={faGithub} />
                                    </span></Button>
                                </li>
                                <li>
                                    <Button variant="danger" className="btn-icon btn-rounded"><span className="icon">
                                        <FontAwesomeIcon icon={faGoogle} />
                                    </span></Button>
                                </li>
                            </ul>
                        </HkCollapse>

                        <HkCollapse
                            bsPrefix="a"
                            href="#"
                            targetId="contact_biography"
                            title="Biography"
                            collapsed={false}
                        >
                            <div>
                                <p>Hello there, Alan Rickman is a brilliant co-founder and a copy writer working for almost a decade for fortune 500 companies. I am well verse with multiple foreign languages and I love to produce good quality stuff. </p>
                            </div>
                        </HkCollapse>

                        <HkCollapse
                            bsPrefix="a"
                            href="#"
                            targetId="contact_settings"
                            title="Settings"
                            collapsed={false}
                        >
                            <ul className="cp-action">
                                <li>
                                    <a href="#">
                                        Clear Chat
                                    </a>
                                </li>
                                <li>
                                    <a href="#">
                                        <span className="text-danger">Block Contact</span>
                                    </a>
                                </li>
                                <li>
                                    <a href="#">
                                        Somthing&apos;s Wrong
                                    </a>
                                </li>
                            </ul>
                        </HkCollapse>
                    </div>
                </div>
            </SimpleBar >
        </div >
    )
}

export default ChatInfo
