import Split from 'react-split';
import GanttChart from './GanttChart';
import GanttTable from './GanttTable';


const gutterFn = (_index, direction) => {
    const gutter = document.createElement("div");
    gutter.className = `
    gutter
    gutter-${direction}
    flex
    items-center
    justify-center
    cursor-col-resize
  `;
    gutter.style.height = '100%'

    return gutter;
}

const TodoBody = () => {

    return (
        <div className="todo-body">
            <div className="nicescroll-bar">
                <Split
                    className="split-wrap"
                    gutter={gutterFn}
                    gutterSize={7}
                >
                    <GanttTable />
                    <GanttChart />
                </Split>
            </div>
        </div>
    )
}

export default TodoBody
