'use client';
/* eslint-disable no-useless-concat */
import { createRef, useEffect, useState } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import classNames from 'classnames';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from "@fullcalendar/interaction";
import moment from 'moment';
import { useWindowHeight } from '@react-hook/window-size';
import CalendarSidebar from './CalendarSidebar';
import { CalendarEvents } from './Events';
import EventsDrawer from './EventsDrawer';
import CreateNewEvent from './CreateNewEvent';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

//Icons
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ChevronDown, ChevronUp } from 'react-feather';

const Calendar = () => {

    let calendarRef = createRef()
    var curYear = moment().format('YYYY'),
        curMonth = moment().format('MM');
    const { states, dispatch } = useGlobalStateContext();
    const [showSidebar, setShowSidebar] = useState(true)
    const [showEventInfo, setShowEventInfo] = useState(false);
    const [createEvent, setCreateEvent] = useState(false);
    const [eventTitle, setEventTitle] = useState();
    const [targetEvent, setTargetEvent] = useState();
    const [date, setDate] = useState(curYear + '-' + curMonth + '-07');
    const [currentView, setCurrentView] = useState("month");

    useEffect(() => {
        const calApi = calendarRef.current.getApi();

        if (calApi) {
            setDate(moment(calApi.getDate()));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    //Function for date change
    const handleChange = (action) => {
        let calendarApi = calendarRef.current.getApi();
        if (calendarApi) {
            if (action === 'prev') {
                calendarApi.prev();
            }
            else if (action === 'next') {
                calendarApi.next();
            }
            else {
                calendarApi.today();
            }

            setDate(moment(calendarApi.getDate()));
        }
    }

    //Function for Calendar View Changes
    const handleView = (view) => {
        let calendarApi = calendarRef.current.getApi();
        if (calendarApi) {
            if (view === 'week') {
                calendarApi.changeView("timeGridWeek");
            }
            else if (view === 'day') {
                calendarApi.changeView("dayGridWeek");
            }
            else if (view === 'list') {
                calendarApi.changeView("listWeek");
            }
            else {
                calendarApi.changeView("dayGridMonth");
            }

            setDate(moment(calendarApi.getDate()));
            setCurrentView(view);
        }
    }

    const toggleSidebar = () => {
        setShowSidebar(!showSidebar)
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 500);
    }
    const Calender_height = useWindowHeight();

    return (
        <>
            <div className="hk-pg-body py-0">
                <div className={classNames("calendarapp-wrap", { "calendarapp-sidebar-toggle": !showSidebar })} >
                    <CalendarSidebar showSidebar={showSidebar} toggleSidebar={() => setShowSidebar(!showSidebar)} createNewEvent={() => setCreateEvent(!createEvent)} />
                    <div className="calendarapp-content">
                        <div id="calendar" className="w-100 d-flex flex-column">

                            <header className="cd-header">
                                <div className="d-flex flex-1 justify-content-start">
                                    <Button variant="outline-light me-3" onClick={() => handleChange("today")} >Today</Button>
                                    <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover" onClick={() => handleChange("prev")} >
                                        <span className="icon">
                                            <FontAwesomeIcon icon={faChevronLeft} size="sm" />
                                        </span>
                                    </Button>
                                    <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover" onClick={() => handleChange("next")} >
                                        <span className="icon">
                                            <FontAwesomeIcon icon={faChevronRight} size="sm" />
                                        </span>
                                    </Button>
                                </div>
                                <div className="d-flex flex-1 justify-content-center">
                                    <h4 className="mb-0">{moment(date).format('MMMM' + ' ' + 'YYYY')}</h4>
                                </div>
                                <div className="cd-options-wrap d-flex flex-1 justify-content-end">
                                    <ButtonGroup className="d-none d-md-flex">
                                        <Button variant="outline-light" onClick={() => handleView("month")} active={currentView === "month"} >month</Button>
                                        <Button variant="outline-light" onClick={() => handleView("week")} active={currentView === "week"}>week</Button>
                                        <Button variant="outline-light" onClick={() => handleView("day")} active={currentView === "day"}>day</Button>
                                        <Button variant="outline-light" onClick={() => handleView("list")} active={currentView === "list"}>list</Button>
                                    </ButtonGroup>
                                    <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover hk-navbar-togglable" onClick={() => dispatch({ type: "top_nav_toggle" })} >
                                        <span className="icon">
                                            <span className="feather-icon">
                                                {
                                                    states.layoutState.topNavCollapse ? <ChevronDown /> : <ChevronUp />
                                                }
                                            </span>
                                        </span>
                                    </Button>
                                </div>

                                <div className={classNames("hk-sidebar-togglable", { "active": !showSidebar })} onClick={toggleSidebar} />
                            </header>

                            <FullCalendar
                                ref={calendarRef}
                                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                                initialView="dayGridMonth"
                                initialDate={date}
                                headerToolbar={false}
                                themeSystem='bootstrap'
                                height={Calender_height - 130}
                                windowResizeDelay={500}
                                droppable={true}
                                editable={true}
                                events={CalendarEvents}
                                eventClick={function (info) {
                                    // console.log(info);
                                    setTargetEvent(info.event);
                                    setEventTitle(info.event._def.title);
                                    setShowEventInfo(true);
                                }
                                }
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Event Info */}
            <EventsDrawer show={showEventInfo} info={eventTitle} event={targetEvent} onClose={() => setShowEventInfo(!showEventInfo)} />

            {/* New Event */}
            <CreateNewEvent calendarRef={calendarRef} show={createEvent} hide={() => setCreateEvent(!createEvent)} />
        </>

    )
}


export default Calendar;