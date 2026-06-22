import { Col, Container, Row } from 'react-bootstrap';

const CommonFooter1 = () => {
    return (
        <div className="hk-footer border-0">
            <Container as="footer" className="footer">
                <Row>
                    <Col xl={8} className="text-center">
                        <p className="footer-text pb-0">
                            <span className="copy-text">Twin Base Studio © {new Date().getFullYear()} Polisplexity.</span>
                            <a href="#">Privacy Policy</a>
                            <span className="footer-link-sep">|</span><a href="#">Terms</a><span className="footer-link-sep">|</span><a href="#">Platform Status</a>
                        </p>
                    </Col>
                </Row>
            </Container>
        </div>
    )
}

export default CommonFooter1
