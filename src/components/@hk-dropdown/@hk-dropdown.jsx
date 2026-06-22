import React, { useReducer } from 'react';
import { Dropdown } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { dropdownReducer } from './DropdownReducer';

const pageVariants = {
    initial: {
        opacity: 0,
        y: 10
    },
    open: {
        opacity: 1,
        y: 0
    },
    close: {
        opacity: 0,
        y: 10
    }
};


const HkDropdown = ({ children, classNames, show, ...rest }) => {

    const [state, dispatch] = useReducer(dropdownReducer, false);

    return (
        <>
            <Dropdown className={classNames} {...rest} onToggle={() => dispatch({ type: 'show' })}  >
                {children}
            </Dropdown>
        </>
    )
}

const Toggle = ({ children, classNames, show, onClick, ...rest }) => <Dropdown.Toggle className={classNames}  {...rest}>{children}</Dropdown.Toggle>
HkDropdown.Toggle = Toggle;

const Menu = ({ children, classNames, show, ...rest }) => <Dropdown.Menu
    as={motion.div}
    animate="in"
    exit="out"
    variants={pageVariants}
    transition={{ duration: 0.3 }}
    className={classNames}
    {...rest}
>
    {children}
</Dropdown.Menu>
HkDropdown.Menu = Menu;

const Item = ({ children, classNames, ...rest }) => <Dropdown.Item className={classNames} {...rest} >{children}</Dropdown.Item>
HkDropdown.Item = Item;

const Header = ({ children, classNames, ...rest }) => <Dropdown.Header className={classNames} {...rest} >{children}</Dropdown.Header>
HkDropdown.Header = Header;

export default HkDropdown
