import React, { useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button, Form } from 'react-bootstrap';

const HkFormWizard = ({
    steps,
    nextBtnLabel,
    prevBtnLabel,
    submitBtnLabel,
    onSubmit
}) => {
    const [activeStep, setActiveStep] = useState(0);

    const handleNext = () => {
        setActiveStep(activeStep + 1);
    };

    const handlePrevious = () => {
        setActiveStep(activeStep - 1);
    };

    const handleFinish = () => {
        setActiveStep(activeStep + 1);
        if (onSubmit) {
            onSubmit();
        };
    }

    const selectStep = (step) => {
        if (step < activeStep && activeStep !== steps.length) {
            setActiveStep(step);
        }
    }

    // console.log("active:" + activeStep);
    // console.log("length:" + steps.length);

    return (
        <div>
            <div className="hk-wizard hk-wizard-horizontal hk-wizard-label-horizontal">
                {steps.map((ele, indx) => (
                    <div className={classNames("hk-wizard-item hk-wizard-item-wait hk-wizard-item-custom", { "hk-wizard-item-finish hk-wizard-item-active": activeStep === indx }, { "hk-wizard-item-completed": activeStep > indx })} key={indx}>
                        <div className="hk-wizard-item-container" role="button" onClick={() => selectStep(indx)}>
                            <div className="hk-wizard-item-tail" />
                            <div className="hk-wizard-item-icon">
                                <span className="hk-wizard-icon">
                                    {ele.icon}
                                </span>
                            </div>
                            <div className="hk-wizard-item-content align-bottom">
                                <div className="hk-wizard-item-title">{ele.label}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="hk-wizard-form-container">
                {steps[activeStep]?.content}
                <Form aria-disabled>
                    {activeStep === steps.length && steps[activeStep - 1].content}
                </Form>
            </div>
            <div className="hk-wizard-actions">
                {activeStep > 0 && (
                    <Button variant="primary" onClick={handlePrevious} className="me-3" disabled={activeStep === steps.length}>
                        {prevBtnLabel ? prevBtnLabel : "Previous"}
                    </Button>
                )}
                {activeStep < steps.length - 1 && (
                    <Button variant="primary" onClick={handleNext}>
                        {nextBtnLabel ? nextBtnLabel : "Next"}
                    </Button>
                )}
                {
                    activeStep === steps.length - 1 && (
                        <Button variant="success" onClick={handleFinish}>
                            {submitBtnLabel ? submitBtnLabel : "Submit"}
                        </Button>
                    )
                }
            </div>
        </div>
    );
}

HkFormWizard.propTypes = {
    steps: PropTypes.array.isRequired,
    nextBtnLabel: PropTypes.string,
    prevBtnLabel: PropTypes.string,
    submitBtnLabel: PropTypes.string,
    onSubmit: PropTypes.func,
}

export default HkFormWizard;
