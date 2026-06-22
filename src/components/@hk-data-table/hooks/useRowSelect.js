import React from 'react'

const useRowSelect = (slice, data) => {
    const [selectedRows, setSelectedRows] = React.useState([]);
    const [selectAll, setSelectAll] = React.useState(false);

    // Function to handle row selection
    const handleRowSelection = (id) => {
        let updatedSelection = [...selectedRows];
        const allIds = slice.map((row, indx) => indx);

        if (updatedSelection.includes(id)) {
            updatedSelection = updatedSelection.filter((rowId) => rowId !== id);
        } else {
            updatedSelection.push(id);
        };

        setSelectedRows(updatedSelection);

        if (updatedSelection.length === allIds.length) {
            setSelectAll(true);
        };

        if (updatedSelection.length < allIds.length) {
            setSelectAll(false);
        }

    };

    // Function to handle select all checkbox
    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedRows([]);
        } else {
            const allIds = slice.map((row, indx) => indx);
            setSelectedRows(allIds);
        }

        setSelectAll(!selectAll);
    };

    // Helper function to check if a row is selected
    const isRowSelected = (id) => selectedRows.includes(id);

    return { selectAll, handleRowSelection, handleSelectAll, isRowSelected }
}

export default useRowSelect
