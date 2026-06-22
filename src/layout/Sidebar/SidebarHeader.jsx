import { ArrowBarToLeft } from 'tabler-icons-react'
import { Button } from 'react-bootstrap'
import Link from 'next/link'
import Image from 'next/image'
import { useGlobalStateContext } from '@/context/GolobalStateProvider'
import { usePlatformContext } from '@/context/PlatformContext'
import { getCityDisplayName, getCityWorkspaceLabel, getWorkspaceSubline } from '@/data/digital-twin/platformBrand'
import logo from '@/assets/img/brand-sm.svg'

const SidebarHeader = () => {
  const { dispatch } = useGlobalStateContext()
  const { activeCity, brandName, workspaceName } = usePlatformContext()

  return (
    <div className="menu-header">
      <span>
        <Link className="navbar-brand dt-brand-lockup" href="/cockpit">
          <Image className="brand-img img-fluid" src={logo} alt="Twin Base Studio" />
          <span className="dt-brand-copy">
            <small>{brandName} / {getCityDisplayName(activeCity)}</small>
            <strong>{workspaceName || getCityWorkspaceLabel(activeCity)}</strong>
            <span>{getWorkspaceSubline(activeCity)}</span>
          </span>
        </Link>
        <Button
          variant="flush-dark"
          onClick={() => dispatch({ type: 'sidebar_toggle' })}
          className="btn-icon btn-rounded flush-soft-hover navbar-toggle"
        >
          <span className="icon">
            <span className="svg-icon fs-5">
              <ArrowBarToLeft />
            </span>
          </span>
        </Button>
      </span>
    </div>
  )
}

export default SidebarHeader
