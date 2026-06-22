'use client'
import { useState } from 'react';
import classNames from 'classnames';
import InvoiceAppSidebar from '../InvoiceAppSidebar';
import Body from './Body';
import Header from './Header';

const PreviewInvoice = () => {
    const [showSidebar, setShowSidebar] = useState(true);

    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("invoiceapp-wrap", { "invoiceapp-sidebar-toggle": !showSidebar })}>
                <InvoiceAppSidebar />
                <div className="invoiceapp-content">
                    <div className="invoiceapp-detail-wrap">
                        <Header toggleSidebar={() => setShowSidebar(!showSidebar)} show={showSidebar} />
                        <Body />
                    </div>
                </div>
            </div>
        </div>

    )
}

export default PreviewInvoice;