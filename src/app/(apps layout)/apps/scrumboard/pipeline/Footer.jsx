import { Button, Container } from 'react-bootstrap';

const Footer = () => {
    return (
        <div className="hk-fixed-footer">
            <Container>
                <div className="d-flex justify-content-center align-items-center h-80p">
                    <Button variant="danger" className="w-200p me-3">lost</Button>
                    <Button variant="primary" className="w-200p">win</Button>
                </div>
            </Container>
        </div>
    )
}

export default Footer
