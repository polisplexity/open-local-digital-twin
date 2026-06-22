'use client'
import { useState } from 'react';
import FmHeader from '../FmHeader';
import FmList from './FmList';
import FmSidebar from '../FmSidebar';
import FileInfo from '../FileInfo';
import classNames from 'classnames';

const ListView = () => {
    const [showInfo, setShowInfo] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);

    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("fmapp-wrap", { "fmapp-sidebar-toggle": !showSidebar }, { "fmapp-info-active": showInfo })}>
                <FmSidebar />
                <div className="fmapp-content">
                    <div className="fmapp-detail-wrap">
                        <FmHeader toggleSidebar={() => setShowSidebar(!showSidebar)} showSidebar={showSidebar} showInfo={showInfo} toggleInfo={() => setShowInfo(!showInfo)} />
                        <FmList toggleInfo={() => setShowInfo(true)} />
                        <FileInfo onHide={() => setShowInfo(false)} />
                    </div>
                </div>
            </div>
        </div>

    )
}

export default ListView
