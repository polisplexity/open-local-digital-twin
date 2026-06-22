import React from 'react';

const useSortableData = (items, config = null) => {
    const [sortConfig, setSortConfig] = React.useState(config);

    const sortedItems = React.useMemo(() => {
        let sortableItems = [...items];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                else if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return sortConfig.direction === 'descending' ? 1 : -1;
            });
        }
        return sortableItems;
    }, [items, sortConfig]);

    const requestSort = (sort, key) => {
        let direction = 'ascending';
        if (
            sortConfig &&
            sortConfig.key === key &&
            sortConfig.direction === 'ascending'
        ) {
            direction = 'descending';
        };
        if (sort) {
            setSortConfig({ key, direction });
        }
    };


    return { items: sortedItems, requestSort, sortConfig };
};

export default useSortableData;