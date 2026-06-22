import { Col, Container, Row } from 'react-bootstrap'

const Footer = () => {
  return (
    <div className="hk-footer border-0 bg-transparent">
      <Container as="footer" className="footer">
        <Row>
          <Col xl={8} className="text-center">
            <p className="footer-text pb-0">
              <span className="copy-text text-white opacity-55">Twin Base Studio © {new Date().getFullYear()} Polisplexity.</span>
              <a href="#" className="text-white opacity-55">Privacy Policy</a>
              <span className="footer-link-sep text-white opacity-55">|</span>
              <a href="#" className="text-white opacity-55">Terms</a>
              <span className="footer-link-sep text-white opacity-55">|</span>
              <a href="#" className="text-white opacity-55">Platform Status</a>
            </p>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export default Footer
