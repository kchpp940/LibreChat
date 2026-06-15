import React from 'react';
import { PlusIcon } from 'lucide-react';
import { Button } from '@librechat/client';
export default function VectorStoreButton({ onClick }) {
    return (<div className="w-full">
      <Button className="w-full bg-black p-0 text-white" onClick={onClick}>
        <PlusIcon className="h-4 w-4 font-bold"/>
        &nbsp; <span className="text-nowrap">Add Store</span>
      </Button>
    </div>);
}
