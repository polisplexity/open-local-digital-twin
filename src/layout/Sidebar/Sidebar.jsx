import React from 'react'
import { Nav } from 'react-bootstrap'
import SimpleBar from 'simplebar-react'
import SidebarHeader from './SidebarHeader'
import { SidebarMenu } from './SidebarMenu'
import classNames from 'classnames'
import Link from 'next/link'
import { useGlobalStateContext } from '@/context/GolobalStateProvider'
import { usePathname, useSearchParams } from 'next/navigation'

const Sidebar = () => {
  const { dispatch } = useGlobalStateContext()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname

  return (
    <>
      <div className="hk-menu">
        <SidebarHeader />
        <SimpleBar className="nicescroll-bar">
          <div className="menu-content-wrap">
            {SidebarMenu.map((routes, index) => (
              <React.Fragment key={index}>
                <div className="menu-group">
                  {routes.group ? (
                    <div className="nav-header">
                      <span>{routes.group}</span>
                    </div>
                  ) : null}
                  <Nav bsPrefix="navbar-nav" className="flex-column">
                    {routes.contents.map((menu) => {
                      const isActive = menu.path.includes('?') ? currentUrl === menu.path : pathname === menu.path
                      return (
                        <Nav.Item className={classNames({ active: isActive })} key={menu.path}>
                          <Link href={menu.path} className={classNames('nav-link', { active: isActive })}>
                            <span className="nav-icon-wrap">
                              <span className="svg-icon">{menu.icon}</span>
                            </span>
                            <span className="nav-link-text">{menu.name}</span>
                            {menu.badge}
                          </Link>
                        </Nav.Item>
                      )
                    })}
                  </Nav>
                </div>
                <div className="menu-gap" />
              </React.Fragment>
            ))}
          </div>
        </SimpleBar>
      </div>
      <div onClick={() => dispatch({ type: 'sidebar_toggle' })} className="hk-menu-backdrop" />
    </>
  )
}

export default Sidebar
