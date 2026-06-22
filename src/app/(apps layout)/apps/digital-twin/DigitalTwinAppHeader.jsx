'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import classNames from 'classnames'
import { Button, Dropdown } from 'react-bootstrap'
import { BookOpen, ChevronDown, ChevronUp, Compass, FileText, Layers, MoreVertical, RefreshCw, Settings, Users } from 'react-feather'
import HkTooltip from '@/components/@hk-tooltip/HkTooltip'
import HkBadge from '@/components/@hk-badge/@hk-badge'
import { useGlobalStateContext } from '@/context/GolobalStateProvider'
import { getTwinModuleNav } from '@/data/digital-twin/cityTwinContent'

const iconMap = {
  cockpit: Compass,
  municipal: Layers,
  public: Users,
  theory: BookOpen,
  docs: FileText,
  admin: Settings,
}

const DigitalTwinAppHeader = ({ title, badge, toggleSidebar, show, canToggleSidebar = true }) => {
  const router = useRouter()
  const { states, dispatch } = useGlobalStateContext()
  const twinModuleNav = getTwinModuleNav()

  return (
    <header className="invoice-header">
      <div className="d-flex align-items-center">
        <Dropdown>
          <Dropdown.Toggle as="a" href="#" className="invoiceapp-title link-dark">
            <h1>{title}</h1>
          </Dropdown.Toggle>
          <Dropdown.Menu>
            {twinModuleNav.map((item) => {
              const key = item.href.split('/').pop()
              const Icon = iconMap[key] ?? Compass
              return (
                <Dropdown.Item as={Link} href={item.href} key={item.href}>
                  <span className="feather-icon dropdown-icon">
                    <Icon />
                  </span>
                  <span>{item.label}</span>
                </Dropdown.Item>
              )
            })}
          </Dropdown.Menu>
        </Dropdown>
        {badge ? <HkBadge bg="primary" soft className="ms-3 d-none d-md-inline-flex">{badge}</HkBadge> : null}
      </div>

      <div className="invoice-options-wrap">
        <Button variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret d-lg-inline-block d-none" onClick={() => router.refresh()}>
          <HkTooltip placement={states.layoutState.topNavCollapse ? 'bottom' : 'top'} title="Refresh surface">
            <span className="icon">
              <span className="feather-icon">
                <RefreshCw />
              </span>
            </span>
          </HkTooltip>
        </Button>
        <div className="v-separator d-lg-inline-block d-none" />
        <Button as={Link} href="/apps/digital-twin/docs" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover d-lg-inline-block d-none">
          <HkTooltip placement={states.layoutState.topNavCollapse ? 'bottom' : 'top'} title="Open docs">
            <span className="icon">
              <span className="feather-icon">
                <FileText />
              </span>
            </span>
          </HkTooltip>
        </Button>
        <Dropdown>
          <Dropdown.Toggle as="a" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret">
            <span className="icon">
              <span className="feather-icon">
                <MoreVertical />
              </span>
            </span>
          </Dropdown.Toggle>
          <Dropdown.Menu align="end">
            <Dropdown.Item as={Link} href="/cockpit">Go to Workspace</Dropdown.Item>
            <Dropdown.Item as={Link} href="/map">Go to Analytical Map</Dropdown.Item>
            <Dropdown.Item as={Link} href="/municipal">Go to City 3D</Dropdown.Item>
            <Dropdown.Item as={Link} href="/public">Go to Civic XR</Dropdown.Item>
            <div className="dropdown-divider" />
            <Dropdown.Item as={Link} href="/apps/digital-twin/theory">Theory</Dropdown.Item>
            <Dropdown.Item as={Link} href="/apps/digital-twin/docs">Docs</Dropdown.Item>
            <Dropdown.Item as={Link} href="/apps/digital-twin/admin">Admin</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
        <Button as="a" href="#" className="btn-icon btn-flush-dark btn-rounded flush-soft-hover hk-navbar-togglable d-sm-inline-block d-none" onClick={() => dispatch({ type: 'top_nav_toggle' })}>
          <HkTooltip placement={states.layoutState.topNavCollapse ? 'bottom' : 'top'} title="Collapse top bar">
            <span className="icon">
              <span className="feather-icon">
                {states.layoutState.topNavCollapse ? <ChevronDown /> : <ChevronUp />}
              </span>
            </span>
          </HkTooltip>
        </Button>
      </div>

      {canToggleSidebar ? (
        <div className={classNames('hk-sidebar-togglable', { active: !show })} onClick={toggleSidebar} />
      ) : null}
    </header>
  )
}

export default DigitalTwinAppHeader
