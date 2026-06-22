'use client'
import { useState } from 'react';
import classNames from 'classnames';
import InvoiceAppHeader from './InvoiceAppHeader';
import InvoiceAppSidebar from '../InvoiceAppSidebar';
import InvoiceListBody from './InvoiceListBody';

const InvoiceList = () => {
    const [showSidebar, setShowSidebar] = useState(true);

    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("invoiceapp-wrap", { "invoiceapp-sidebar-toggle": !showSidebar })} >
                <InvoiceAppSidebar />
                <div className="invoiceapp-content">
                    <div className="invoiceapp-detail-wrap">
                        <InvoiceAppHeader toggleSidebar={() => setShowSidebar(!showSidebar)} show={showSidebar} />
                        <InvoiceListBody />
                    </div>
                </div>
            </div>
        </div>

    )
}

export default InvoiceList
