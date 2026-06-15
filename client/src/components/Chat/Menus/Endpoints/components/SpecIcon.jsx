import React, { memo } from 'react';
import { getEndpointField } from 'librechat-data-provider';
import { getModelSpecIconURL, getIconKey } from '~/utils';
import { URLIcon } from '~/components/Endpoints/URLIcon';
import { icons } from '~/hooks/Endpoint/Icons';
import { isImageURL } from '~/utils/icons';
const SpecIcon = ({ currentSpec, endpointsConfig }) => {
    const iconURL = getModelSpecIconURL(currentSpec);
    const endpoint = currentSpec.preset?.endpoint;
    const endpointIconURL = getEndpointField(endpointsConfig, endpoint, 'iconURL');
    const iconKey = getIconKey({ endpoint, endpointsConfig, endpointIconURL });
    const shouldRenderURLIcon = isImageURL(iconURL);
    let Icon;
    if (!shouldRenderURLIcon) {
        Icon = (icons[iconURL] ?? icons[iconKey] ?? icons.unknown);
    }
    else {
        return (<URLIcon iconURL={iconURL} altName={currentSpec.name} containerStyle={{ width: 20, height: 20 }} className="icon-md shrink-0 overflow-hidden rounded-full" endpoint={endpoint || undefined}/>);
    }
    return (<Icon size={20} endpoint={endpoint} context="menu-item" iconURL={endpointIconURL} className="icon-md shrink-0 text-text-primary"/>);
};
export default memo(SpecIcon);
