'use client';
import { useState } from 'react';
import classNames from 'classnames';
import ContactAppSidebar from '../ContactAppSidebar';
import ContactAppHeader from '../ContactAppHeader';
import ContactAppBody from './ContactAppBody';

const ContactList = () => {
    const [showSidebar, setShowSidebar] = useState(false);
    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("contactapp-wrap", { "contactapp-sidebar-toggle": showSidebar })} >
                <ContactAppSidebar />
                <div className="contactapp-content">
                    <div className="contactapp-detail-wrap">
                        <ContactAppHeader toggleSidebar={() => setShowSidebar(!showSidebar)} show={showSidebar} />
                        <ContactAppBody />
                    </div>
                </div>
            </div>
        </div>

    )
}

export default ContactList
