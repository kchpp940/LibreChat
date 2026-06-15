export const addData = (data, collectionName, newData, findIndex) => {
    const dataJson = JSON.parse(JSON.stringify(data));
    const { pageIndex, index } = findPage(data, findIndex);
    if (pageIndex !== -1 && index !== -1) {
        return updateData(data, collectionName, newData, findIndex);
    }
    dataJson.pages[0][collectionName].unshift({
        ...newData,
        updatedAt: new Date().toISOString(),
    });
    return dataJson;
};
export const getRecordByProperty = (data, collectionName, findProperty) => {
    // Find the page and the index of the record in that page
    const { pageIndex, index } = findPage(data, (page) => page[collectionName].findIndex(findProperty));
    // If found, return the record
    if (pageIndex !== -1 && index !== -1) {
        return data.pages[pageIndex][collectionName][index];
    }
    // Return undefined if the record is not found
    return undefined;
};
export function findPage(data, findIndex) {
    for (let pageIndex = 0; pageIndex < data.pages.length; pageIndex++) {
        const page = data.pages[pageIndex];
        const index = findIndex(page);
        if (index !== -1) {
            return { pageIndex, index };
        }
    }
    return { pageIndex: -1, index: -1 }; // Not found
}
export const updateData = (data, collectionName, updatedData, findIndex) => {
    const newData = JSON.parse(JSON.stringify(data));
    const { pageIndex, index } = findPage(data, findIndex);
    if (pageIndex !== -1 && index !== -1) {
        // Remove the data from its current position
        newData.pages[pageIndex][collectionName].splice(index, 1);
        // Add the updated data to the top of the first page
        newData.pages[0][collectionName].unshift({
            ...updatedData,
            updatedAt: new Date().toISOString(),
        });
    }
    return newData;
};
export const deleteData = (data, collectionName, findIndex) => {
    const newData = JSON.parse(JSON.stringify(data));
    const { pageIndex, index } = findPage(newData, findIndex);
    if (pageIndex !== -1 && index !== -1) {
        // Delete the data from its current page
        newData.pages[pageIndex][collectionName].splice(index, 1);
    }
    return newData;
};
/**
 * Normalize the data so that the number of data on each page is within pageSize
 */
export const normalizeData = (data, collectionName, pageSize, uniqueProperty) => {
    const infiniteData = JSON.parse(JSON.stringify(data));
    const pageCount = infiniteData.pages.length;
    if (pageCount === 0) {
        return infiniteData;
    }
    const pageParams = infiniteData.pageParams;
    // Combine all conversations of all pages into one array
    let collection = infiniteData.pages.flatMap((page) => page[collectionName]);
    if (collection.length === 0) {
        return infiniteData;
    }
    if (uniqueProperty) {
        const seen = new Set();
        collection = collection.filter((item) => {
            const value = item[uniqueProperty];
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
            return true;
        });
    }
    // Create the restructured pages
    const restructuredPages = Array.from({ length: pageCount }, (_, i) => ({
        ...infiniteData.pages[i],
        [collectionName]: collection.slice(i * pageSize, (i + 1) * pageSize),
    })).filter((page) => page[collectionName].length > 0); // Remove empty pages
    return {
        pageParams: pageParams.slice(0, restructuredPages.length),
        pages: restructuredPages,
    };
};
export const updateFields = (data, updatedItem, collectionName, identifierField, callback) => {
    const newData = JSON.parse(JSON.stringify(data));
    const { pageIndex, index } = findPage(newData, (page) => page[collectionName].findIndex((item) => item[identifierField] === updatedItem[identifierField]));
    if (pageIndex !== -1 && index !== -1) {
        const deleted = newData.pages[pageIndex][collectionName].splice(index, 1);
        const oldItem = deleted[0];
        const newItem = {
            ...oldItem,
            ...updatedItem,
            updatedAt: new Date().toISOString(),
        };
        if (callback) {
            callback(newItem);
        }
        newData.pages[0][collectionName].unshift(newItem);
    }
    return newData;
};
export const updateFieldsInPlace = (data, updatedItem, collectionName, identifierField) => {
    const identifierValue = updatedItem[identifierField];
    if (identifierValue == null) {
        return data;
    }
    const { pageIndex, index } = findPage(data, (page) => page[collectionName].findIndex((item) => item[identifierField] === identifierValue));
    if (pageIndex === -1 || index === -1) {
        return data;
    }
    const oldItem = data.pages[pageIndex][collectionName][index];
    const newItem = { ...oldItem, ...updatedItem };
    const newCollection = [...data.pages[pageIndex][collectionName]];
    newCollection[index] = newItem;
    const newPage = { ...data.pages[pageIndex], [collectionName]: newCollection };
    const newPages = [...data.pages];
    newPages[pageIndex] = newPage;
    return { ...data, pages: newPages };
};
export function updateCacheList({ queryClient, queryKey, searchProperty, updateData, searchValue, }) {
    queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData) {
            return oldData;
        }
        return oldData.map((item) => item[searchProperty] === searchValue ? { ...item, ...updateData } : item);
    });
}
export function addToCacheList(queryClient, queryKey, newItem) {
    queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData) {
            return [newItem];
        }
        return [...oldData, newItem];
    });
}
export function removeFromCacheList(queryClient, queryKey, searchProperty, searchValue) {
    queryClient.setQueryData(queryKey, (oldData) => {
        if (!oldData) {
            return oldData;
        }
        return oldData.filter((item) => item[searchProperty] !== searchValue);
    });
}
