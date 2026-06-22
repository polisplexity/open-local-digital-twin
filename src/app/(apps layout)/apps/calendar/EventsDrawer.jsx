import { useState } from 'react';
import SimpleBar from 'simplebar-react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import classNames from 'classnames';
import moment from 'moment';
import Swal from 'sweetalert2';
import DateRangePicker from 'react-bootstrap-daterangepicker';
import * as Icons from 'react-feather';
import '@sweetalert2/theme-bootstrap-4/bootstrap-4.css';
import 'animate.css';
// Own Custom Components
import HkBadge from '@/components/@hk-badge/@hk-badge';
import HkChips from '@/components/@hk-chips/@hk-chips';

//Images
import avatar11 from '@/assets/img/avatar11.jpg';
import avatar12 from '@/assets/img/avatar12.jpg';
import avatar13 from '@/assets/img/avatar13.jpg';
import { useTheme } from '@/layout/theme-provider/theme-provider';

const EventsDrawer = ({ show, onClose, info, event }) => {
    const [editable, setEditable] = useState(false);
    const [eventColor, setEventColor] = useState("#009B84");
    const { theme } = useTheme();

    const hideCalender = (ev, picker) => {
        picker.container.find(".calendar-table").hide();
    };

    const handleClose = () => {
        if (editable) {
            setEditable(!editable);
        }
        else {
            onClose();
        }
    }

    /*Event Delete*/
    const DeletEvent = () => {
        onClose();
        Swal.fire({
            html:
                '<div class="mb-3"><i class="ri-delete-bin-6-line fs-5 text-danger"></i></div><h5 class="text-danger">Delete Note ?</h5><p>Deleting a note will permanently remove from your library.</p>',
            customClass: {
                confirmButton: 'btn btn-outline-secondary text-danger',
                cancelButton: 'btn btn-outline-secondary text-grey',
                container: 'swal2-has-bg'
            },
            showCancelButton: true,
            buttonsStyling: false,
            confirmButtonText: 'Yes, Delete Note',
            cancelButtonText: 'No, Keep Note',
            reverseButtons: true,
            showDenyButton: false,
            theme: theme === 'dark' ? 'dark' : 'bootstrap-5',
            showClass: {
                popup: 'animate__animated animate__fadeInDown'
            },
            hideClass: {
                popup: 'animate__animated animate__fadeOutUp'
            }
        }).then((result) => {
            if (result.value) {
                event.remove();
                Swal.fire({
                    html:
                        '<div class="d-flex align-items-center"><i class="ri-delete-bin-5-fill me-2 fs-3 text-danger"></i><h5 class="text-danger mb-0">Event has been deleted!</h5></div>',
                    timer: 2000,
                    customClass: {
                        content: 'p-0 text-left',
                        actions: 'justify-content-start',
                    },
                    theme: theme === 'dark' ? 'dark' : 'bootstrap-5',
                    showConfirmButton: false,
                    buttonsStyling: false,
                    showClass: {
                        popup: 'animate__animated animate__fadeInDown'
                    },
                    hideClass: {
                        popup: 'animate__animated animate__fadeOutUp'
                    }
                })
            }
        })
    }

    return (
        <div className={classNames("hk-drawer calendar-drawer drawer-right", { "drawer-toggle": show })} style={{ border: "none", boxShadow:"0 8px 32px rgba(0, 0, 0, 0.1)" }} >
            <div className={classNames({ "d-none": editable })}>
                <div className="drawer-header">
                    <div className="drawer-header-action">
                        <Button size="sm" variant="flush-secondary" id="edit_event" className="btn-icon btn-rounded flush-soft-hover" onClick={() => setEditable(!editable)} >
                            <span className="icon">
                                <span className="feather-icon">
                                    <Icons.Edit2 />
                                </span>
                            </span>
                        </Button>
                        <Button size="sm" variant="flush-secondary" id="del_event" className="btn-icon btn-rounded flush-soft-hover" onClick={DeletEvent} >
                            <span className="icon">
                                <span className="feather-icon">
                                    <Icons.Trash2 />
                                </span>
                            </span>
                        </Button>
                        <Button size="sm" variant="flush-secondary" className="btn-icon btn-rounded flush-soft-hover me-2">
                            <span className="icon">
                                <span className="feather-icon">
                                    <Icons.ExternalLink />
                                </span>
                            </span>
                        </Button>
                        <Button bsPrefix="btn-close" className="drawer-close" onClick={onClose} >
                            <span aria-hidden="true">×</span>
                        </Button>
                    </div>
                </div>
                <div className="drawer-body">
                    <SimpleBar className="nicescroll-bar">
                        <div className="drawer-content-wrap">
                            <div className="event-head mb-4">
                                <HkBadge bg="violet" indicator className="badge-indicator-xl flex-shrink-0 me-2" />
                                <div>
                                    <div className="event-name">{info}</div>
                                    <span>Event</span>
                                </div>
                            </div>
                            <ul className="event-detail">
                                <li>
                                    <span className="ev-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.Calendar />
                                        </span>
                                    </span>
                                    Aug 18,2020 - Aug 19, 2020
                                </li>
                                <li>
                                    <span className="ev-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.Clock />
                                        </span>
                                    </span>
                                    8:40 AM - 5:40 PM
                                </li>
                                <li>
                                    <span className="ev-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.MapPin />
                                        </span>
                                    </span>
                                    Oslo, Canada
                                </li>
                                <li>
                                    <span className="ev-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.CheckSquare />
                                        </span>
                                    </span>
                                    Meetings
                                </li>
                                <li>
                                    <span className="ev-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.Eye />
                                        </span>
                                    </span>
                                    Default Visibility
                                </li>
                                <li>
                                    <span className="ev-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.UserPlus />
                                        </span>
                                    </span>
                                    <div className="d-flex flex-wrap">
                                        <HkChips variant="primary" src={avatar11} className="mb-2 me-2" >Morgan</HkChips>
                                        <HkChips variant="primary" src={avatar12} className="mb-2 me-2" >Charlie</HkChips>
                                        <HkChips variant="primary" src={avatar13} className="mb-2 me-2" >Winston</HkChips>
                                    </div>
                                </li>
                                <li>
                                    <span className="ev-icon-wrap">
                                        <span className="feather-icon">
                                            <Icons.Menu />
                                        </span>
                                    </span>
                                    Annual meeting with global branch teams &amp; bosses about growth planning and fiscal year reports
                                </li>
                            </ul>
                        </div>
                    </SimpleBar>
                </div>
            </div>
            <div className={classNames({ "d-none": !editable })}>
                <div className="drawer-header">
                    <div className="drawer-header-action">
                        <Button size="sm" variant="flush-secondary" className="btn-icon btn-rounded flush-soft-hover me-2">
                            <span className="icon">
                                <span className="feather-icon">
                                    <Icons.ExternalLink />
                                </span>
                            </span>
                        </Button>
                        <Button bsPrefix="btn-close" className="drawer-close" onClick={handleClose} >
                            <span aria-hidden="true">×</span>
                        </Button>
                    </div>
                </div>
                <div className="drawer-body">
                    <SimpleBar className="nicescroll-bar">
                        <div className="drawer-content-wrap">
                            <div className="event-head mb-4">
                                <HkBadge bg="violet" indicator className="badge-indicator-xl flex-shrink-0 me-2" />
                                <div>
                                    <div id="editableContent" contentEditable="true" suppressContentEditableWarning={true} className="event-name">{info}</div>
                                    <Form.Group className="mt-2 mb-0">
                                        <Form.Check
                                            inline
                                            label="Event"
                                            name="group1"
                                            type="radio"
                                            id="radio-1"
                                            defaultChecked
                                        />
                                        <Form.Check
                                            inline
                                            label="Reminder"
                                            name="group1"
                                            type="radio"
                                            id="radio-2"
                                        />
                                    </Form.Group>
                                </div>
                            </div>
                            <Form>
                                <Form.Group className="mb-3" >
                                    <InputGroup>
                                        <span className="input-affix-wrapper">
                                            <span className="input-prefix">
                                                <span className="feather-icon">
                                                    <Icons.Calendar />
                                                </span>
                                            </span>
                                            <DateRangePicker
                                                initialSettings={{
                                                    timePicker: true,
                                                    startDate: moment().startOf('hour').toDate(),
                                                    endDate: moment().startOf('hour').add(32, 'hour').toDate(),
                                                    locale: {
                                                        format: 'M/DD hh:mm A',
                                                    },
                                                }}
                                            >
                                                <Form.Control type="text" name="datetimes" />
                                            </DateRangePicker>
                                        </span>
                                    </InputGroup>
                                </Form.Group>
                                <Form.Group className="mb-3" >
                                    <InputGroup>
                                        <span className="input-affix-wrapper">
                                            <span className="input-prefix">
                                                <span className="feather-icon">
                                                    <Icons.Clock />
                                                </span>
                                            </span>
                                            <DateRangePicker
                                                initialSettings={{
                                                    timePicker: true,
                                                    timePicker24Hour: true,
                                                    timePickerIncrement: 1,
                                                    timePickerSeconds: true,
                                                    locale: {
                                                        format: 'HH:mm:ss'
                                                    }
                                                }}
                                                onShow={hideCalender}
                                            >
                                                <Form.Control className="input-timepicker" type="text" name="time" />
                                            </DateRangePicker>
                                        </span>
                                    </InputGroup>
                                </Form.Group>
                                <Form.Group className="mb-3" >
                                    <InputGroup>
                                        <span className="input-affix-wrapper">
                                            <span className="input-prefix">
                                                <span className="feather-icon">
                                                    <Icons.MapPin />
                                                </span>
                                            </span>
                                            <Form.Control type="text" className="form-wth-icon" defaultValue="Oslo, Canada" />
                                        </span>
                                    </InputGroup>
                                </Form.Group>
                                <Form.Group className="mb-3" >
                                    <InputGroup>
                                        <span className="input-affix-wrapper">
                                            <span className="input-prefix">
                                                <span className="feather-icon">
                                                    <Icons.CheckSquare />
                                                </span>
                                            </span>
                                            <Form.Select>
                                                <option value={1}>All Time</option>
                                                <option value={2}>Half Day</option>
                                                <option value={3}>9 to 5</option>
                                            </Form.Select>
                                        </span>
                                    </InputGroup>
                                </Form.Group>
                                <Form.Group className="mb-3" >
                                    <InputGroup>
                                        <span className="input-affix-wrapper">
                                            <span className="input-prefix">
                                                <span className="feather-icon">
                                                    <Icons.Eye />
                                                </span>
                                            </span>
                                            <Form.Select>
                                                <option value={0}>Default Visibility</option>
                                                <option value={1}>Private</option>
                                                <option value={2}>Public</option>
                                            </Form.Select>
                                        </span>
                                    </InputGroup>
                                </Form.Group>
                                <Form.Group className="mb-3" >
                                    <InputGroup className="color-picker">
                                        <InputGroup.Text className="colorpicker-input-addon">
                                            <Form.Control
                                                type="color"
                                                id="exampleColorInput"
                                                title="Choose your color"
                                                value={eventColor}
                                                onChange={e => setEventColor(e.target.value)}
                                            />
                                        </InputGroup.Text>
                                        <Form.Control type="text" value={eventColor} onChange={() => setEventColor(eventColor)} />
                                    </InputGroup>
                                </Form.Group>
                                <Form.Group className="mb-3" >
                                    <div className="d-flex flex-wrap">
                                        <HkChips variant="primary" src={avatar11} dismissable className="mb-2 me-2" >Morgan</HkChips>
                                        <HkChips variant="primary" src={avatar12} dismissable className="mb-2 me-2" >Charlie</HkChips>
                                        <HkChips variant="primary" src={avatar13} dismissable className="mb-2 me-2" >Winston</HkChips>
                                        <Form.Control type="text" className="border-0 p-0 shadow-none flex-1 mb-2 me-2" />
                                    </div>
                                </Form.Group>
                                <Form.Group className="mb-3" >
                                    <Form.Control as="textarea" rows={4} defaultValue={"Annual meeting with global branch teams & bosses about growth planning and fiscal year reports"} />
                                </Form.Group>
                            </Form>
                        </div>
                    </SimpleBar>
                </div>
                <div className="drawer-footer d-flex justify-content-end">
                    <Button variant="secondary" className="drawer-edit-close me-2" onClick={() => setEditable(!editable)}>discard</Button>
                    <Button variant="primary" className="drawer-edit-close" onClick={() => setEditable(!editable)} >save</Button>
                </div>
            </div>
        </div >

    )
}

export default EventsDrawer
