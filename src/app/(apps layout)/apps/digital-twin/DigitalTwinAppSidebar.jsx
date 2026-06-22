'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button, Dropdown, Nav } from 'react-bootstrap'
import SimpleBar from 'simplebar-react'
import { Activity, BookOpen, Compass, FileText, Layers, LifeBuoy, Map, Settings, Users } from 'react-feather'
import HkTooltip from '@/components/@hk-tooltip/HkTooltip'
import { getTwinModuleNav, getTwinOverviewData } from '@/data/digital-twin/cityTwinContent'
import { usePlatformContext } from '@/context/PlatformContext'

const iconMap = {
  cockpit: Compass,
  map: Map,
  municipal: Layers,
  public: Users,
  capabilities: Activity,
  theory: BookOpen,
  docs: FileText,
  admin: Settings,
}

const DigitalTwinAppSidebar = ({ sections = [], controlSidebar = null }) => {
  const pathname = usePathname()
  const { activeCity } = usePlatformContext()
  const twinModuleNav = getTwinModuleNav()
  const twinOverview = getTwinOverviewData(activeCity)

  if (controlSidebar) {
    return (
      <nav className="invoiceapp-sidebar dt-control-sidebar">
        <SimpleBar className="nicescroll-bar">
          <div className="menu-content-wrap dt-control-content">
            {controlSidebar}
          </div>
        </SimpleBar>

        <div className="invoiceapp-fixednav">
          <div className="hk-toolbar">
            <Nav as="ul" className="nav-light">
              <Nav.Item className="nav-link">
                <Button as={Link} href="/apps/digital-twin/theory" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                  <HkTooltip id="dt-theory" placement="top" title="Theory">
                    <span className="icon">
                      <span className="feather-icon">
                        <BookOpen />
                      </span>
                    </span>
                  </HkTooltip>
                </Button>
              </Nav.Item>
              <Nav.Item className="nav-link">
                <Button as={Link} href="/apps/digital-twin/docs" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                  <HkTooltip id="dt-docs" placement="top" title="Docs">
                    <span className="icon">
                      <span className="feather-icon">
                        <FileText />
                      </span>
                    </span>
                  </HkTooltip>
                </Button>
              </Nav.Item>
              <Nav.Item className="nav-link">
                <Button as={Link} href="/apps/digital-twin/admin" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                  <HkTooltip id="dt-admin" placement="top" title="Admin">
                    <span className="icon">
                      <span className="feather-icon">
                        <Settings />
                      </span>
                    </span>
                  </HkTooltip>
                </Button>
              </Nav.Item>
            </Nav>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="invoiceapp-sidebar">
      <SimpleBar className="nicescroll-bar">
        <div className="menu-content-wrap">
          <Dropdown>
            <Dropdown.Toggle variant="primary" className="btn-rounded btn-block mb-4">
              Switch surface
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {twinModuleNav.map((item) => (
                <Dropdown.Item as={Link} href={item.href} key={item.href}>
                  {item.label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>

          <div className="nav-header">
            <span>Workspace</span>
          </div>
          <div className="menu-group">
            <Nav as="ul" className="nav-light navbar-nav flex-column">
              {twinModuleNav.map((item) => {
                const key = item.href.split('/').pop()
                const Icon = iconMap[key] ?? Compass
                return (
                  <Nav.Item as="li" key={item.href}>
                    <Nav.Link as={Link} href={item.href} active={pathname === item.href}>
                      <span className="nav-icon-wrap">
                        <span className="feather-icon">
                          <Icon size={16} />
                        </span>
                      </span>
                      <span className="nav-link-text">{item.label}</span>
                    </Nav.Link>
                  </Nav.Item>
                )
              })}
            </Nav>
          </div>

          <div className="menu-gap" />
          <div className="nav-header">
            <span>Inside this surface</span>
          </div>
          <div className="menu-group">
            <Nav as="ul" className="nav-light navbar-nav flex-column">
              {sections.map((section) => (
                <Nav.Item as="li" key={section.id}>
                  <Nav.Link href={`#${section.id}`}>
                    <span className="nav-link-text">{section.label}</span>
                  </Nav.Link>
                </Nav.Item>
              ))}
            </Nav>
          </div>

          <div className="menu-gap" />
          <div className="nav-header">
            <span>City context</span>
          </div>
          <div className="dt-side-note">
            <div className="fw-semibold mb-1">{twinOverview.city}, {twinOverview.country}</div>
            <p className="mb-0">{twinOverview.tagline}</p>
          </div>
        </div>
      </SimpleBar>

      <div className="invoiceapp-fixednav">
        <div className="hk-toolbar">
          <Nav as="ul" className="nav-light">
            <Nav.Item className="nav-link">
              <Button as={Link} href="/apps/digital-twin/theory" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                <HkTooltip id="dt-theory" placement="top" title="Theory">
                  <span className="icon">
                    <span className="feather-icon">
                      <BookOpen />
                    </span>
                  </span>
                </HkTooltip>
              </Button>
            </Nav.Item>
            <Nav.Item className="nav-link">
              <Button as={Link} href="/apps/digital-twin/docs" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                <HkTooltip id="dt-docs" placement="top" title="Docs">
                  <span className="icon">
                    <span className="feather-icon">
                      <FileText />
                    </span>
                  </span>
                </HkTooltip>
              </Button>
            </Nav.Item>
            <Nav.Item className="nav-link">
              <Button as={Link} href="/apps/digital-twin/admin" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                <HkTooltip id="dt-admin" placement="top" title="Admin">
                  <span className="icon">
                    <span className="feather-icon">
                      <Settings />
                    </span>
                  </span>
                </HkTooltip>
              </Button>
            </Nav.Item>
            <Nav.Item className="nav-link">
              <Button as={Link} href="/dashboard" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover">
                <HkTooltip id="dt-dashboard" placement="top" title="Jampack dashboard">
                  <span className="icon">
                    <span className="feather-icon">
                      <LifeBuoy />
                    </span>
                  </span>
                </HkTooltip>
              </Button>
            </Nav.Item>
          </Nav>
        </div>
      </div>
    </nav>
  )
}

export default DigitalTwinAppSidebar
