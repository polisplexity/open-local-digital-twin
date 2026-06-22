import Link from 'next/link'
import { cityModuleTabs, workspaceDomainGroups } from './ldtWorkspaceModel'

const WorkspaceModuleNav = ({ activeTab }) => (
  <nav className="ldt-module-nav ldt-module-nav--grouped" aria-label="City twin workspace modules">
    {workspaceDomainGroups.map((group) => {
      const tabs = cityModuleTabs.filter((tab) => tab.domain === group.key)
      return (
        <div className="ldt-module-nav__group" key={group.key}>
          <div className="ldt-module-nav__group-label">
            <strong>{group.label}</strong>
            <span>{group.summary}</span>
          </div>
          <div className="ldt-module-nav__links">
            {tabs.map((tab) => (
              <Link
                className={tab.key === activeTab ? 'is-active' : ''}
                href={tab.key === 'overview' ? '/cockpit' : `/cockpit?module=${tab.key}`}
                key={tab.key}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      )
    })}
  </nav>
)

export default WorkspaceModuleNav
