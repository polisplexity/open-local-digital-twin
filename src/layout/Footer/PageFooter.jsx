import Link from 'next/link';
import { Col, Container, Row } from 'react-bootstrap';
import { ExternalLink } from 'react-feather';

const PageFooter = () => {
    return (
        <div className="hk-footer">
            <Container as="footer" className="footer">
                <Row>
                    <Col xl={8}>
                        <p className="footer-text">
                            <span className="copy-text">Twin Base Studio © {new Date().getFullYear()} Polisplexity.</span> <Link href="#">Privacy Policy</Link><span className="footer-link-sep">|</span><Link href="#">Terms</Link><span className="footer-link-sep">|</span><Link href="#">Platform Status</Link></p>
                    </Col>
                    <Col xl={4}>
                        <Link href="#" className="footer-extr-link link-default">
                            <span className="feather-icon">
                                <ExternalLink />
                            </span>
                            <u>Request platform support</u>
                        </Link>
                    </Col>
                </Row>
            </Container>
        </div>
    )
}

export default PageFooter
