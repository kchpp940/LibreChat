import { useState, useCallback } from 'react';
function usePluginDialogHelpers() {
    const [maxPage, setMaxPage] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(1);
    const [searchChanged, setSearchChanged] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showPluginAuthForm, setShowPluginAuthForm] = useState(false);
    const [selectedPlugin, setSelectedPlugin] = useState(undefined);
    const calculateColumns = (node) => {
        const width = node.offsetWidth;
        let columns;
        if (width < 501) {
            setItemsPerPage(8);
            return;
        }
        else if (width < 640) {
            columns = 2;
        }
        else if (width < 1024) {
            columns = 3;
        }
        else {
            columns = 4;
        }
        setItemsPerPage(columns * 2); // 2 rows
    };
    const gridRef = useCallback((node) => {
        if (node !== null) {
            if (itemsPerPage === 1) {
                calculateColumns(node);
            }
            const resizeObserver = new ResizeObserver(() => calculateColumns(node));
            resizeObserver.observe(node);
        }
    }, [itemsPerPage]);
    const handleSearch = (e) => {
        setSearchValue(e.target.value);
        setSearchChanged(true);
    };
    const handleChangePage = (page) => {
        setCurrentPage(page);
    };
    return {
        maxPage,
        setMaxPage,
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        searchChanged,
        setSearchChanged,
        searchValue,
        setSearchValue,
        gridRef,
        handleSearch,
        handleChangePage,
        error,
        setError,
        errorMessage,
        setErrorMessage,
        showPluginAuthForm,
        setShowPluginAuthForm,
        selectedPlugin,
        setSelectedPlugin,
    };
}
export default usePluginDialogHelpers;
