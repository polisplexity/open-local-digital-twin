"use client"
import { useState } from 'react';
import classNames from 'classnames';
import ContactAppHeader from '../ContactAppHeader';
import ContactAppSidebar from '../ContactAppSidebar';
import ContactCardsBody from './ContactCardsBody';

const ContactCards = () => {
    const [showSidebar, setShowSidebar] = useState(false);
    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("contactapp-wrap", { "contactapp-sidebar-toggle": showSidebar })}>
                <ContactAppSidebar />
                <div className="contactapp-content">
                    <div className="contactapp-detail-wrap">
                        <ContactAppHeader toggleSidebar={() => setShowSidebar(!showSidebar)} show={showSidebar} />
                        <ContactCardsBody />
                    </div>
                </div>
            </div>
        </div>

    )
}

export default ContactCards
