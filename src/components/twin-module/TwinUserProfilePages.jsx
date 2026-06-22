'use client'

import Link from 'next/link'
import {
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  Row,
  Table,
} from 'react-bootstrap'
import { Edit3, LogOut, MapPin, Settings, Shield, User } from 'react-feather'
import { usePlatformContext } from '@/context/PlatformContext'
import { getCityDisplayName, getCityWorkspaceLabel } from '@/data/digital-twin/platformBrand'
import { getTwinUserProfile } from '@/data/digital-twin/workspaceContent'

function ProfileHero() {
  const { activeCity, currentUser } = usePlatformContext()
  const twinUserProfile = getTwinUserProfile(activeCity, currentUser)
  const workspaceLabel = `${getCityWorkspaceLabel(activeCity)} Workspace`

  return (
    <Card className="card-border mb-4">
      <Card.Body className="d-flex flex-column flex-lg-row align-items-start gap-4">
        <div className="avatar avatar-xxl avatar-soft-primary avatar-rounded">
          <span className="initial-wrap fs-3 fw-bold">EA</span>
        </div>
        <div className="flex-grow-1">
          <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Workspace profile</div>
          <h1 className="mb-2">{twinUserProfile.shortName}</h1>
          <p className="mb-3">{twinUserProfile.bio}</p>
          <div className="d-flex flex-wrap gap-2">
            <Badge bg="primary" className="rounded-pill px-3 py-2">{twinUserProfile.role}</Badge>
            <Badge bg="dark" className="rounded-pill px-3 py-2">{workspaceLabel}</Badge>
            <Badge bg="success" className="rounded-pill px-3 py-2">{twinUserProfile.status}</Badge>
          </div>
        </div>
        <div className="d-grid gap-2 align-self-stretch align-self-lg-start">
          <Button as={Link} href="/profile/edit-profile" variant="primary">
            <Edit3 size={16} className="me-2" />
            Edit profile
          </Button>
          <Button as={Link} href="/profile/account" variant="outline-light">
            <Settings size={16} className="me-2" />
            Account settings
          </Button>
          <Button as={Link} href="/logout" variant="outline-danger">
            <LogOut size={16} className="me-2" />
            Log out
          </Button>
        </div>
      </Card.Body>
    </Card>
  )
}

function OverviewCards() {
  const { activeCity, currentUser } = usePlatformContext()
  const twinUserProfile = getTwinUserProfile(activeCity, currentUser)
  const cityLabel = activeCity ? `${getCityDisplayName(activeCity)}, ${activeCity.country}` : twinUserProfile.city
  const workspaceLabel = `${getCityWorkspaceLabel(activeCity)} Workspace`
  const cards = [
    { label: 'Workspace', value: workspaceLabel, note: cityLabel },
    { label: 'Access level', value: twinUserProfile.accessLevel, note: 'Admin-only tools are available from the user menu.' },
    { label: 'Email', value: twinUserProfile.email, note: twinUserProfile.organization },
    { label: 'Last seen', value: twinUserProfile.lastSeen, note: 'Current visible session in the twin workspace.' },
  ]

  return (
    <Row className="g-3 mb-4">
      {cards.map((card) => (
        <Col xl={3} md={6} key={card.label}>
          <Card className="card-border h-100">
            <Card.Body>
              <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">{card.label}</div>
              <h5 className="mb-2">{card.value}</h5>
              <p className="mb-0">{card.note}</p>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  )
}

function BulletCard({ title, eyebrow, items, icon }) {
  return (
    <Card className="card-border h-100">
      <Card.Header>
        <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">{eyebrow}</div>
        <h5 className="mb-0 d-flex align-items-center gap-2">
          {icon}
          {title}
        </h5>
      </Card.Header>
      <Card.Body className="dt-bullet-stack">
        {items.map((item) => (
          <div className="dt-bullet" key={item}>{item}</div>
        ))}
      </Card.Body>
    </Card>
  )
}

export function TwinProfileOverviewPage() {
  const { activeCity, currentUser } = usePlatformContext()
  const twinUserProfile = getTwinUserProfile(activeCity, currentUser)
  return (
    <div className="hk-pg-body py-4">
      <Container fluid="xxl">
        <ProfileHero />
        <OverviewCards />
        <Row className="g-3 mb-4">
          <Col xl={6}>
            <BulletCard
              eyebrow="Responsibilities"
              icon={<User size={16} />}
              items={twinUserProfile.responsibilities}
              title="What this user is responsible for"
            />
          </Col>
          <Col xl={6}>
            <BulletCard
              eyebrow="Permissions"
              icon={<Shield size={16} />}
              items={twinUserProfile.permissions}
              title="What this user can do inside the workspace"
            />
          </Col>
        </Row>
        <Row className="g-3">
          <Col xl={12}>
            <Card className="card-border">
              <Card.Header>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Recent workspace activity</div>
                <h5 className="mb-0">Latest routes opened by this user</h5>
              </Card.Header>
              <Card.Body className="p-0">
                <Table responsive className="mb-0">
                  <thead>
                    <tr>
                      <th>Surface</th>
                      <th>Current focus</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(twinUserProfile.recentSurfaces ?? []).map((entry) => (
                      <tr key={`${entry.surface}-${entry.time}`}>
                        <td>{entry.surface}</td>
                        <td>{entry.focus}</td>
                        <td>{entry.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export function TwinProfileAccountPage() {
  const { activeCity, currentUser } = usePlatformContext()
  const twinUserProfile = getTwinUserProfile(activeCity, currentUser)
  const cityLabel = activeCity ? `${getCityDisplayName(activeCity)}, ${activeCity.country}` : twinUserProfile.city
  return (
    <div className="hk-pg-body py-4">
      <Container fluid="xxl">
        <Row className="g-3 mb-4">
          <Col xl={8}>
            <Card className="card-border h-100">
              <Card.Header>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Account settings</div>
                <h5 className="mb-0">Workspace preferences</h5>
              </Card.Header>
              <Card.Body>
                <Row className="g-3">
                  {twinUserProfile.preferences.map((item) => (
                    <Col md={6} key={item.label}>
                      <div className="dt-side-note h-100">
                        <strong>{item.label}</strong>
                        <p className="mt-2 mb-0">{item.label === 'Primary city' ? cityLabel : item.value}</p>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={4}>
            <Card className="card-border h-100">
              <Card.Header>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Security posture</div>
                <h5 className="mb-0">Current account posture</h5>
              </Card.Header>
              <Card.Body className="dt-bullet-stack">
                {twinUserProfile.security.map((item) => (
                  <div className="dt-bullet" key={item.label}>
                    <strong>{item.label}.</strong> {item.value}
                  </div>
                ))}
              </Card.Body>
            </Card>
          </Col>
        </Row>
        <Row className="g-3">
          <Col xl={12}>
            <Card className="card-border">
              <Card.Header>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Operational routing</div>
                <h5 className="mb-0">Fast access</h5>
              </Card.Header>
              <Card.Body className="d-flex flex-wrap gap-2">
                <Button as={Link} href="/cockpit" variant="primary">Go to cockpit</Button>
                <Button as={Link} href="/map" variant="outline-light">Open Analytical Map</Button>
                <Button as={Link} href="/municipal" variant="outline-light">Open City 3D</Button>
                <Button as={Link} href="/public" variant="outline-light">Open Civic XR</Button>
                <Button as={Link} href="/admin" variant="outline-light">Open admin review</Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  )
}

export function TwinProfileEditPage() {
  const { activeCity, currentUser } = usePlatformContext()
  const twinUserProfile = getTwinUserProfile(activeCity, currentUser)
  const cityLabel = activeCity ? `${getCityDisplayName(activeCity)}, ${activeCity.country}` : twinUserProfile.city
  const workspaceLabel = `${getCityWorkspaceLabel(activeCity)} Workspace`
  return (
    <div className="hk-pg-body py-4">
      <Container fluid="xxl">
        <Card className="card-border">
          <Card.Header>
            <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Edit profile</div>
            <h5 className="mb-0">Workspace identity</h5>
          </Card.Header>
          <Card.Body>
            <Form>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Full name</Form.Label>
                    <Form.Control defaultValue={twinUserProfile.name} type="text" />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Email</Form.Label>
                    <Form.Control defaultValue={twinUserProfile.email} type="email" />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Role</Form.Label>
                    <Form.Control defaultValue={twinUserProfile.role} type="text" />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Organisation</Form.Label>
                    <Form.Control defaultValue={`${twinUserProfile.organization} / ${cityLabel}`} type="text" />
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Workspace note</Form.Label>
                    <Form.Control as="textarea" defaultValue={twinUserProfile.bio} rows={5} />
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <div className="d-flex flex-wrap gap-2">
                    <Button type="button" variant="primary">
                      Save profile changes
                    </Button>
                    <Button as={Link} href="/profile" type="button" variant="outline-light">
                      Back to profile
                    </Button>
                    <Button as={Link} href="/logout" type="button" variant="outline-danger">
                      <LogOut size={16} className="me-2" />
                      Log out
                    </Button>
                  </div>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>
        <Row className="g-3 mt-1">
          <Col xl={6}>
            <Card className="card-border h-100">
              <Card.Header>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Current identity</div>
                <h5 className="mb-0">Workspace context</h5>
              </Card.Header>
              <Card.Body className="dt-bullet-stack">
                <div className="dt-bullet"><strong>City.</strong> {cityLabel}</div>
                <div className="dt-bullet"><strong>Workspace.</strong> {workspaceLabel}</div>
                <div className="dt-bullet"><strong>Status.</strong> {twinUserProfile.status}</div>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={6}>
            <Card className="card-border h-100">
              <Card.Header>
                <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">Operational scope</div>
                <h5 className="mb-0">What this profile manages</h5>
              </Card.Header>
              <Card.Body className="dt-bullet-stack">
                <div className="dt-bullet"><MapPin size={14} className="me-2" />Current base twin for {cityLabel}.</div>
                <div className="dt-bullet"><Shield size={14} className="me-2" />Restricted admin tools and delivery review.</div>
                <div className="dt-bullet"><Settings size={14} className="me-2" />Theory, docs, and product posture.</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  )
}
