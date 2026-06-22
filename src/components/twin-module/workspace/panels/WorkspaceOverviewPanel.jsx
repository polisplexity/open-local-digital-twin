import { CheckCircle } from 'react-feather'
import { ReadinessList } from '../WorkspacePanelPrimitives'

export default function WorkspaceOverviewPanel({
  checksByCategory,
  moduleRows,
  readyModules,
}) {
  return (
    <section className="ldt-module-panel">
      <div className="ldt-module-panel__header">
        <h2>City workspace overview</h2>
        <p>{readyModules} of {moduleRows.length} modules are active for this city.</p>
      </div>
      <div className="ldt-module-grid">
        {moduleRows.map(({ key, label, available, Icon }) => (
          <article className={available ? 'ldt-module-tile is-ready' : 'ldt-module-tile'} key={key}>
            <Icon size={18} />
            <div>
              <strong>{label}</strong>
              <span>{available ? 'Live' : 'Pending'}</span>
            </div>
            {available ? <CheckCircle size={16} /> : null}
          </article>
        ))}
      </div>
      <ReadinessList category="product" checksByCategory={checksByCategory} />
      <ReadinessList category="ui" checksByCategory={checksByCategory} />
    </section>
  )
}
