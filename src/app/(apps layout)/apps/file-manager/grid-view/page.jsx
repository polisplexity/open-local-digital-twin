'use client'
import { useState } from 'react';
import classNames from 'classnames';
import FileInfo from '../FileInfo';
import FmHeader from '../FmHeader';
import FmSidebar from '../FmSidebar';
import FmGrid from './fm-grid';

const GridView = () => {
    const [showInfo, setShowInfo] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("fmapp-wrap", { "fmapp-sidebar-toggle": !showSidebar }, { "fmapp-info-active": showInfo })}>
                <FmSidebar />
                <div className="fmapp-content">
                    <div className="fmapp-detail-wrap">
                        <FmHeader toggleSidebar={() => setShowSidebar(!showSidebar)} showSidebar={showSidebar} showInfo={showInfo} toggleInfo={() => setShowInfo(!showInfo)} />
                        <FmGrid fileInfo={() => setShowInfo(true)} />
                        <FileInfo onHide={() => setShowInfo(false)} />
                    </div>
                </div>
            </div>
        </div>

    )
}

export default GridView
