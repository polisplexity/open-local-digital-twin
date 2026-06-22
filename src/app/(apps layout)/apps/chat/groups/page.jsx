'use client';
import { useEffect, useState } from 'react';
import classNames from 'classnames';
import { useWindowWidth } from '@react-hook/window-size';
import Footer from './Footer';
import ChatHeader from '../ChatHeader';
import GroupChatBody from './GroupChatBody';
import GroupList from './GroupList';
import Info from './Info';
import InvitePeopleModal from '../InvitePeopleModal';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

const ChatGroups = () => {
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
        <div className="hk-pg-body py-0" >
            <div className={classNames("chatapp-wrap", { "chatapp-info-active": showInfo }, { "chatapp-slide": states.chatState.startChat })}>
                <div className="chatapp-content">
                    <GroupList />
                    <div className="chatapp-single-chat">
                        <ChatHeader infoState={showInfo} infoToggle={() => setShowInfo(!showInfo)} invitePeople={() => setInvitePeople(!invitePeople)} />
                        <GroupChatBody />
                        {/* <ChatFooter /> */}
                        <Footer />
                        <Info toggleInfo={() => setShowInfo(!showInfo)} invitePeople={() => setInvitePeople(!invitePeople)} />
                    </div>
                    {/* Invite People */}
                    <InvitePeopleModal show={invitePeople} onClose={() => setInvitePeople(!invitePeople)} />
                </div>
            </div>
        </div >

    )
}

export default ChatGroups;