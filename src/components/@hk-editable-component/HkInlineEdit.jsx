'use client'
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button, Form } from 'react-bootstrap'
import { Edit2 } from 'react-feather';

const HkInlineEdit = ({ value, as, className, containerClass, id, left }) => {
    const [editable, setEditable] = useState(false);

    const onEdit = () => {
        var el = document.getElementById(id);
        el.contentEditable = true;
        var range = document.createRange();
        var sel = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        el.focus();
        setEditable(!editable);

    }

    const BlurEle = () => {
        var el = document.getElementById(id);
        el.contentEditable = false;
        setEditable(false);
    }

    return (

        <>
            <span className={classNames("d-flex align-items-center inline-editable-wrap", containerClass)}>

                {(!editable && left) && <Button size="sm" variant="flush-light" className="btn-icon btn-rounded flush-soft-hover edit-tyn ms-1" onClick={onEdit} >
                    <span className="icon">
                        <span className="feather-icon">
                            <Edit2 />
                        </span>
                    </span>
                </Button>}

                <Form.Label as={as} id={id} className={classNames(className)} onBlur={BlurEle} >
                    {value}
                </Form.Label>

                {(!editable && !left) && <Button size="sm" variant="flush-light" className="btn-icon btn-rounded flush-soft-hover edit-tyn ms-1" onClick={onEdit} >
                    <span className="icon">
                        <span className="feather-icon">
                            <Edit2 />
                        </span>
                    </span>
                </Button>}
            </span>
        </>
    )
}

HkInlineEdit.propTypes = {
    id: PropTypes.any.isRequired,
    value: PropTypes.string,

}


export default HkInlineEdit
