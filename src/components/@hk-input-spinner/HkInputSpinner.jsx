import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import { Button, FormControl, InputGroup } from 'react-bootstrap';
import PropTypes from 'prop-types';

const HkInputSpinner = ({
    initialValue = 0,
    minValue = 0,
    maxValue,
    precision,
    step = 1,
    size,
    onChange,
    isValid = false,
    isInvalid = false,
    wrapperClass,
    className }) => {

    //Checking Precision for float values
    const isFloatInputAllowed = precision !== undefined;

    const [value, setValue] = useState(() => {
        if (minValue) {
            if (initialValue >= minValue) {
                return (isFloatInputAllowed ? initialValue.toFixed(precision) : parseInt(initialValue, 10))
            }
            else {
                return (isFloatInputAllowed ? minValue.toFixed(precision) : parseInt(minValue, 10))
            }
        }
        else {
            return (isFloatInputAllowed ? initialValue.toFixed(precision) : parseInt(initialValue, 10))
        }
    });

    // hand use input
    const handleChange = (e) => {
        const inputValue = e.target.value;
        const isValidNumber = isFloatInputAllowed
            ? /^-?\d*\.?\d*$/.test(inputValue)
            : /^-?\d*$/.test(inputValue);

        if (isValidNumber) {
            setValue(inputValue);
        };


    };

    const handleFocus = (e) => {
        if (e.target.value > maxValue) {
            setValue(isFloatInputAllowed ? maxValue.toFixed(precision) : parseInt(maxValue, 10))
        }
        else if (e.target.value < minValue) {
            setValue(isFloatInputAllowed ? minValue.toFixed(precision) : parseInt(minValue, 10))
        };

    }

    //increment button logic
    const increment = () => {
        setValue((prevValue) => {
            const newValue = parseFloat(prevValue) + step;
            return newValue > maxValue ? maxValue : (isFloatInputAllowed ? newValue.toFixed(precision) : parseInt(newValue, 10));
        });
    };

    //decrement button logic
    const decrement = () => {
        setValue((prevValue) => {
            const newValue = parseFloat(prevValue) - step;
            return newValue < minValue ? minValue : (isFloatInputAllowed ? newValue.toFixed(precision) : parseInt(newValue, 10));
        });
    };

    useEffect(() => {
        if (onChange) {
            if (typeof value !== "string") {
                onChange(isFloatInputAllowed ? value.toFixed(precision) : parseInt(value, 10));
            }
            else {
                onChange(parseFloat(value))
            }
        }
    }, [isFloatInputAllowed, precision, value, onChange])

    return (
        <InputGroup size={size} className={classNames("input-spinner-wrap", wrapperClass)} >
            <Button className="btn-decrement" variant="outline-light" size={size} onClick={decrement} disabled={value === minValue} />
            <FormControl
                className={classNames("text-center", className)}
                type="text"
                isValid={isValid}
                isInvalid={isInvalid}
                value={value}
                min={minValue}
                max={maxValue}
                step={step}
                onChange={handleChange}
                onBlur={handleFocus}
            />
            <Button className="btn-increment" variant="outline-light" size={size} onClick={increment} disabled={value === maxValue} />
        </InputGroup>
    );
};

HkInputSpinner.propTypes = {
    initialValue: PropTypes.number,
    minValue: PropTypes.number,
    maxValue: PropTypes.number,
    precision: PropTypes.number,
    step: PropTypes.number,
    size: PropTypes.string,
    onChange: PropTypes.any,
    isValid: PropTypes.bool,
    isInvalid: PropTypes.bool,
    wrapperClass: PropTypes.string,
    className: PropTypes.string,
}

export default HkInputSpinner;
