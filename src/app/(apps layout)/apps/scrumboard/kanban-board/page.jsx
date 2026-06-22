'use client';
import { useState } from 'react';
import classNames from 'classnames';
import Sidebar from '../Sidebar'
import BoardHeader from './BoardHeader';
import EditTaskList from './EditTaskList';
import TaskboardInfo from './TaskboardInfo';
import TaskDetails from './TaskDetails';
import Board from './Board';

const KanbanBoard = () => {
    const [showSidebar, setShowSidebar] = useState(true);
    const [showInfo, setShowInfo] = useState(false);
    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("taskboardapp-wrap", { "taskboardapp-sidebar-toggle": !showSidebar }, { "taskboardapp-info-active": showInfo })}>
                <Sidebar />
                <div className="taskboardapp-content">
                    <div className="taskboardapp-detail-wrap">
                        <BoardHeader showSidebar={showSidebar} toggleSidebar={() => setShowSidebar(!showSidebar)} showInfo={showInfo} toggleInfo={() => setShowInfo(!showInfo)} />
                        {/* <Body /> */}
                        {/* <MainBoard /> */}
                        <Board />
                        <TaskboardInfo onHide={() => setShowInfo(false)} />
                    </div>
                    {/* Task Details */}
                    <TaskDetails />
                    {/* Edit Task List */}
                    <EditTaskList />
                </div>
            </div>
        </div>

    )
}

export default KanbanBoard
