'use client'
import { useEffect, useState } from 'react';
import { useWindowWidth } from '@react-hook/window-size';
import classNames from 'classnames';
import TaskInfo from './TaskInfo';
import TodoHeader from './TodoHeader';
import TodoSidebar from './TodoSidebar';
import Body from './Body';

const TaskList = () => {
    const [showAppInfo, setShowAppInfo] = useState(true);
    const [showSidebar, setShowSidebar] = useState(false);
    const vpWidth = useWindowWidth();

    useEffect(() => {
        if (vpWidth < 1199) {
            setShowAppInfo(false);
        }
    }, [vpWidth])

    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("todoapp-wrap", { "todoapp-info-active": showAppInfo }, { "todoapp-sidebar-toggle": showSidebar })} >
                <TodoSidebar />
                <div className="todoapp-content">
                    <div className="todoapp-detail-wrap">
                        <TodoHeader toggleSidebar={() => setShowSidebar(!showSidebar)} showSidebar={showSidebar} />
                        <Body showInfo={() => setShowAppInfo(true)} />
                        <TaskInfo close={() => setShowAppInfo(!showAppInfo)} />
                    </div>
                </div>
            </div>
        </div>

    )
}

export default TaskList
