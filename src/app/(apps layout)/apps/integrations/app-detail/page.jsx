'use client'
import { useState } from 'react';
import classNames from 'classnames';
import AppsSidebar from '../AppsSidebar';
import Header from './Header';
import Body from './Body';

const IntegrationsDetail = () => {
    const [showSidebar, setShowSidebar] = useState(true);

    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("integrationsapp-wrap", { "integrationsapp-sidebar-toggle": !showSidebar })}>
                <AppsSidebar />
                <div className="integrationsapp-content">
                    <div className="integrationsapp-detail-wrap">
                        <Header toggleSidebar={() => setShowSidebar(!showSidebar)} show={showSidebar} />
                        <Body />
                    </div>                    
                </div>
            </div>
        </div>

    )
}

export default IntegrationsDetail
