'use client'
import React, { useState } from 'react'
import { Button, Collapse } from 'react-bootstrap';

const HkSimpleCollapse = ({ children, title, collapseIcon, targetId, bsPrefix, as, headerClass, bodyClass, wrapperClass, btnClasses, collapsed, ...rest }) => {

    const [show, setShow] = useState(!collapsed);
    return (
        <div className={wrapperClass}>
            <Button
                bsPrefix={bsPrefix}
                as={as}
                aria-controls={targetId}
                aria-expanded={show}
                onClick={() => setShow(!show)}
                className={headerClass}
                {...rest}
            >
                {title}
            </Button>
            <Collapse in={show} >
                {children}
            </Collapse>
        </div>
    )
}

export default HkSimpleCollapse
