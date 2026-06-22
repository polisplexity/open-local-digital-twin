import HkDataTable from '@/components/@hk-data-table'
import { columns, data } from '@/data/todo/gantt-table-data';
import SimpleBar from 'simplebar-react';

const GanttTable = () => {

    return (
        <SimpleBar autoHide={false} style={{ maxHeight: "100vh" }} className="split">
            <HkDataTable
                column={columns}
                rowData={data}
                rowSelection={true}
                markStarred={true}
                classes="table-wrap gt-todo-table nowrap"
            />
        </SimpleBar>
    )
}

export default GanttTable
