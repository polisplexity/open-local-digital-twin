import classNames from 'classnames';
import Image from 'next/image';
import React, { useState } from 'react';
import { Button, FormControl } from 'react-bootstrap';

const HkChips = ({ children, variant, dismissable, pill, ticked, icon, src, lg, disabled, className }) => {
    const [show, setShow] = useState(true);

    return (
        <div className={classNames(className, `chip chip-${variant}`, { 'chip-dismissable': dismissable }, { pill: 'chip-pill' }, { 'chip-ticked': ticked }, { 'chip-pill': pill }, { 'chip-wth-icon': icon }, { 'd-none': !show }, { "user-chip": src }, { "chip-lg": lg }, { 'chip-disabled': disabled })}>
            {!dismissable && !src && <FormControl type="checkbox" />}
            <span>
                {icon}
                {src && <span className="avatar">
                    <Image src={src} alt="user" className="avatar-img" />
                </span>}
                <span className="chip-text">
                    {children}
                </span>
                {dismissable && <Button bsPrefix="btn-close" onClick={() => setShow(!show)} />}
            </span>
        </div >
    )
};

export default HkChips;
