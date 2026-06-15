import React from 'react';
import { CustomMenu as Menu } from '../CustomMenu';
import { ModelSpecItem } from './ModelSpecItem';
import { useModelSelectorContext } from '../ModelSelectorContext';
import GroupIcon from './GroupIcon';
export function CustomGroup({ groupName, specs, groupIcon }) {
    const { selectedValues } = useModelSelectorContext();
    const { modelSpec: selectedSpec } = selectedValues;
    if (!specs || specs.length === 0) {
        return null;
    }
    return (<Menu id={`custom-group-${groupName}-menu`} key={`custom-group-${groupName}`} className="transition-opacity duration-200 ease-in-out" label={<div className="group flex w-full flex-shrink cursor-pointer items-center justify-between rounded-xl px-1 py-1 text-sm">
          <div className="flex items-center gap-2">
            {groupIcon && (<div className="flex-shrink-0">
                <GroupIcon iconURL={groupIcon} groupName={groupName}/>
              </div>)}
            <span className="truncate text-left">{groupName}</span>
          </div>
        </div>}>
      {specs.map((spec) => (<ModelSpecItem key={spec.name} spec={spec} isSelected={selectedSpec === spec.name}/>))}
    </Menu>);
}
export function renderCustomGroups(modelSpecs, mappedEndpoints) {
    // Get all endpoint values to exclude them from custom groups
    const endpointValues = new Set(mappedEndpoints.map((ep) => ep.value));
    // Group specs by their group field (excluding endpoint-matched groups and ungrouped)
    // Also track the groupIcon for each group (first spec with groupIcon wins)
    const customGroups = modelSpecs.reduce((acc, spec) => {
        if (!spec.group || endpointValues.has(spec.group)) {
            return acc;
        }
        if (!acc[spec.group]) {
            acc[spec.group] = { specs: [], groupIcon: undefined };
        }
        acc[spec.group].specs.push(spec);
        // Use the first groupIcon found for the group
        if (!acc[spec.group].groupIcon && spec.groupIcon) {
            acc[spec.group].groupIcon = spec.groupIcon;
        }
        return acc;
    }, {});
    // Render each custom group
    return Object.entries(customGroups).map(([groupName, { specs, groupIcon }]) => (<CustomGroup key={groupName} groupName={groupName} specs={specs} groupIcon={groupIcon}/>));
}
