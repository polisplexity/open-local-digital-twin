'use client'
import { useState } from 'react';
import classNames from 'classnames';
import InvoiceAppSidebar from '../InvoiceAppSidebar';
import Body from './Body';
import Header from './Header';
import SettingPannel from './SettingPannel';

const CreateInvoice = () => {
    const [showSidebar, setShowSidebar] = useState(true);
    const [openSettingPannel, setOpenSettingPannel] = useState(false);

    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("invoiceapp-wrap", { "invoiceapp-sidebar-toggle": !showSidebar }, { "invoiceapp-setting-active": openSettingPannel })}>
                <InvoiceAppSidebar />
                <div className="invoiceapp-content">
                    <div className="invoiceapp-detail-wrap">
                        <Header toggleSidebar={() => setShowSidebar(!showSidebar)} show={showSidebar} handleSettings={() => setOpenSettingPannel(!openSettingPannel)} />
                        <Body />
                        <SettingPannel onHide={() => setOpenSettingPannel(false)} />
                    </div>
                </div>
            </div>
        </div>

    )
}

export default CreateInvoice
