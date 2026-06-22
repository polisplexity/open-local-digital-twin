// import Gantt from 'frappe-gantt';
import Gantt from './gantt-master/src/index';
import React, { useEffect, useRef } from 'react'

const HkGantt = ({ tasks, onClick, onViewChange, onDateChange, onProgressChange, viewMode, customPopupHtml }) => {

    const chartRef = useRef(null);

    const popupHtml = task => {
        // const end_date = task._end.format('MMM D');
        // this.setState({ editTask: "open" });
        return `
        <div class="popover fade show bs-popover-right gantt-task-details" role="tooltip">
          <div class="arrow">
        </div>
        <div class="popover-body">
        <h5>${task.name}</h5>
        <p class="mb-2">Expected to finish by ${task.end}</p>
        <div class="progress mb-2" style="height: 10px;"><div class="progress-bar" role="progressbar" style="width: ${task.progress}%;" aria-valuenow="${task.progress}" aria-valuemin="0" aria-valuemax="100">${task.progress}%</div></div></div></div>
        `;
    };


    useEffect(() => {
        const gantt = new Gantt(chartRef.current, tasks, {
            on_click: onClick,
            on_view_change: onViewChange,
            on_date_change: (task, start, end) => {
                onDateChange(task, start, end)
            },
            on_progress_change: (task, progress) => {
                onProgressChange(task, progress)
            },
            view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'],
            view_mode: { viewMode },
            custom_popup_html: customPopupHtml ? customPopupHtml : popupHtml,
        })

        gantt.change_view_mode(viewMode);
    }, [tasks, onClick, onViewChange, onDateChange, onProgressChange, viewMode, customPopupHtml])

    return <svg
        ref={chartRef}
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
    />
}

export default HkGantt
