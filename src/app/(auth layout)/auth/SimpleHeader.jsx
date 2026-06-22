import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Button, Container, Nav, Navbar } from 'react-bootstrap';
import { HelpCircle } from 'react-feather';
import { usePlatformContext } from '@/context/PlatformContext'
import { getCityDisplayName, getLoginTitle } from '@/data/digital-twin/platformBrand'

import brandMark from '@/assets/img/brand-sm.svg';

const SimpleHeader = () => {
    const { activeCity, brandName, workspaceName } = usePlatformContext()

    const pathname = usePathname();
    const loginPath = pathname.match("/auth/login/simple");
    const signupPath = pathname.match("/auth/signup/simple");

    return (
        <Navbar expand="xl" className="hk-navbar navbar-light fixed-top">
            <Container>
                {/* Start Nav */}
                <div className="nav-start-wrap">
                    <Navbar.Brand as={Link} href="/" >
                        <span className="d-inline-flex align-items-center gap-3">
                            <Image className="brand-img d-inline-block" src={brandMark} alt={workspaceName} />
                            <span className="d-inline-flex flex-column lh-sm">
                                <small className="text-uppercase text-primary fw-semibold">{brandName} / {getCityDisplayName(activeCity)}</small>
                                <strong>{workspaceName}</strong>
                                <span className="text-muted">{getLoginTitle(activeCity)}</span>
                            </span>
                        </span>
                    </Navbar.Brand>
                </div>

                {/* End Nav */}
                <div className="nav-end-wrap">
                    <Nav as="ul" className="flex-row">
                        {loginPath && <Nav.Item as="li" className="nav-link py-0">
                            <Button size='sm' variant="outline-light" >
                                <span>
                                    <span className="icon">
                                        <span className="feather-icon">
                                            <HelpCircle />
                                        </span>
                                    </span>
                                    <span>Platform help</span>
                                </span>
                            </Button>
                        </Nav.Item>}
                        {signupPath && <>
                            <Nav.Item as="li" className="nav-link py-0">
                                <Button variant="primary" as="a" href="#">Help</Button>
                            </Nav.Item>
                            <Nav.Item as="li" className="nav-link py-0">
                                <Button variant="outline-light" as={Link} href="/auth/login">Sign In</Button>
                            </Nav.Item>
                        </>}
                    </Nav>
                </div>
                {/* /End Nav */}
            </Container>
        </Navbar>
    )
}

export default SimpleHeader
