import React from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

const HkTooltip = ({ children, id, placement, title, show, popper, bsPrefix, className, as }) => {
    return (
        <OverlayTrigger
            key={id}
            placement={placement}
            overlay={
                <Tooltip id={id} as={as} className={className} show={show} popper={popper} bsPrefix={bsPrefix} >
                    {
                        (title)
                            ?
                            <span>{title}</span>
                            :
                            <span>Tooltip on {placement}</span>
                    }

                </Tooltip>
            }
        >
            {children}
        </OverlayTrigger>
    )
}

export default HkTooltip;
