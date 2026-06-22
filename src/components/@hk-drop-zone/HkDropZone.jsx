import { useEffect, useRef } from "react";
import Dropzone from "dropzone";
import classNames from "classnames";
import { Col, Row } from "react-bootstrap";

const HkFileInput = ({ children, className }) => {

    const dropzoneRef = useRef(null);

    useEffect(() => {
        // Configure Dropzone options
        const previewTemplate = `
    <div class="dz-preview dz-file-preview">
      <img data-dz-thumbnail alt="Preview" class="img-fluid rounded-circle" />
    </div>
  `;

        const dropzone = new Dropzone(dropzoneRef.current, {
            url: "no-url", // Replace with your upload URL
            acceptedFiles: "image/*",
            autoProcessQueue: false,
            addRemoveLinks: true,
            uploadprogress: 100,
            previewTemplate: previewTemplate,
        });

        return () => {
            // Cleanup Dropzone instance
            dropzone.destroy();
        };
    }, []);

    return (
        <div ref={dropzoneRef} className={classNames('dropzone', `${className}`)}>
            <span className="dz-default dz-message">
                <Row className="text-muted mb-2">
                    <Col className="dz-icon">
                        {/* Custom icon */}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                    </Col>
                </Row>
                <Row>
                    <Col>
                        {children}
                    </Col>
                </Row>
            </span>
        </div>
    );
};

export default HkFileInput;
