'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Alert, Button, Col, Container, Form, InputGroup, Row } from 'react-bootstrap'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePlatformContext } from '@/context/PlatformContext'
import { getCityDisplayName, getLoginTitle } from '@/data/digital-twin/platformBrand'
import CommonFooter1 from '../CommonFooter1'
import brandMark from '@/assets/img/brand-sm.svg'

const accessSurfaces = [
  'Cockpit for baseline, logical twin, and semantic separation.',
  'City 3D for spatial inspection and service attachment.',
  'Civic XR for public explanation and partner demos.',
]

const Login = () => {
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [workspaceCityId, setWorkspaceCityId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const activationSuccess = searchParams.get('activated') === '1'
  const activationError = searchParams.get('activation_error')
  const nextRoute = searchParams.get('next') || '/cockpit'
  const { activeCity, availableCities, brandName, refreshPlatformContext, setSelectedCityId, workspaceName } =
    usePlatformContext()

  useEffect(() => {
    setWorkspaceCityId((current) => {
      if (current && availableCities.some((city) => city.id === current)) {
        return current
      }
      return activeCity?.id ?? availableCities[0]?.id ?? ''
    })
  }, [activeCity?.id, availableCities])

  const selectedCity = useMemo(
    () => availableCities.find((city) => city.id === workspaceCityId) ?? activeCity ?? null,
    [activeCity, availableCities, workspaceCityId],
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: userName,
          password,
          cityId: workspaceCityId,
          rememberMe,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'INVALID_CREDENTIALS')
      }
      setSelectedCityId(payload?.session?.cityId || workspaceCityId)
      await refreshPlatformContext({ silent: true })
      router.push(nextRoute)
    } catch (error) {
      const code = String(error?.message || 'LOGIN_FAILED')
      setError(
        code === 'INVALID_CREDENTIALS'
          ? 'The email or password is not valid, or the account has not been activated yet.'
          : code === 'CITY_NOT_AVAILABLE'
            ? 'The selected city is not available for this account.'
            : 'Could not open the workspace session. Please try again.',
      )
      setSubmitting(false)
    }
  }

  return (
    <div className="hk-pg-wrapper pt-0 pb-xl-0 pb-5">
      <div className="hk-pg-body pt-0 pb-xl-0">
        <Container fluid>
          <Row className="auth-split">
            <Col xl={5} lg={6} md={7} className="position-relative mx-auto">
              <div className="auth-content flex-column pt-8 pb-md-8 pb-13">
                <div className="text-center mb-7">
                  <Link href="/" className="navbar-brand me-0 d-inline-flex align-items-center gap-3">
                    <Image className="brand-img d-inline-block" src={brandMark} alt={workspaceName} />
                    <span className="d-inline-flex flex-column text-start lh-sm">
                      <small className="text-uppercase text-primary fw-semibold">{brandName} / {getCityDisplayName(selectedCity)}</small>
                      <strong>{workspaceName}</strong>
                      <span className="text-muted">{getLoginTitle(selectedCity)}</span>
                    </span>
                  </Link>
                </div>

                <Form className="w-100" onSubmit={handleSubmit}>
                  <Row>
                    <Col xl={8} sm={10} className="mx-auto">
                      <div className="text-center mb-4">
                        <h4>Enter the twin workspace</h4>
                        <p>Sign in to review the current city baseline, inspect the active logical twin, and control which municipal workspace is live.</p>
                      </div>
                      {activationSuccess ? (
                        <Alert variant="success">
                          Your account is now active. Sign in to open the workspace.
                        </Alert>
                      ) : null}
                      {activationError ? (
                        <Alert variant="warning">
                          The activation link is no longer valid. Request a new account activation or password reset.
                        </Alert>
                      ) : null}
                      {error ? <Alert variant="danger">{error}</Alert> : null}
                      <Row className="gx-3">
                        <Col as={Form.Group} lg={12} className="mb-3">
                          <div className="form-label-group">
                            <Form.Label>Workspace city</Form.Label>
                          </div>
                          <Form.Select
                            onChange={(event) => setWorkspaceCityId(event.target.value)}
                            required
                            value={workspaceCityId}
                          >
                            {availableCities.map((city) => (
                              <option key={city.id} value={city.id}>
                                {city.name}, {city.country}
                              </option>
                            ))}
                          </Form.Select>
                        </Col>
                        <Col as={Form.Group} lg={12} className="mb-3">
                          <div className="form-label-group">
                            <Form.Label>User name or email</Form.Label>
                          </div>
                          <Form.Control
                            autoComplete="username"
                            id="login-username"
                            name="username"
                            placeholder="Enter your workspace email"
                            type="text"
                            value={userName}
                            onChange={(event) => setUserName(event.target.value)}
                          />
                        </Col>
                        <Col as={Form.Group} lg={12} className="mb-3">
                          <div className="form-label-group">
                            <Form.Label>Password</Form.Label>
                            <Link href="/auth/reset-password" className="fs-7 fw-medium">Reset password</Link>
                          </div>
                          <InputGroup className="password-check">
                            <span className="input-affix-wrapper affix-wth-text">
                              <Form.Control
                                autoComplete="current-password"
                                id="login-password"
                                name="current-password"
                                placeholder="Enter your password"
                                required
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                type={showPassword ? 'text' : 'password'}
                              />
                              <button
                                className="input-suffix text-primary text-uppercase fs-8 fw-medium bg-transparent border-0"
                                onClick={() => setShowPassword((current) => !current)}
                                type="button"
                              >
                                {showPassword ? 'Hide' : 'Show'}
                              </button>
                            </span>
                          </InputGroup>
                        </Col>
                      </Row>

                      <div className="d-flex justify-content-center">
                        <Form.Check id="logged_in" className="form-check-sm mb-3">
                          <Form.Check.Input
                            checked={rememberMe}
                            onChange={(event) => setRememberMe(event.target.checked)}
                            type="checkbox"
                          />
                          <Form.Check.Label className="text-muted fs-7">Keep this workspace session active</Form.Check.Label>
                        </Form.Check>
                      </div>

                      <Button disabled={!workspaceCityId || !userName.trim() || !password.trim() || submitting} variant="primary" type="submit" className="btn-uppercase btn-block">
                        {submitting ? 'Opening workspace…' : 'Enter Twin Base Studio'}
                      </Button>
                      <p className="p-xs mt-3 mb-1 text-center">
                        Don&apos;t have an account yet? <Link href="/auth/signup"><u>Create one here</u></Link>
                      </p>
                      <p className="p-xs mt-3 text-center text-muted">This light platform can later be fed by Polisplexity proper without changing the user-facing workspace.</p>
                    </Col>
                  </Row>
                </Form>
              </div>
            </Col>

            <Col xl={7} lg={6} md={5} sm={10} className="d-md-block d-none position-relative bg-primary-light-5">
              <div className="auth-content flex-column py-8 px-5">
                <div className="mb-5">
                  <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Current active city</div>
                  <h2 className="mb-3">{getCityDisplayName(selectedCity)}</h2>
                  <p className="mb-0">The login opens the selected municipal twin workspace, not a generic template surface.</p>
                </div>

                <Row className="g-3">
                  {accessSurfaces.map((item) => (
                    <Col md={12} key={item}>
                      <div className="dt-side-note h-100">
                        <strong>Workspace surface</strong>
                        <p className="mt-2 mb-0">{item}</p>
                      </div>
                    </Col>
                  ))}
                </Row>

                <div className="dt-side-note mt-4">
                  <strong>Registry posture</strong>
                  <p className="mt-2 mb-0">Cities stay lightweight and preloaded. The active workspace is selected from a local registry and can later be synchronized from Polisplexity.</p>
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
      <CommonFooter1 />
    </div>
  )
}

export default Login
