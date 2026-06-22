'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Alert, Button, Card, Col, Container, Form, InputGroup, Row } from 'react-bootstrap'
import { usePlatformContext } from '@/context/PlatformContext'
import { getCityDisplayName, getLoginTitle, getWorkspaceSubline } from '@/data/digital-twin/platformBrand'
import CommonFooter1 from '../CommonFooter1'
import brandMark from '@/assets/img/brand-sm.svg'

const signupBullets = [
  'Choose one enabled city workspace.',
  'Request the role that matches your access need.',
  'Activate the account from the email link before signing in.',
]

const roleOptions = [
  { value: 'municipal-reviewer', label: 'Municipal reviewer' },
  { value: 'city-operator', label: 'City operator' },
  { value: 'partner-observer', label: 'Partner observer' },
  { value: 'public-story-editor', label: 'Public story editor' },
]

const Signup = () => {
  const [workspaceCityId, setWorkspaceCityId] = useState('')
  const [fullName, setFullName] = useState('')
  const [workspaceRole, setWorkspaceRole] = useState('municipal-reviewer')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const { activeCity, availableCities, brandName, workspaceName } = usePlatformContext()

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
      const response = await fetch('/api/auth/signup-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          fullName,
          email,
          password,
          cityId: workspaceCityId,
          role: workspaceRole,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'SIGNUP_REQUEST_FAILED')
      }
      setSuccess({
        email,
        city: getCityDisplayName(selectedCity),
        delivery: payload.delivery || 'outbox',
      })
      setSubmitting(false)
    } catch (error) {
      const code = String(error?.message || 'SIGNUP_REQUEST_FAILED')
      setError(
        code === 'ACCOUNT_ALREADY_ACTIVE'
          ? 'This account is already active. Sign in instead.'
          : code === 'CITY_NOT_AVAILABLE'
            ? 'The selected city is not currently available for signup.'
            : code === 'PASSWORD_TOO_SHORT'
              ? 'Use a password with at least 10 characters.'
              : 'Could not create the account request. Please review the form and try again.',
      )
      setSubmitting(false)
    }
  }

  const canSubmit = workspaceCityId && fullName.trim() && email.trim() && password.trim() && acceptedTerms
  const workspaceSubline = getWorkspaceSubline(selectedCity)
  const municipalityDescription =
    selectedCity?.municipalityDescription ?? 'Municipal digital-twin workspace enabled through the registry.'

  return (
    <div className="hk-pg-wrapper pt-0 pb-xl-0 pb-5">
      <div className="hk-pg-body pt-0 pb-xl-0">
        <Container fluid>
          <Row>
            <Col xl={7} lg={6} className="d-lg-block d-none v-separator dt-auth-panel">
              <div className="auth-content py-md-0 py-8">
                <Row>
                  <Col xxl={9} xl={8} lg={11} className="mx-auto">
                    <div className="mb-5">
                      <div className="dt-auth-city-hero__eyebrow">Workspace onboarding</div>
                      <h3 className="mb-3">{getCityDisplayName(selectedCity)} twin access</h3>
                      <p>
                        Request a managed account for municipal review, operations, partner observation, or public walkthrough preparation inside one city workspace.
                      </p>
                    </div>

                    <ul className="list-icon mt-4">
                      {signupBullets.map((item) => (
                        <li className="mb-2" key={item}>
                          <p className="mb-0">
                            <i className="ri-check-fill text-white" />
                            <span>{item}</span>
                          </p>
                        </li>
                      ))}
                    </ul>

                    <Row className="gx-3 mt-6">
                      <Col lg={6}>
                        <Card className="card-shadow dt-auth-side-card">
                          <Card.Body>
                            <Card.Title className="text-uppercase">Current workspace</Card.Title>
                            <Card.Text className="mb-1">{getCityDisplayName(selectedCity)}</Card.Text>
                            <small>{workspaceSubline}</small>
                          </Card.Body>
                        </Card>
                      </Col>
                      <Col lg={6}>
                        <Card className="card-shadow dt-auth-side-card">
                          <Card.Body>
                            <Card.Title className="text-uppercase">Access surfaces</Card.Title>
                            <Card.Text className="mb-0">Cockpit, Analytical Map, City 3D, Civic XR, Theory, and Docs.</Card.Text>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>
                  </Col>
                </Row>
              </div>
            </Col>

            <Col xl={5} lg={6} md={8} sm={10} className="position-relative mx-auto">
              <div className="auth-content py-md-0 py-8">
                <Form className="w-100" onSubmit={handleSubmit}>
                  <Row>
                    <Col lg={10} className="mx-auto">
                      <div className="text-center mb-5">
                        <Link href="/" className="navbar-brand me-0 d-inline-flex align-items-center gap-3 mb-4">
                          <Image className="brand-img d-inline-block" src={brandMark} alt={workspaceName} />
                          <span className="d-inline-flex flex-column text-start lh-sm">
                            <small className="text-uppercase text-primary fw-semibold">{brandName} / {getCityDisplayName(selectedCity)}</small>
                            <strong>{workspaceName}</strong>
                            <span className="text-muted">{getLoginTitle(selectedCity)}</span>
                          </span>
                        </Link>
                        <h4 className="mb-2">Create a workspace account</h4>
                        <div className="d-flex flex-column align-items-center gap-2">
                          <p className="p-xs text-center mb-0">
                            Already a member?
                          </p>
                          <Button as={Link} href="/auth/login" size="sm" variant="outline-primary">
                            Sign in
                          </Button>
                        </div>
                      </div>

                      {success ? (
                        <Alert variant="success">
                          <div className="d-flex flex-column gap-3">
                            <div>
                              Account request created for <strong>{success.city}</strong>. Check <strong>{success.email}</strong> for the activation link.
                            </div>
                            <div className="d-flex flex-wrap gap-2">
                              <Button as={Link} href="/auth/login" size="sm" variant="outline-success">
                                Open sign in
                              </Button>
                              <span className="small text-success-emphasis align-self-center">
                                You can sign in after activation or if your account was already active.
                              </span>
                            </div>
                          </div>
                        </Alert>
                      ) : null}
                      {error ? <Alert variant="danger">{error}</Alert> : null}

                      <Row className="gx-3">
                        <Col lg={12} as={Form.Group} className="mb-3">
                          <Form.Label>Workspace city</Form.Label>
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
                        <Col lg={6} as={Form.Group} className="mb-3">
                          <Form.Label>Full name</Form.Label>
                          <Form.Control
                            autoComplete="name"
                            id="signup-full-name"
                            name="name"
                            placeholder="Enter your full name"
                            type="text"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                          />
                        </Col>
                        <Col lg={6} as={Form.Group} className="mb-3">
                          <Form.Label>Workspace role</Form.Label>
                          <Form.Select value={workspaceRole} onChange={(event) => setWorkspaceRole(event.target.value)}>
                            {roleOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Form.Select>
                        </Col>
                        <Col lg={12} as={Form.Group} className="mb-3">
                          <Form.Label>Email</Form.Label>
                          <Form.Control
                            autoComplete="email"
                            id="signup-email"
                            name="email"
                            placeholder="Enter your workspace email"
                            required
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                          />
                        </Col>
                        <Col lg={12} as={Form.Group} className="mb-3">
                          <Form.Label>Password</Form.Label>
                          <InputGroup className="password-check">
                            <span className="input-affix-wrapper affix-wth-text">
                              <Form.Control
                                autoComplete="new-password"
                                id="signup-password"
                                name="new-password"
                                placeholder="Create a strong password"
                                required
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
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

                      <Button
                        disabled={!canSubmit || submitting}
                        variant="primary"
                        className="btn-rounded btn-uppercase btn-block mb-3"
                        type="submit"
                      >
                        {submitting ? 'Creating request…' : 'Create account'}
                      </Button>

                      <Form.Check id="terms_signup" className="form-check-sm mb-3">
                        <Form.Check.Input
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={(event) => setAcceptedTerms(event.target.checked)}
                        />
                        <Form.Check.Label className="text-muted fs-7">
                          By creating an account you agree to the workspace access policy, municipal review terms, and the platform privacy posture for the selected city workspace.
                        </Form.Check.Label>
                      </Form.Check>
                    </Col>
                  </Row>
                </Form>
              </div>
              <CommonFooter1 />
            </Col>
          </Row>
        </Container>
      </div>
    </div>
  )
}

export default Signup
