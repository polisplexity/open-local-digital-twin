'use client'

import { useRouter } from 'next/navigation'
import { Card, Col, Container, Form, Row } from 'react-bootstrap'
import { usePlatformContext } from '@/context/PlatformContext'
import { getCityDisplayName, getLoginTitle } from '@/data/digital-twin/platformBrand'
import Footer from './Footer'

const LockScreen = () => {
  const router = useRouter()
  const { activeCity, brandName, workspaceName } = usePlatformContext()

  const unlockScreen = (event) => {
    event.preventDefault()
    router.push('/')
  }

  return (
    <div className="hk-pg-wrapper pt-0 pb-xl-0 pb-5">
      <div className="hk-pg-body pt-0 pb-xl-0">
        <Container>
          <Row>
            <Col sm={10} className="position-relative mx-auto">
              <div className="auth-content py-8">
                <Form className="w-100" onSubmit={unlockScreen}>
                  <Row>
                    <Col lg={5} md={6} className="mx-auto">
                      <Card className="card-flush bg-transparent border border-white border-opacity-10">
                        <Card.Body className="text-center">
                          <div className="avatar avatar-xl avatar-soft-primary avatar-rounded position-relative mb-3">
                            <span className="initial-wrap fs-3 fw-bold">EA</span>
                          </div>
                          <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">{brandName} / {getCityDisplayName(activeCity)}</div>
                          <h4 className="text-white">{workspaceName}</h4>
                          <p className="p-sm mb-2 text-white opacity-75">{getLoginTitle(activeCity)}</p>
                          <p className="p-sm mb-4 text-white opacity-55">admin@example.org</p>
                          <Row className="gx-3">
                            <Col as={Form.Group} className="mb-3">
                              <Form.Control placeholder="Enter password" type="password" />
                            </Col>
                          </Row>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </Form>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
      <Footer />
    </div>
  )
}

export default LockScreen
