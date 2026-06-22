'use client'
import { useState } from 'react';
import classNames from 'classnames';
import AppHeader from './AppHeader';
import TodoAppSidebar from './TodoAppSidebar';
import TodoBody from './TodoBody';

const Gantt = () => {
    const [showSidebar, setShowSidebar] = useState(false);

    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("todoapp-wrap ganttapp-wrap full-screenapp", { "todoapp-sidebar-toggle": showSidebar })} >
                <TodoAppSidebar />
                <div className="todoapp-content">
                    <div className="todoapp-detail-wrap">
                        <AppHeader toggleSidebar={() => setShowSidebar(!showSidebar)} showSidebar={showSidebar} />
                        <TodoBody />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Gantt
