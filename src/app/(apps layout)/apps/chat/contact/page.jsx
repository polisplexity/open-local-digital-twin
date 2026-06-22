'use client';
import { useEffect, useState } from 'react';
import { useWindowWidth } from '@react-hook/window-size';
import classNames from 'classnames';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';
import ChatHeader from '../ChatHeader';
import InvitePeopleModal from '../InvitePeopleModal';
import ChatBody from './ChatBody';
import ChatInfo from './ChatInfo';
import ContactList from './ContactList';
import Footer from './Footer';

//Redux
// import { connect } from 'react-redux';

const ChatContacts = () => {
    const { states } = useGlobalStateContext();
    const [showInfo, setShowInfo] = useState(true);
    const [invitePeople, setInvitePeople] = useState(false);

    const windowWidth = useWindowWidth();
    useEffect(() => {
        if (windowWidth <= 1199) {
            setShowInfo(false);
        }
        else {
            setShowInfo(true)
        }
    }, [windowWidth])

    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("chatapp-wrap", { "chatapp-info-active": showInfo }, { "chatapp-slide": states.chatState.startChat })}>
                <div className="chatapp-content">
                    <ContactList />
                    <div className="chatapp-single-chat">
                        <ChatHeader infoState={showInfo} infoToggle={() => setShowInfo(!showInfo)} invitePeople={() => setInvitePeople(!invitePeople)} />
                        <ChatBody />
                        {/* <ChatFooter /> */}
                        <Footer />
                        <ChatInfo infoToggle={() => setShowInfo(!showInfo)} />
                    </div>
                    {/* Invite People */}
                    <InvitePeopleModal show={invitePeople} onClose={() => setInvitePeople(!invitePeople)} />
                </div>
            </div>
        </div>

    )
}


export default ChatContacts;
