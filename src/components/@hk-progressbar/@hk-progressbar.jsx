import classNames from 'classnames';
import { useEffect, useState } from 'react'
import { ProgressBar } from 'react-bootstrap';
import PropTypes from 'prop-types';

const HkProgressBar = ({
    now,
    max = 100,
    min = 0,
    label,
    striped,
    variant,
    size,
    key,
    animated,
    rounded,
    className,
    bsPrefix
}) => {

    const [currentValue, setcurrentValue] = useState(0);

    useEffect(() => {
        setTimeout(() => setcurrentValue(now), 500);
    }, [now])

    return (
        <>
            <ProgressBar
                variant={variant}
                now={currentValue}
                max={max}
                min={min}
                key={key}
                animated={animated}
                label={label}
                striped={striped}
                className={classNames(className, { "progress-bar-rounded": rounded }, (size ? `progress-bar-${size}` : ""))}
                bsPrefix={bsPrefix}
            />
        </>
    )
}

const Label = ({ children, className }) => <label className={classNames("progress-label", className)}>{children}</label>
HkProgressBar.Label = Label;

const Wrapper = ({ children, className }) => <div className={classNames("progress-lb-wrap", className)}>{children}</div>
HkProgressBar.Wrapper = Wrapper;

HkProgressBar.propTypes = {
    now: PropTypes.number.isRequired,
    max: PropTypes.number,
    min: PropTypes.number,
    variant: PropTypes.string,
    label: PropTypes.node,
    striped: PropTypes.bool,
    size: PropTypes.string,
    animated: PropTypes.bool,
    rounded: PropTypes.bool,
}


export default HkProgressBar
