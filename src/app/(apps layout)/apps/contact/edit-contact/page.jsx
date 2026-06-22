'use client'
import { useState } from 'react';
import classNames from 'classnames';
import ContactAppSidebar from '../ContactAppSidebar';
import EditContactBody from './EditContactBody';
import EditContactHeader from './EditContactHeader';

const EditContact = () => {
    const [showSidebar, setShowSidebar] = useState(false);

    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("contactapp-wrap", { "contactapp-sidebar-toggle": showSidebar })}>
                <ContactAppSidebar />
                <div className="contactapp-content">
                    <div className="contactapp-detail-wrap">
                        <EditContactHeader toggleSidebar={() => setShowSidebar(!showSidebar)} show={showSidebar} />
                        <EditContactBody />
                    </div>
                </div>
            </div>
        </div>

    )
}

export default EditContact
