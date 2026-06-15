import React from 'react';
import VectorStoreListItem from './VectorStoreListItem';
export default function VectorStoreList({ vectorStores, deleteVectorStore }) {
    return (<div>
      {vectorStores.map((vectorStore, index) => (<VectorStoreListItem key={index} vectorStore={vectorStore} deleteVectorStore={deleteVectorStore}/>))}
    </div>);
}
