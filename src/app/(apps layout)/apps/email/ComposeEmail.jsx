import { useState } from 'react';
import classNames from 'classnames';
import { Button, Form } from 'react-bootstrap';
import { Edit, Maximize2, Minimize2, Minus, Paperclip, Trash2, X } from 'react-feather';
import HkChips from '@/components/@hk-chips/@hk-chips';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

//Images
import avatar11 from '@/assets/img/avatar11.jpg';
import avatar12 from '@/assets/img/avatar12.jpg';
import avatar13 from '@/assets/img/avatar13.jpg';

const ComposeEmail = () => {
    const { states, dispatch } = useGlobalStateContext();
    const [recipients, setRecipients] = useState([]);
    const [newRecipient, setNewRecipient] = useState("");

    const handleMinimize = () => {
        dispatch({ type: "maximize_modal", maximize: false })
        dispatch({ type: "minimize_modal", minimize: !states.emailState.minimize })

    }

    const handleClose = () => {
        dispatch({ type: "compose_email", composeEmail: !states.emailState.composeEmail })
        dispatch({ type: "maximize_modal", maximize: false })
        dispatch({ type: "minimize_modal", minimize: false })

    }

    const handleRecipients = () => {
        setRecipients(recipients => recipients.concat(newRecipient));
    }

    const onEnter = ({ key }) => {
        if (key === "Enter") {
            handleRecipients();
            setNewRecipient("");
        }
    }

    return (
        <div className={classNames("compose-email-popup", { "d-block": states.emailState.composeEmail }, { "minimize-email-popup": states.emailState.minimize }, { "maximize-email-popup": states.emailState.maximize })}  >
            <div className="d-flex flex-column h-100">
                <header className="d-flex align-items-center justify-content-between">
                    <h6 className="text-white mb-0">Compose Email</h6>
                    <div className="d-flex">
                        <Button size="sm" variant="dark" className="btn-icon btn-rounded d-lg-block d-none" onClick={handleMinimize} >
                            <span className="icon">
                                <span className="feather-icon">
                                    <Minus />
                                </span>
                            </span>
                        </Button>
                        <Button size="sm" variant="dark" className="btn-icon btn-rounded d-lg-block d-none" onClick={() => dispatch({ type: "maximize_modal", maximize: !states.emailState.maximize })}  >
                            <span className="icon">
                                <span className="feather-icon">
                                    {states.emailState.maximize ? <Minimize2 /> : <Maximize2 />}
                                </span>
                            </span>
                        </Button>
                        <Button size="sm" variant="dark" className="btn-icon btn-rounded d-lg-block">
                            <span className="icon" onClick={handleClose} >
                                <span className="feather-icon">
                                    <X />
                                </span>
                            </span>
                        </Button>
                    </div>
                </header>
                <Form>
                    <Form.Group className="mb-3">
                        <div className="d-flex flex-wrap">
                            <HkChips className="mb-2 me-2" variant="primary" src={avatar11} dismissable >
                                Morgan
                            </HkChips>

                            <HkChips className="mb-2 me-2" variant="primary" src={avatar12} dismissable >
                                Charlie
                            </HkChips>

                            <HkChips className="mb-2 me-2" variant="primary" src={avatar13} dismissable >
                                Winston
                            </HkChips>
                            {recipients.map((data, i) => (
                                <HkChips key={i} className="mb-2 me-2" variant="primary" dismissable >
                                    {data}
                                </HkChips>
                            ))}
                            <Form.Control type="text" className="border-0 p-0 shadow-none flex-1 mb-2 me-2" placeholder="Add recipients" value={newRecipient} onChange={e => setNewRecipient(e.target.value)} onKeyPress={onEnter} />
                        </div>
                    </Form.Group>
                    <Form.Group className="mb-3" >
                        <Form.Control placeholder="Subject" />
                    </Form.Group>
                    <Form.Group>
                        <Form.Control as="textarea" />
                    </Form.Group>
                </Form>
                <div className="compose-email-footer">
                    <div>
                        <Button variant="primary" className="me-2" type="submit">Send</Button>
                        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                            <HkTooltip id="flag" title="Add Flag" placement="top" >
                                <span className="icon">
                                    <span className="feather-icon">
                                        <Paperclip />
                                    </span>
                                </span>
                            </HkTooltip>
                        </Button>
                    </div>
                    <div>
                        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                            <HkTooltip id="draft" title="Save Draft" placement="top" >
                                <span className="icon">
                                    <span className="feather-icon">
                                        <Edit />
                                    </span>
                                </span>
                            </HkTooltip>
                        </Button>
                        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                            <HkTooltip id="delete" title="Delete" placement="top" >
                                <span className="icon">
                                    <span className="feather-icon">
                                        <Trash2 />
                                    </span>
                                </span>
                            </HkTooltip>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}


export default ComposeEmail;