import classNames from 'classnames';
import Image from 'next/image';
import React, { useState } from 'react';
import { Button, FormControl } from 'react-bootstrap';

const TestNubraChips = ({ children, variant, dismissable, pill, ticked, icon, userChips, disabled }) => {
    const [show, setShow] = useState(true);

    return (
        <div className={classNames(`chip chip-${variant}`, { 'chip-dismissable': dismissable }, { pill: 'chip-pill' }, { 'chip-ticked': ticked }, { 'chip-pill': pill }, { 'chip-wth-icon': icon }, { 'd-none': !show }, { "user-chip": userChips }, { 'chip-disabled': disabled })}>
            {!dismissable && <FormControl type="checkbox" />}
            <span>
                {icon}
                {children}
                {dismissable && <Button bsPrefix="btn-close" onClick={() => setShow(!show)} />}
            </span>
        </div >
    )
};
const Text = (props) => <span className="chip-text">{props.children}</span>;
TestNubraChips.Text = Text;

const Img = (props) => <span className="avatar"><Image src={props.src} alt={props.alt} className="avatar-img" /></span>;
TestNubraChips.Img = Img;


export default TestNubraChips;
