import SimpleBar from 'simplebar-react';
import InvoiceList from './InvoiceList';

const InvoiceListBody = () => {
    return (
        <div className="invoice-body">
            <SimpleBar className="nicescroll-bar">
                <div className="invoice-list-view">
                    <InvoiceList />
                </div>
            </SimpleBar>
        </div>
    )
}

export default InvoiceListBody
