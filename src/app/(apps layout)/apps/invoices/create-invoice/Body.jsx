import { useEffect, useState } from 'react';
import { Button, Col, Collapse, Container, Form, Row, Table } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';
import EditInfo from './EditInfo';
import AddNewClient from './AddNewClient';
import { nanoid } from 'nanoid';
import HkInlineEdit from '@/components/@hk-editable-component/HkInlineEdit';
import HkDropZone from '@/components/@hk-drop-zone/HkDropZone';
import HkSimpleCollapse from '@/components/@hk-collapse/@hk-simple-collapse';

const Body = () => {
    const [editInfo, setEditInfo] = useState(false);
    const [addNewClient, setAddNewClient] = useState(false);
    const [subTotal, setSubTotal] = useState(0);
    const [totalDiscount, setTotalDiscount] = useState(0);
    const [extraDiscount, setExtraDiscount] = useState({ discValue: 0, discType: "per" });
    const [grossTotal, setGrossTotal] = useState(0);

    const [itemList, setItemList] = useState([
        {
            id: 0,
            title: "Redesiging of agencyclick.com",
            quantity: 1,
            price: 150,
            discount: 2,
            discountType: "per",
            totalPrice: 147,
            description: "This is my project description. if the line do not filt like the sentence is to big the area will start getting bigger"
        },

    ])

    const [termAndConditions, setTermAndConditions] = useState([
        {
            id: 0,
            conditon: "Please pay within 15 days from the date of invoice, overdue interest @ 14% will be charged on delayed payments.",
        },
        {
            id: 1,
            conditon: "Please quote invoice number when remitting funds.",
        },
    ])

    //add new itemList
    const addItem = (event) => {
        event.preventDefault();
        const newItem = {
            id: nanoid(),
            title: "",
            quantity: 0,
            price: 0,
            discount: 0,
            discountType: "per",
            totalPrice: 0,
            description: ""
        }

        setItemList([...itemList, newItem])
    }


    //update itemList onChange of input field
    const updateItemList = index => e => {
        let newArr = [...itemList]

        if (e.target.name === "title") {
            newArr[index].title = e.target.value
        }
        else if (e.target.name === "quantity") {
            newArr[index].quantity = e.target.value
        }
        else if (e.target.name === "price") {
            newArr[index].price = e.target.value
        }
        else if (e.target.name === "discount") {
            newArr[index].discount = e.target.value
            // console.log("value:" + typeof e.target.value);

        }
        else if (e.target.name === "discountType") {
            newArr[index].discountType = e.target.value
        }
        else if (e.target.name === "description") {
            newArr[index].description = e.target.value
        };

        //set new data in itemList
        setItemList(newArr);

        //Count totalPrice
        if (newArr[index].discountType === "per") {
            let disc = itemList[index].price - (itemList[index].price * itemList[index].discount / 100);
            newArr[index].totalPrice = newArr[index].quantity * disc;
        }
        else {
            let disc = itemList[index].price - itemList[index].discount
            newArr[index].totalPrice = newArr[index].quantity * disc;
        }
    }

    //Delete Invoice item
    const deleteItem = (itemId) => {
        const newList = [...itemList];
        const index = itemList.findIndex((item) => item.id === itemId);
        newList.splice(index, 1);
        setItemList(newList);
    }

    //Calculate gross total
    useEffect(() => {
        const CountSubtotal = itemList.reduce((ttl, datas) => ttl = ttl + datas.totalPrice, 0);
        setSubTotal((CountSubtotal))
        const disct = itemList.reduce((ttl, datas) => ttl = ttl + parseInt(datas.discount), 0);
        setTotalDiscount(disct);

        if (extraDiscount.discType === "per") {
            setGrossTotal(subTotal - (subTotal * extraDiscount.discValue / 100));
        }
        else {
            setGrossTotal(subTotal - extraDiscount.discValue);
        }

    }, [itemList, subTotal, extraDiscount])

    //update T&C
    const updateTC = index => e => {
        let updatedArr = [...termAndConditions]
        updatedArr[index] = e.target.value;
        setTermAndConditions(updatedArr);
    }
    // Add New T&C
    const addNewConditon = (event) => {
        event.preventDefault();
        const newCondition = {
            id: nanoid(),
            conditon: ""
        }
        setTermAndConditions([...termAndConditions, newCondition])
    }

    //Delete T&C
    const deleteCondition = (itemId) => {
        let newConditions = [...termAndConditions];
        let index = termAndConditions.findIndex((item) => item.id === itemId);
        newConditions.splice(index, 1);
        setTermAndConditions(newConditions);
    }


    return (
        <>
            <div className="invoice-body">
                <SimpleBar className="nicescroll-bar">
                    <Container>
                        <div className="create-invoice-wrap mt-xxl-5 p-md-5 p-3">
                            <Row>
                                <Col lg={3} md={5} className="order-md-0 order-1">
                                    <HkDropZone>
                                        Upload Logo
                                    </HkDropZone>
                                </Col>
                                <Col lg={4} md={4} className="offset-lg-5 offset-md-3 mb-md-0 mb-4">
                                    <span className="d-flex align-items-center justify-content-md-end mb-0 inline-editable-wrap">
                                        <HkInlineEdit as="h2" id="editable1" value="Invoice" left />
                                    </span>

                                </Col>
                            </Row>
                            <Row className="mt-5">
                                <Col xxl={3}>
                                    <HkSimpleCollapse
                                        bsPrefix="a"
                                        href="#"
                                        targetId="address_collpase"
                                        collapsed={false}
                                        title="- Your business information"
                                        headerClass="d-inline-block mb-3"
                                    >
                                        <div id="address_collpase">
                                            <div className="address-wrap">
                                                <h6>Hencework</h6>
                                                <p>4747, Pearl Street</p>
                                                <p>Rainy Day Drive, </p>
                                                <p>Washington DC 42156</p>
                                                <p>jampack_01@hencework.com</p>
                                            </div>
                                            <a href="#" className="d-inline-flex align-items-center mt-2" onClick={() => setEditInfo(!editInfo)} >
                                                <i className="ri-pencil-line me-1" /> Edit Info
                                            </a>
                                        </div>
                                    </HkSimpleCollapse>
                                </Col>
                                <Col xxl={4} className="offset-xxl-5 mt-xxl-0 mt-6">
                                    <Form>
                                        <Row className="gx-3">
                                            <Col lg={6} as={Form.Group} className="mb-3" >
                                                <Form.Control defaultValue="Invoice No*" type="text" />
                                            </Col>
                                            <Col lg={6} as={Form.Group} className="mb-3" >
                                                <Form.Control defaultValue="0001" type="text" />
                                            </Col>
                                        </Row>
                                        <Row className="gx-3">
                                            <Col lg={6} as={Form.Group} className="mb-3" >
                                                <Form.Control defaultValue="Invoice Date*" type="text" />
                                            </Col>
                                            <Col lg={6} as={Form.Group} className="mb-3" >
                                                <Form.Control name="single-date-pick" defaultValue="24/2/2020" type="text" />
                                            </Col>
                                        </Row>
                                        <Row className="gx-3">
                                            <Col lg={6} as={Form.Group} className="mb-3" >
                                                <Form.Control defaultValue="Due date*" type="text" />
                                            </Col>
                                            <Col lg={6} as={Form.Group} className="mb-3" >
                                                <Form.Select>
                                                    <option value={0}>Due on Reciept</option>
                                                    <option value={1}>One</option>
                                                    <option value={2}>Two</option>
                                                    <option value={3}>Three</option>
                                                </Form.Select>
                                            </Col>
                                        </Row>
                                        <Row className="gx-3">
                                            <Col lg={6} as={Form.Group} className="mb-3" >
                                                <Form.Control defaultValue="Customer No" type="text" />
                                            </Col>
                                            <Col lg={6} as={Form.Group} className="mb-3" >
                                                <Form.Control defaultValue={32321} type="text" />
                                            </Col>
                                        </Row>
                                        <div className="repeater">
                                            <div data-repeater-list="category-group">
                                                <Row className="gx-3" data-repeater-item style={{ display: 'none' }}>
                                                    <Col lg={6} as={Form.Group} className="mb-3" >
                                                        <Form.Control placeholder="Label" type="text" />
                                                    </Col>
                                                    <Col lg={6} as={Form.Group} className="mb-3" >
                                                        <Form.Control placeholder="Value" type="text" />
                                                    </Col>
                                                </Row>
                                            </div>
                                            <a data-repeater-create className="d-inline-flex align-items-center" href="#">
                                                <i className="ri-add-box-line me-1" /> Add more fields
                                            </a>
                                        </div>
                                    </Form>
                                </Col>
                            </Row>
                            <div className="separator separator-light" />
                            <Row>
                                <Col xxl={3} className="mb-xxl-0 mb-4">
                                    <h6>Billed To</h6>
                                    <Form>
                                        <Form.Group className="mb-3" >
                                            <Form.Select>
                                                <option value={0}>Supernova consultant</option>
                                                <option value={1}>One</option>
                                                <option value={2}>Two</option>
                                                <option value={3}>Three</option>
                                            </Form.Select>
                                        </Form.Group>
                                        <a href="#" className="d-inline-flex align-items-center" onClick={() => setAddNewClient(!addNewClient)} >
                                            <i className="ri-add-box-line me-1" /> Add new client
                                        </a>
                                    </Form>
                                    <div className="Billto-wrap mt-4">
                                        <h6>Supernova consultant</h6>
                                        <p>Sycamore Street</p>
                                        <p>San Antonio Valley,</p>
                                        <p>CA 34668</p>
                                        <p>thompson_peter@super.co</p>
                                    </div>
                                    <a className="d-inline-flex align-items-center mt-2" data-bs-toggle="modal" data-bs-target="#billed_info" href="#some">
                                        <i className="ri-pencil-line me-1" /> Edit Info
                                    </a>
                                </Col>
                                <Col xxl={4} className="offset-xxl-5">
                                    <h6>Ship To</h6>
                                    <div className="repeater">
                                        <HkSimpleCollapse
                                            bsPrefix="a"
                                            href="#"
                                            targetId="shipto_collpase"
                                            collapsed={true}
                                            title={<><i className="ri-add-box-line me-1" /> Add shipping address</>}
                                            headerClass="d-inline-flex align-items-center"
                                        >
                                            <div id="shipto_collpase">
                                                <Row className="gx-3">
                                                    <div className="col-sm-12 form-group">
                                                        <Form.Control placeholder="Client business name" type="text" />
                                                    </div>
                                                    <div className="col-sm-12 form-group">
                                                        <Form.Control placeholder="Address" type="text" />
                                                    </div>
                                                    <Col lg={6} as={Form.Group} className="mb-3" >
                                                        <Form.Control placeholder="City" type="text" />
                                                    </Col>
                                                    <Col lg={6} as={Form.Group} className="mb-3" >
                                                        <Form.Control placeholder="Postal Code" type="text" />
                                                    </Col>
                                                    <div className="col-sm-12 form-group">
                                                        <Form.Control placeholder="State" type="text" />
                                                    </div>
                                                    <div className="col-sm-12 form-group">
                                                        <Form.Control placeholder="Country" type="text" />
                                                    </div>
                                                    <div className="col-sm-12 form-group">
                                                        <Form.Control placeholder="GSTIN Enter GSTIN here(optional)" type="text" />
                                                    </div>
                                                </Row>
                                            </div>
                                        </HkSimpleCollapse>
                                    </div>
                                </Col>
                            </Row>
                            <Row className="mt-5">
                                <Col sm>
                                    <form className="form-inline p-3 bg-grey-light-5 rounded">
                                        <div className="row gx-3 align-items-center">
                                            <div className="col-xl-auto mb-xl-0 mb-2">
                                                <label className="form-label mb-xl-0">Filters</label>
                                            </div>
                                            <div className="col-xl-auto mb-xl-0 mb-2">
                                                <select className="form-select">
                                                    <option value={0}>Number format</option>
                                                    <option value={1}>One</option>
                                                    <option value={2}>Two</option>
                                                    <option value={3}>Three</option>
                                                </select>
                                            </div>
                                            <div className="col-xl-auto mb-xl-0 mb-2">
                                                <select className="form-select">
                                                    <option value={0}>Add/Remove columns</option>
                                                    <option value={1}>One</option>
                                                    <option value={2}>Two</option>
                                                    <option value={3}>Three</option>
                                                </select>
                                            </div>
                                            <div className="col-xl-auto">
                                                <select className="form-select">
                                                    <option value={0}>US Dollar ($ USD)</option>
                                                    <option value={1}>One</option>
                                                    <option value={2}>Two</option>
                                                    <option value={3}>Three</option>
                                                </select>
                                            </div>
                                        </div>
                                    </form>
                                </Col>
                            </Row>
                            <div className="table-wrap mt-5">
                                <div className="invoice-table-wrap">
                                    {itemList.map((items, index) => (
                                        <Table bordered className="invoice-table" key={index}>
                                            <thead className="thead-primary">
                                                <tr>
                                                    <th>Item</th>
                                                    <th>Quantity</th>
                                                    <th>Price</th>
                                                    <th colSpan={2}>Discount</th>
                                                    <th>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="table-row-gap"><td /></tr>
                                                <tr>
                                                    <td className="w-70 rounded-top-start border-end-0 border-bottom-0">
                                                        <Form.Control type="text" name="title" value={items.title} onChange={updateItemList(index)} />
                                                    </td>
                                                    <td className="border-end-0 border-bottom-0">
                                                        <Form.Control type="text" name="quantity" className="qty" value={items.quantity} onChange={updateItemList(index)} />
                                                    </td>
                                                    <td className="w-15 border-end-0 border-bottom-0">
                                                        <Form.Control type="text" name="price" className="price" value={items.price} onChange={updateItemList(index)} />
                                                    </td>
                                                    <td className="border-end-0 border-bottom-0">
                                                        <Form.Control type="text" name="discount" className="discount w-60p" value={items.discount} onChange={updateItemList(index)} />
                                                    </td>
                                                    <td className="border-end-0 border-bottom-0">
                                                        <Form.Select name="discountType" value={items.discountType} onChange={updateItemList(index)} className="disc-type w-70p">
                                                            <option value="per">%</option>
                                                            <option value="cur">₹</option>
                                                        </Form.Select>
                                                    </td>
                                                    <td className="w-20  rounded-end  bg-primary-light-5 close-over position-relative" rowSpan={2}><Form.Control type="text" className="bg-transparent border-0 p-0 total" value={items.totalPrice} readOnly />
                                                        <Button bsPrefix="btn-close" className="close-row" onClick={() => deleteItem(items.id)} >
                                                            <span aria-hidden="true">×</span>
                                                        </Button></td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={5} className="rounded-bottom-start border-end-0">
                                                        <Form.Control type="text" name="description" value={items.description} onChange={updateItemList(index)} />
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </Table>
                                    ))}
                                    <a className="d-inline-flex align-items-center add-new-row" href="#" onClick={addItem} >
                                        <i className="ri-add-box-line me-1" /> Add new item
                                    </a>
                                </div>
                            </div>
                            <Row className="justify-content-end">
                                <Col xxl={6} className="mt-5">
                                    <div className="table-wrap">
                                        <Table responsive bordered className="subtotal-table">
                                            <tbody>
                                                <tr>
                                                    <td colSpan={3} className="rounded-top-start border-end-0 border-bottom-0">Subtotal</td>
                                                    <td className="rounded-top-end border-bottom-0 w-30 bg-primary-light-5">
                                                        <Form.Control type="text" className="bg-transparent border-0 p-0 gross-total" value={subTotal} readOnly />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={3} className="border-end-0 border-bottom-0">Item Discount</td>
                                                    <td className="border-bottom-0  bg-primary-light-5">
                                                        <Form.Control type="text" className="bg-transparent border-0 p-0 gross-discount" value={totalDiscount} readOnly />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="border-end-0 border-bottom-0">Extra Discount</td>
                                                    <td className="border-end-0 border-bottom-0 w-25">
                                                        <Form.Control type="text" className="extdiscount" name="discValue" value={extraDiscount.discValue} onChange={e => setExtraDiscount({ ...extraDiscount, [e.target.name]: e.target.value })} />
                                                    </td>
                                                    <td className="border-end-0 border-bottom-0 w-25">
                                                        <Form.Select className="form-select extra-disc-type" name="discType" value={extraDiscount.discType} onChange={e => setExtraDiscount({ ...extraDiscount, [e.target.name]: e.target.value })} >
                                                            <option value="per">%</option>
                                                            <option value="cur">₹</option>
                                                        </Form.Select>
                                                    </td>
                                                    <td className="border-bottom-0  bg-primary-light-5">
                                                        <Form.Control type="text" className="bg-transparent border-0 p-0 extdiscount-read" value={extraDiscount.discValue} readOnly />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={3} className="rounded-bottom-start border-end-0 bg-primary-light-5">
                                                        <span className="text-dark">Total</span>
                                                    </td>
                                                    <td className="rounded-bottom-end  bg-primary-light-5">
                                                        <Form.Control type="text" className="bg-transparent border-0 p-0 totalPrice" value={grossTotal} readOnly />
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </Table>
                                    </div>
                                </Col>
                            </Row>
                            <Row className="mt-4">
                                <Col xxl={5} className="order-2 order-xxl-0">
                                    <Form.Group>
                                        <div className="form-label-group">
                                            <Form.Label>Note to client</Form.Label>
                                            <small className="text-muted">1400</small>
                                        </div>
                                        <Form.Control as="textarea" rows={6} placeholder="Write an internal note" defaultValue={""} />
                                        <Button variant="outline-light" className="mt-2">Add Note</Button>
                                    </Form.Group>
                                </Col>
                                <Col xxl={4} className="offset-xxl-3 text-xxl-end mb-xxl-0 mb-3">
                                    <div className="btn btn-light btn-link text-primary btn-file bg-transparent p-0 border-0">
                                        <span className="d-inline-flex align-items-center">
                                            <i className="ri-add-box-line me-1" /> Add signature (Optional)
                                            <input type="file" className="upload" />
                                        </span>
                                    </div>
                                    <HkSimpleCollapse
                                        bsPrefix="a"
                                        href="#"
                                        targetId="label_collpase"
                                        collapsed={false}
                                        title={<><i className="ri-add-box-line me-1" /> Add Name &amp; Label</>}
                                        headerClass="d-inline-flex align-items-center mt-2"
                                    >
                                        <div className="mt-5" id="label_collpase">
                                            <Form.Group className="form-group close-over">
                                                <Form.Control type="text" className="form-control" defaultValue="Katherine Zeta Jones" />
                                                <Button bsPrefix="btn-close" className="close-input">
                                                    <span aria-hidden="true">×</span>
                                                </Button>
                                            </Form.Group>
                                            <Form.Group className="form-group close-over">
                                                <Form.Control type="text" className="form-control" defaultValue="Co-founder Hencework" />
                                                <Button bsPrefix="btn-close" className="close-input">
                                                    <span aria-hidden="true">×</span>
                                                </Button>
                                            </Form.Group>
                                        </div>
                                    </HkSimpleCollapse>
                                    {/* <div>
                                        <a className="d-inline-flex align-items-center mt-2" data-bs-toggle="collapse" href="#label_collpase">
                                            <i className="ri-add-box-line me-1" /> Add Name &amp; Label
                                        </a>
                                    </div>
                                    <div className="collapse show mt-5" id="label_collpase">
                                        <Form.Group className="form-group close-over">
                                            <Form.Control type="text" className="form-control" defaultValue="Katherine Zeta Jones" />
                                            <Button bsPrefix="btn-close" className="close-input">
                                                <span aria-hidden="true">×</span>
                                            </Button>
                                        </Form.Group>
                                        <Form.Group className="form-group close-over">
                                            <Form.Control type="text" className="form-control" defaultValue="Co-founder Hencework" />
                                            <Button bsPrefix="btn-close" className="close-input">
                                                <span aria-hidden="true">×</span>
                                            </Button>
                                        </Form.Group>
                                    </div> */}
                                </Col>
                            </Row>
                            <div className="separator separator-light" />
                            <h6 className="mb-4">Terms &amp; Condition</h6>
                            <div className="repeater">
                                <ol className="ps-3" data-repeater-list="category-group">
                                    {
                                        termAndConditions.map((datas, index) => (
                                            <li className="form-group close-over" key={index} >
                                                <Form.Control type="text" name="conditon" value={datas.conditon} onChange={updateTC(index)} />
                                                <Button bsPrefix="btn-close" className="close-input" onClick={() => deleteCondition(datas.id)} >
                                                    <span aria-hidden="true">×</span>
                                                </Button>
                                            </li>
                                        ))
                                    }

                                </ol>
                                <a href="#" className="d-inline-flex align-items-center" onClick={addNewConditon}>
                                    <i className="ri-add-box-line me-1" /> Add New Term Row
                                </a>
                            </div>
                            <div className="separator separator-light" />
                            <div className="btn btn-light btn-file mb-4">
                                Attach files
                                <Form.Control type="file" className="upload" />
                            </div>

                            <HkSimpleCollapse
                                bsPrefix="a"
                                href="#"
                                targetId="memo_collpase"
                                collapsed={false}
                                title={<><i className="ri-add-box-line me-1" /> Add a personal memo</>}
                                headerClass="d-inline-flex align-items-center my-2"
                            >
                                <Row id="memo_collpase">
                                    <Col xxl={5}>
                                        <Form.Group className="mb-3" >
                                            <div className="form-label-group">
                                                <Form.Label>Personal Memo</Form.Label>
                                                <small className="text-muted">1400</small>
                                            </div>
                                            <Form.Control as="textarea" rows={6} placeholder="Write an internal note" defaultValue={""} />
                                            <Button variant="outline-light" className="mt-2">Add Note</Button>
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </HkSimpleCollapse>
                        </div>
                    </Container>
                </SimpleBar>
            </div>

            {/* Edit Info */}
            <EditInfo show={editInfo} hide={() => setEditInfo(!editInfo)} />

            {/* Billed Edit Info */}
            <AddNewClient show={addNewClient} hide={() => setAddNewClient(!addNewClient)} />
        </>
    )
}

export default Body
