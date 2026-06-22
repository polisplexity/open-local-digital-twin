import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types';
import { Alert, Button } from 'react-bootstrap'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClose } from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames';

const HkAlert = ({
    children,
    show = true,
    variant = "primary",
    className,
    dismissible = false,
    inverse = false,
    bsPrefix,
    closeLabel,
    closeVariant,
    onClose,
    transition,
    rounded,
}) => {

    const [display, setDisplay] = useState(show);

    useEffect(() => {
        setDisplay(show)
    }, [show])

    return (
        <>
            <Alert
                variant={!inverse && variant}
                bsPrefix={bsPrefix}
                className={classNames(className, (inverse ? `alert-inv alert-inv-${variant}` : ""), { "rounded-22": rounded })}
                dismissible={dismissible}
                closeLabel={closeLabel}
                closeVariant={closeVariant}
                onClose={onClose}
                show={display}
                transition={transition}
            >
                {children}
                {dismissible && <Button bsPrefix='btn-close' onClick={() => setDisplay(!display)} ><FontAwesomeIcon icon={faClose} /></Button>}
            </Alert>
        </>
    )
}

const Header = (props) => <Alert.Heading as={props.as} bsPrefix={props.bsPrefix} className={props.className} >{props.children}</Alert.Heading>
HkAlert.Header = Header;

const Link = (props) => <Alert.Link href={props.href} bsPrefix={props.bsPrefix} className={props.className}>{props.children}</Alert.Link>
HkAlert.Link = Link;

HkAlert.propTypes = {
    show: PropTypes.bool,
    variant: PropTypes.string,
    className: PropTypes.string,
    dismissible: PropTypes.bool,
    inverse: PropTypes.bool,
    bsPrefix: PropTypes.string,
    closeLabel: PropTypes.bool,
    closeVariant: PropTypes.bool,
}

export default HkAlert
