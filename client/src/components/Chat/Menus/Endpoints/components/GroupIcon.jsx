import React, { memo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { getKnownEndpointAsset, hasKnownEndpointIcon } from '~/hooks/Endpoint/UnknownIcon';
import { icons } from '~/hooks/Endpoint/Icons';
const GroupIcon = ({ iconURL, groupName }) => {
    const [imageError, setImageError] = useState(false);
    const handleImageError = () => {
        setImageError(true);
    };
    // Check if the iconURL is a built-in icon key
    if (iconURL in icons) {
        const Icon = (icons[iconURL] ?? icons.unknown);
        return <Icon size={20} context="menu-item" className="icon-md shrink-0 text-text-primary"/>;
    }
    if (imageError) {
        const DefaultIcon = icons.unknown;
        return (<div className="relative" style={{ width: 20, height: 20, margin: '2px' }}>
        <div className="icon-md shrink-0 overflow-hidden rounded-full">
          <DefaultIcon context="menu-item" size={20}/>
        </div>
        {imageError && iconURL && (<div className="absolute flex items-center justify-center rounded-full bg-red-500" style={{ width: '14px', height: '14px', top: 0, right: 0 }}>
            <AlertCircle size={10} className="text-white"/>
          </div>)}
      </div>);
    }
    const resolvedIconURL = getKnownEndpointAsset(iconURL);
    if (!resolvedIconURL && hasKnownEndpointIcon(iconURL)) {
        const Icon = icons.unknown;
        return (<Icon size={20} endpoint={iconURL} context="menu-item" className="icon-md shrink-0 text-text-primary"/>);
    }
    return (<div className="icon-md shrink-0 overflow-hidden rounded-full" style={{ width: 20, height: 20 }}>
      <img src={resolvedIconURL || iconURL} alt={groupName} className="h-full w-full object-cover" onError={handleImageError}/>
    </div>);
};
export default memo(GroupIcon);
