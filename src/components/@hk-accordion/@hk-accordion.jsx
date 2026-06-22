import React from 'react';
import { Accordion, useAccordionButton } from 'react-bootstrap';

const HkAccordion = ({ children, as, bsPrefix, className, activeKey, defaultActiveKey, onSelect, flush, alwaysOpen }) => {
    return (
        <Accordion
            as={as}
            bsPrefix={bsPrefix}
            activeKey={activeKey}
            defaultActiveKey={defaultActiveKey}
            onSelect={onSelect}
            flush={flush}
            alwaysOpen={alwaysOpen}
            className={className}
        >
            {children}
        </Accordion>
    )
}

const Toggle = ({ children, eventKey, className }) => {
    const decoratedOnClick = useAccordionButton(eventKey, () =>
        console.log(eventKey),
    );
    return (
        <div
            role="button"
            onClick={decoratedOnClick}
            className={className}
        >
            {children}
        </div>
    )
}

HkAccordion.Toggle = Toggle;

const Collapse = ({ children, as, eventKey }) => <Accordion.Collapse as={as} eventKey={eventKey} >{children}</Accordion.Collapse>

HkAccordion.Collapse = Collapse;

export default HkAccordion
