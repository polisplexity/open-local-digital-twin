import React from "react";
import { Col, Pagination, Row } from "react-bootstrap";

const TableFooter = ({ range, setPage, page, slice, totalRows, paginatorSize }) => {

    const handleNext = () => {
        if (slice.length > 1 && page !== range.length) {
            setPage(page + 1);
        }
    }

    const handlePrev = () => {
        if (page > 1) {
            setPage(page - 1);
        }
    }

    return (
        <Row>
            <Col>
                {slice.length} of {totalRows.length}
            </Col>
            <Col>
                <Pagination size={paginatorSize} className='custom-pagination pagination-simple d-flex justify-content-end'>
                    <Pagination.Prev onClick={handlePrev} disabled={page === 1} >
                        <i className="ri-arrow-left-s-line" />
                    </Pagination.Prev>
                    {/* {range.map((el, index) => (
                        <Pagination.Item active={page === el} key={index}>{el}</Pagination.Item>
                    ))} */}
                    <Pagination.Item active>{page}</Pagination.Item>
                    <Pagination.Next onClick={handleNext} disabled={page === range.length} >
                        <i className="ri-arrow-right-s-line" />
                    </Pagination.Next>
                </Pagination>
            </Col>
        </Row>
    );
};

export default TableFooter;