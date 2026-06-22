'use client';
import React, { useState } from 'react';
import { Button, Card, Collapse } from 'react-bootstrap';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { ChevronDown, ChevronUp } from 'react-feather';

const HkCollapse = ({ children, title, collapseIcon, targetId, bsPrefix, as, headerClass, bodyClass, wrapperClass, btnClasses, collapsed, ...rest }) => {

    const [open, setOpen] = useState(!collapsed);
    return (
        <Card className={wrapperClass}>
            <Card.Header className={headerClass} >
                <Button
                    bsPrefix={bsPrefix}
                    as={as}
                    aria-controls={targetId}
                    aria-expanded={open}
                    onClick={() => setOpen(!open)}
                    className={classNames({ 'collapsed': !open }, btnClasses)}
                    {...rest}
                >
                    {title}
                </Button>
                {collapseIcon && <div className="card-action-wrap">
                    <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover" onClick={() => setOpen(!open)} >
                        <span className="icon">
                            <span className="feather-icon">
                                {open ? <ChevronDown /> : <ChevronUp />}
                            </span>
                        </span>
                    </Button>
                </div>}
            </Card.Header>
            <Collapse in={open}>
                <div id={targetId}>
                    <Card.Body className={bodyClass}>
                        {children}
                    </Card.Body>
                </div>
            </Collapse>
        </Card>
    )
}

HkCollapse.propTypes = {
    targetId: PropTypes.string.isRequired,
    collapsed: PropTypes.bool.isRequired,
}
export default HkCollapse
