import SimpleBar from 'simplebar-react';
import { Col, Container, Row, Table } from 'react-bootstrap';
import Image from 'next/image';
import { useTheme } from '@/layout/theme-provider/theme-provider';

//Images
import jampackImg from '@/assets/img/Jampack.svg';
import jampackImgDark from '@/assets/img/jampack-dark.svg';
import logo from '@/assets/img/brand-sm.svg';

const Body = () => {
    const { theme } = useTheme();

    return (
        <div className="invoice-body">
            <SimpleBar className="nicescroll-bar">
                <Container>
                    <div className="template-invoice-wrap mt-xxl-5 p-md-5 p-3">
                        <Row>
                            <Col lg={3} md={5} className="order-md-0 order-1">
                                <Image src={logo} alt="logo" className='me-2' />
                                {theme === "light" ? <Image  src={jampackImg} alt="brand" /> : <Image  src={jampackImgDark} alt="brand" />}
                            </Col>
                            <Col lg={4} md={4} className="offset-lg-5 offset-md-3 mb-md-0 mb-2">
                                <h2 className="d-flex justify-content-md-end mb-0">Invoice</h2>
                            </Col>
                        </Row>
                        <Row className="mt-4">
                            <Col md={4} className="order-md-0 order-1">
                                <div className="address-wrap">
                                    <h6>Hencework</h6>
                                    <p>4747, Pearl Street</p>
                                    <p>Rainy day Drive</p>
                                    <p>Washington DC 42341</p>
                                    <p>jampack_01@hencework.com</p>
                                </div>
                            </Col>
                            <Col md={5} className="offset-md-3 mb-4 mb-md-0">
                                <div className="d-flex justify-content-md-end">
                                    <div className="text-md-end me-3">
                                        <div className="mb-1">Invoice No*</div>
                                        <div className="mb-1">Invoice Date*</div>
                                        <div className="mb-1">Due Date*</div>
                                        <div>Customer No</div>
                                    </div>
                                    <div className="text-dark">
                                        <div className="mb-1">0001</div>
                                        <div className="mb-1">24/08/2020</div>
                                        <div className="mb-1">Due on receipt</div>
                                        <div>321456</div>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                        <div className="separator separator-light" />
                        <Row>
                            <Col md={3}>
                                <h6 className="text-uppercase fs-7 mb-2">Billed To</h6>
                                <div className="Billto-wrap">
                                    <h6>Supernova consultant</h6>
                                    <p>4747, Pearl Street</p>
                                    <p>Rainy day Drive</p>
                                    <p>Washington DC 42341</p>
                                    <p>jampack_01@hencework.com</p>
                                </div>
                            </Col>
                        </Row>
                        <div className="table-wrap mt-6">
                            <Table bordered responsive>
                                <thead className="thead-primary">
                                    <tr>
                                        <th>Item</th>
                                        <th className="text-end">Quantity</th>
                                        <th className="text-end">Price</th>
                                        <th className="text-end">Discount</th>
                                        <th className="text-end">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="w-70">
                                            <h6>Redesiging of agencyclick.com</h6>
                                            <p>This is my project description. if the line do not filt like the sentence is to big the area will start getting bigger</p>
                                        </td>
                                        <td className="text-end text-dark">8</td>
                                        <td className="w-15 text-end text-dark">60.00</td>
                                        <td className="text-end text-dark">5%</td>
                                        <td className="w-20 text-end text-dark">$420.5</td>
                                    </tr>
                                    <tr>
                                        <td className="w-70">
                                            <h6>Re-branding</h6>
                                        </td>
                                        <td className="text-end text-dark">1</td>
                                        <td className="w-15 text-end text-dark">150.00</td>
                                        <td className="text-end text-dark">0%</td>
                                        <td className="w-20 text-end text-dark">$140.5</td>
                                    </tr>
                                    <tr>
                                        <td className="w-70">
                                            <h6>Social media marketing</h6>
                                        </td>
                                        <td className="text-end text-dark">20</td>
                                        <td className="w-15 text-end text-dark">30.00</td>
                                        <td className="text-end text-dark">5%</td>
                                        <td className="w-20 text-end text-dark">$540.5</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={2} rowSpan={4} className="border-0" />
                                        <td colSpan={2}>Subtotal</td>
                                        <td className="text-end text-dark">$1101.0</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={2}>Item Discount</td>
                                        <td className="text-end text-dark">$10.0</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={2}>Extra Discount</td>
                                        <td className="text-end text-dark">$0</td>
                                    </tr>
                                    <tr className="border-0">
                                        <td colSpan={2} className="text-dark border">Total</td>
                                        <td className="text-end text-dark border">$1101.0</td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>
                        <Row className="mt-3">
                            <Col lg={5}>
                                <h6>Note to client</h6>
                                <p>thank you for choosing Hencework for design services. If you need more assistance in future here is your discount coupon for future jobs. Just call us and mention the coupon code: &quot;10-springhnc&quot;</p>
                            </Col>
                            <Col lg={7} className="text-lg-end mt-lg-0 mt-3">
                                <h5 className="mt-lg-7">Katherine Zeta Jones</h5>
                                <p>Co-founder, Hencework</p>
                            </Col>
                        </Row>
                        <div className="separator separator-light mt-7" />
                        <Row>
                            <Col md={12} className="col-md-12">
                                <h6>Terms &amp; Conditions</h6>
                                <ol className="ps-3">
                                    <li>Please pay within 15 days from the date of invoice, overdue interest @ 14% will be charged on delayed payments.</li>
                                    <li>Please quote invoice number when remitting funds.</li>
                                </ol>
                            </Col>
                        </Row>
                    </div>
                </Container>
            </SimpleBar>
        </div>
    )
}

export default Body
