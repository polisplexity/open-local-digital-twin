'use client';
import { useState } from 'react';
import classNames from 'classnames';
import Sidebar from '../Sidebar';
import TaskBoard from './TaskBoard';

const ProjectsBoard = () => {
    const [showSidebar, setShowSidebar] = useState(true)
    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("taskboardapp-wrap", { "taskboardapp-sidebar-toggle": !showSidebar })}>
                <Sidebar />
                <TaskBoard showSidebar={showSidebar} toggleSidebar={() => setShowSidebar(!showSidebar)} />
            </div>
        </div>

    )
}

export default ProjectsBoard
