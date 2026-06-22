'use client';
import { useState } from 'react';
import classNames from 'classnames';
import EmailBody from './EmailBody';
import EmailHeader from './EmailHeader';
import EmailSidebar from './EmailSidebar';
import InboxList from './Inbox';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';


const Email = () => {
    const { states } = useGlobalStateContext();
    const [showSidebar, setshowSidebar] = useState(true);
    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("emailapp-wrap", { "emailapp-sidebar-toggle": !showSidebar }, { "emailapp-slide": states.emailState.openEmail })}>
                <EmailSidebar />
                <div className="emailapp-content">
                    <InboxList show={showSidebar} toggleSidebar={() => setshowSidebar(!showSidebar)} />
                    <div className="emailapp-single-email">
                        <EmailHeader />
                        <EmailBody />
                    </div>
                </div>
            </div>
        </div>

    )
}


export default Email;