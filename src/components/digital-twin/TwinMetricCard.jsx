import { Card } from 'react-bootstrap'

const TwinMetricCard = ({ label, value, note }) => {
  return (
    <Card className="card-border h-100">
      <Card.Body>
        <div className="text-uppercase fs-8 fw-semibold text-primary letter-spacing-3 mb-2">{label}</div>
        <h3 className="mb-2">{value}</h3>
        <p className="mb-0">{note}</p>
      </Card.Body>
    </Card>
  )
}

export default TwinMetricCard
