'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Alert, Button, Card, Col, Container, Form, InputGroup, Row } from 'react-bootstrap'
import { useRouter, useSearchParams } from 'next/navigation'
import CommonFooter1 from '../CommonFooter1'
import { usePlatformContext } from '@/context/PlatformContext'
import { getCityDisplayName } from '@/data/digital-twin/platformBrand'
import brandMark from '@/assets/img/brand-sm.svg'

const ResetPassword = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const { activeCity, brandName, workspaceName } = usePlatformContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const resetMode = useMemo(() => (token ? 'apply' : 'request'), [token])

  const handleRequest = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'RESET_REQUEST_FAILED')
      }
      setSuccess('If the account is active, a reset link has been prepared and sent to the workspace email.')
      setSubmitting(false)
    } catch {
      setError('Could not prepare the reset request. Please try again.')
      setSubmitting(false)
    }
  }

  const handleReset = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      if (password !== confirmPassword) {
        throw new Error('PASSWORD_MISMATCH')
      }
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token, password }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'RESET_FAILED')
      }
      setSuccess('Password updated. Redirecting you to sign in…')
      setTimeout(() => router.push('/auth/login'), 1200)
    } catch (error) {
      const code = String(error?.message || 'RESET_FAILED')
      setError(
        code === 'PASSWORD_MISMATCH'
          ? 'The passwords do not match.'
          : code === 'TOKEN_INVALID'
            ? 'The reset link is no longer valid.'
            : code === 'PASSWORD_TOO_SHORT'
              ? 'Use a password with at least 10 characters.'
              : 'Could not reset the password.',
      )
      setSubmitting(false)
    }
  }

  return (
    <div className="hk-pg-wrapper pt-0 pb-xl-0 pb-5">
      <div className="hk-pg-body pt-0 pb-xl-0">
        <Container>
          <Row>
            <Col sm={10} className="position-relative mx-auto">
              <div className="auth-content py-8">
                <Form className="w-100" onSubmit={resetMode === 'apply' ? handleReset : handleRequest}>
                  <Row>
                    <Col lg={5} md={7} sm={10} className="mx-auto">
                      <div className="text-center mb-7">
                        <Link href="/" className="navbar-brand me-0 d-inline-flex align-items-center gap-3">
                          <Image className="brand-img d-inline-block" src={brandMark} alt={workspaceName} />
                          <span className="d-inline-flex flex-column text-start lh-sm">
                            <small className="text-uppercase text-primary fw-semibold">
                              {brandName} / {getCityDisplayName(activeCity)}
                            </small>
                            <strong>{workspaceName}</strong>
                          </span>
                        </Link>
                      </div>
                      <Card className="card-flush">
                        <Card.Body>
                          <h4 className="text-center">
                            {resetMode === 'apply' ? 'Choose a new password' : 'Reset your password'}
                          </h4>
                          <p className="mb-4 text-center">
                            {resetMode === 'apply'
                              ? 'Set the new password for the workspace account linked to this token.'
                              : 'Use your workspace email to request a password reset for the current twin platform session.'}
                          </p>
                          {success ? <Alert variant="success">{success}</Alert> : null}
                          {error ? <Alert variant="danger">{error}</Alert> : null}
                          <Row className="gx-3">
                            {resetMode === 'request' ? (
                              <Col lg={12} as={Form.Group} className="mb-3">
                                <div className="form-label-group">
                                  <Form.Label>Email</Form.Label>
                                  <Link href="/auth/login" className="fs-7 fw-medium">Back to login</Link>
                                </div>
                                <Form.Control
                                  autoComplete="username"
                                  id="reset-email"
                                  name="email"
                                  placeholder="Workspace email"
                                  required
                                  type="email"
                                  value={email}
                                  onChange={(event) => setEmail(event.target.value)}
                                />
                              </Col>
                            ) : (
                              <>
                                <Col lg={12} as={Form.Group} className="mb-3">
                                  <div className="form-label-group">
                                    <Form.Label>New password</Form.Label>
                                    <Link href="/auth/login" className="fs-7 fw-medium">Back to login</Link>
                                  </div>
                                  <InputGroup className="password-check">
                                    <span className="input-affix-wrapper affix-wth-text">
                                      <Form.Control
                                        autoComplete="new-password"
                                        id="new-password"
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
                                <Col lg={12} as={Form.Group} className="mb-3">
                                  <Form.Label>Confirm password</Form.Label>
                                  <Form.Control
                                    autoComplete="new-password"
                                    id="confirm-new-password"
                                    name="confirm-new-password"
                                    placeholder="Repeat the new password"
                                    required
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                  />
                                </Col>
                              </>
                            )}
                          </Row>
                          <Button
                            disabled={submitting || (resetMode === 'request' ? !email.trim() : !password.trim() || !confirmPassword.trim())}
                            variant="primary"
                            className="btn-uppercase btn-block"
                            type="submit"
                          >
                            {submitting
                              ? resetMode === 'apply'
                                ? 'Updating password…'
                                : 'Preparing reset…'
                              : resetMode === 'apply'
                                ? 'Update password'
                                : 'Send reset link'}
                          </Button>
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
      <CommonFooter1 />
    </div>
  )
}

export default ResetPassword
