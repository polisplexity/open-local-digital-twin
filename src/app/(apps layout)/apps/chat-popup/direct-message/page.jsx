'use client';
import { useState } from 'react'
import classNames from 'classnames';
import { Button, OverlayTrigger, Popover } from 'react-bootstrap';
import { MessageCircle } from 'react-feather';
import ChatPopupBody from './ChatPopupBody';
import ChatPopupFooter from './Footer';
import ChatPopupHeader from './Header';

const ChatPopup = () => {
    const [showChatPopup, setShowChatPopup] = useState(true);
    const [showContacts, setShowContacts] = useState(false);

    const handleChatPopup = () => {
        setShowChatPopup(!showChatPopup);
    }

    const ChatPopover = (
        <Popover>
            <Popover.Body className="shadow-xl" >
                Try Jampack Chat for free and connect with your customers now!
            </Popover.Body>
        </Popover>
    )

    return (
        <div>
            <div className={classNames("hk-chat-popup", { "d-flex": showChatPopup })} >
                <ChatPopupHeader show={showChatPopup} onClose={() => setShowChatPopup(!showChatPopup)} showContact={showContacts} onHideContact={() => setShowContacts(!showContacts)} />
                <ChatPopupBody showContactList={showContacts} />
                {!showContacts && <ChatPopupFooter />}
            </div>
            <OverlayTrigger placement="top" overlay={ChatPopover} >
                <Button variant="primary" size="lg" className="btn-icon btn-floating btn-rounded btn-popup-open" onClick={handleChatPopup} autoFocus >
                    <span className="icon">
                        <span className="feather-icon"><MessageCircle /></span>
                    </span>
                </Button>
            </OverlayTrigger>

            {/* Page Body */}
            <div className="hk-pg-body py-0">
            </div>
        </div>

    )
}

export default ChatPopup
