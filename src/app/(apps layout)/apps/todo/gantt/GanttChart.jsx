import { useEffect } from 'react';
import SimpleBar from 'simplebar-react';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';
import HkGantt from '@/components/@hk-gantt/@hk-gantt';

const GanttChart = () => {

    const { states } = useGlobalStateContext();

    // 👇️ scroll to viewPort every time messages change
    useEffect(() => {
        const element = document.querySelector('#split_2 .simplebar-content-wrapper');
        element.scrollTo({ left: 500, behavior: "smooth" });
    });

    // const currentDate = new Date();

    const tasks = [
        {
            id: "task_1",
            name: "Draft the new contract document for sales team",
            start: "2019-07-16",
            end: "2019-07-20",
            progress: 55,
        }, {
            id: "task_2",
            name: "Find out the old contract documents",
            start: "2019-07-19",
            end: "2019-07-21",
            progress: 85,
            dependencies: "task_1"
        }, {
            id: "task_3",
            name: "Organize meeting with sales associates to understand need in detail",
            start: "2019-07-21",
            end: "2019-07-22",
            progress: 80,
            dependencies: "task_2"
        }, {
            id: "task_4",
            name: "iOS App home page",
            start: "2019-07-15",
            end: "2019-07-17",
            progress: 80
        }, {
            id: "task_5",
            name: "Write a release note",
            start: "2019-07-18",
            end: "2019-07-22",
            progress: 65,
            dependencies: "task_4"
        }, {
            id: "task_6",
            name: "Setup new sales project",
            start: "2019-07-20",
            end: "2019-07-31",
            progress: 15
        }, {
            id: "task_7",
            name: "Invite user to a project",
            start: "2019-07-25",
            end: "2019-07-26",
            progress: 99,
            dependencies: "task_6"
        }, {
            id: "task_8",
            name: "Coordinate with business development",
            start: "2019-07-28",
            end: "2019-07-30",
            progress: 35,
            dependencies: "task_7"
        }, {
            id: "task_9",
            name: "Kanban board design",
            start: "2019-08-01",
            end: "2019-08-03",
            progress: 25,
            dependencies: "task_8"
        }, {
            id: "task_10",
            name: "Enable analytics tracking",
            start: "2019-08-05",
            end: "2019-08-07",
            progress: 60,
            dependencies: "task_9"
        }
    ];


    return (
        <SimpleBar autoHide={false} style={{ maxHeight: "100vh" }} className="split" id="split_2" >
            <div className="gantt-wrap">
                <span className="gantt-container" >
                    <span className="gantt">
                        <HkGantt
                            tasks={tasks}
                            viewMode={states.todoState.vm}
                            onProgressChange={(task, progress) => console.log(task, progress)}
                            onDateChange={(task, start, end) => console.log(task, start, end)}
                        />
                    </span>
                </span>
            </div>
        </SimpleBar>
    )
}


export default GanttChart;