'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button, Container, Dropdown, Form, InputGroup, Nav, Navbar } from 'react-bootstrap'
import {
  AlignLeft,
  BookOpen,
  FileText,
  Home,
  LogOut,
  Map,
  Search,
  Settings,
  Shield,
  User,
  UserCheck,
} from 'react-feather'
import SimpleBar from 'simplebar-react'
import { useGlobalStateContext } from '@/context/GolobalStateProvider'
import { ThemeSwitcher } from '../theme-provider/theme-switcher'
import { adminToolLinks } from '@/data/digital-twin/moduleConfig'
import { getTwinUserProfile } from '@/data/digital-twin/workspaceContent'
import { usePlatformContext } from '@/context/PlatformContext'
import HkBadge from '@/components/@hk-badge/@hk-badge'
import HkTooltip from '@/components/@hk-tooltip/HkTooltip'

const TopNav = () => {
  const { states, dispatch } = useGlobalStateContext()
  const { activeCity, currentUser } = usePlatformContext()
  const pathname = usePathname()
  const twinUserProfile = useMemo(() => getTwinUserProfile(activeCity, currentUser), [activeCity, currentUser])
  const [showSearch, setShowSearch] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const isAdmin = Boolean(currentUser?.roles?.includes('platform-admin'))

  const searchItems = [
    { href: '/cockpit', label: 'City twin workspace', icon: <Home size={14} /> },
    { href: '/analytical-map', label: 'Analytical map', icon: <Map size={14} /> },
    { href: '/city-3d', label: 'City 3D', icon: <Shield size={14} /> },
    { href: '/civic-xr', label: 'Civic XR', icon: <UserCheck size={14} /> },
    { href: '/theory', label: 'Theory and layers', icon: <BookOpen size={14} /> },
    { href: '/docs', label: 'Docs and references', icon: <FileText size={14} /> },
  ]

  const filteredItems = searchItems.filter((item) =>
    item.label.toLowerCase().includes(searchValue.trim().toLowerCase()),
  )

  const closeSearch = () => {
    setSearchValue('')
    setShowSearch(false)
  }

  const quickActions = [
    { href: '/cockpit', label: 'Workspace', icon: <Home size={16} />, badge: 'Live' },
    { href: '/analytical-map', label: 'Map', icon: <Map size={16} /> },
    { href: '/city-3d', label: '3D', icon: <Shield size={16} /> },
    { href: '/civic-xr', label: 'XR', icon: <UserCheck size={16} /> },
    { href: '/docs', label: 'Docs', icon: <FileText size={16} /> },
  ]

  return (
    <Navbar expand="xl" className="hk-navbar navbar-light fixed-top">
      <Container fluid>
        <div className="nav-start-wrap">
          <Button
            variant="flush-dark"
            onClick={() => dispatch({ type: 'sidebar_toggle', sidebarCollapse: !states.sidebarCollapse })}
            className="btn-icon btn-rounded flush-soft-hover navbar-toggle d-xl-none"
          >
            <span className="icon">
              <span className="feather-icon">
                <AlignLeft />
              </span>
            </span>
          </Button>

          <Dropdown
            as={Form}
            className="navbar-search"
            show={showSearch}
            autoClose="outside"
            onToggle={(nextShow) => setShowSearch(Boolean(nextShow))}
          >
            <Dropdown.Toggle as="div" className="no-caret bg-transparent">
              <Button
                variant="flush-dark"
                className="btn-icon btn-rounded flush-soft-hover d-xl-none"
                onClick={() => setShowSearch((current) => !current)}
              >
                <span className="icon">
                  <span className="feather-icon">
                    <Search />
                  </span>
                </span>
              </Button>

              <InputGroup className="d-xl-flex d-none">
                <span className="input-affix-wrapper input-search affix-border">
                  <Form.Control
                    type="text"
                    className="bg-transparent"
                    placeholder="Search workspace..."
                    aria-label="Search workspace"
                    value={searchValue}
                    onFocus={() => setShowSearch(true)}
                    onChange={(event) => setSearchValue(event.target.value)}
                  />
                  <span className="input-suffix" onClick={() => setSearchValue('')}>
                    <span>/</span>
                    <span className="btn-input-clear">
                      <i className="bi bi-x-circle-fill" />
                    </span>
                  </span>
                </span>
              </InputGroup>
            </Dropdown.Toggle>

            <Dropdown.Menu className="p-0">
              <Dropdown.Item className="d-xl-none bg-transparent">
                <InputGroup className="mobile-search">
                  <span className="input-affix-wrapper input-search">
                    <Form.Control
                      type="text"
                      placeholder="Search workspace..."
                      aria-label="Search workspace"
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      onFocus={() => setShowSearch(true)}
                      autoFocus
                    />
                    <span className="input-suffix" onClick={closeSearch}>
                      <span className="btn-input-clear">
                        <i className="bi bi-x-circle-fill" />
                      </span>
                    </span>
                  </span>
                </InputGroup>
              </Dropdown.Item>

              <SimpleBar className="dropdown-body p-2">
                <Dropdown.Header>Workspace navigation</Dropdown.Header>
                {filteredItems.map((item) => (
                  <Dropdown.Item as={Link} href={item.href} key={item.href} onClick={closeSearch}>
                    <div className="media align-items-center">
                      <div className="media-head me-2">
                        <div className="avatar avatar-icon avatar-xs avatar-soft-light avatar-rounded">
                          <span className="initial-wrap">{item.icon}</span>
                        </div>
                      </div>
                      <div className="media-body">{item.label}</div>
                    </div>
                  </Dropdown.Item>
                ))}
                {!filteredItems.length ? (
                  <Dropdown.Item className="bg-transparent text-muted">No matching workspace surface.</Dropdown.Item>
                ) : null}
              </SimpleBar>
            </Dropdown.Menu>
          </Dropdown>
        </div>

        <div className="nav-end-wrap">
          <Nav className="navbar-nav flex-row">
            <div className="dt-topnav-quick d-none d-md-flex">
              {quickActions.map((action) => {
                const isActive = pathname === action.href
                return (
                  <Nav.Item key={action.href}>
                    <HkTooltip placement="bottom" title={action.label}>
                      <Button
                        as={Link}
                        href={action.href}
                        variant="flush-dark"
                        className={`btn-icon btn-rounded flush-soft-hover dt-topnav-quick__btn${isActive ? ' active' : ''}`}
                      >
                        <span className="icon">
                          <span className="position-relative">
                            <span className="feather-icon">{action.icon}</span>
                            {action.badge ? (
                              <HkBadge
                                bg="success"
                                soft
                                pill
                                size="sm"
                                className="position-top-end-overflow-1 dt-topnav-quick__badge"
                              >
                                {action.badge}
                              </HkBadge>
                            ) : null}
                          </span>
                        </span>
                      </Button>
                    </HkTooltip>
                  </Nav.Item>
                )
              })}
            </div>
            <Nav.Item className="ms-2">
              <ThemeSwitcher />
            </Nav.Item>
            <Nav.Item>
              <Dropdown className="ps-2">
                <Dropdown.Toggle as={Link} href="#" className="no-caret">
                  <div className="avatar avatar-soft-primary avatar-xs avatar-rounded">
                    <span className="initial-wrap">
                      {twinUserProfile.shortName
                        .split(' ')
                        .map((chunk) => chunk[0])
                        .join('')
                        .slice(0, 2)}
                    </span>
                  </div>
                </Dropdown.Toggle>
                <Dropdown.Menu align="end">
                  <div className="p-2">
                    <div className="media">
                      <div className="media-head me-2">
                        <div className="avatar avatar-primary avatar-sm avatar-rounded">
                          <span className="initial-wrap">
                            {twinUserProfile.shortName
                              .split(' ')
                              .map((chunk) => chunk[0])
                              .join('')
                              .slice(0, 2)}
                          </span>
                        </div>
                      </div>
                      <div className="media-body">
                        <div className="d-block fw-medium text-dark">{twinUserProfile.shortName}</div>
                        <div className="fs-7">{twinUserProfile.role}</div>
                        <Link href="/logout" className="d-block fs-8 link-secondary">
                          <u>Sign Out</u>
                        </Link>
                      </div>
                    </div>
                  </div>
                  <Dropdown.Divider as="div" />
                  <Dropdown.Item as={Link} href="/profile">
                    <span className="dropdown-icon feather-icon">
                      <UserCheck />
                    </span>
                    <span>Profile</span>
                  </Dropdown.Item>
                  <Dropdown.Item as={Link} href="/profile/account">
                    <span className="dropdown-icon feather-icon">
                      <Settings />
                    </span>
                    <span>Account settings</span>
                  </Dropdown.Item>
                  <Dropdown.Item as={Link} href="/profile/edit-profile">
                    <span className="dropdown-icon feather-icon">
                      <User />
                    </span>
                    <span>Edit profile</span>
                  </Dropdown.Item>
                  {isAdmin ? (
                    <>
                      <Dropdown.Divider as="div" />
                      <h6 className="dropdown-header">Admin only</h6>
                      {adminToolLinks.map((tool) => (
                        <Dropdown.Item as={Link} href={tool.href} key={tool.href}>
                          <span className="dropdown-icon feather-icon">
                            <Shield />
                          </span>
                          <span>{tool.label}</span>
                        </Dropdown.Item>
                      ))}
                    </>
                  ) : null}
                  <Dropdown.Divider as="div" />
                  <Dropdown.Item as={Link} href="/logout">
                    <span className="dropdown-icon feather-icon">
                      <LogOut />
                    </span>
                    <span>Log out</span>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Nav.Item>
          </Nav>
        </div>
      </Container>
    </Navbar>
  )
}

export default TopNav
