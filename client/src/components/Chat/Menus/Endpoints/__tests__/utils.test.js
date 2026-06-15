import { filterItems } from '../utils';
const agentsEndpoint = {
    value: 'agents',
    label: 'My Agents',
    hasModels: true,
    icon: null,
    showMarketplace: true,
    searchAliases: ['agent marketplace', 'marketplace'],
};
const disabledAgentsEndpoint = {
    value: 'agents',
    label: 'My Agents',
    hasModels: false,
    icon: null,
};
describe('model selector utilities', () => {
    it('matches endpoint search aliases', () => {
        const results = filterItems([agentsEndpoint], 'marketplace', undefined, undefined);
        expect(results).toEqual([agentsEndpoint]);
    });
    it('matches localized Marketplace labels', () => {
        const localize = ((key) => {
            if (key === 'com_agents_marketplace') {
                return 'Tienda de Agentes';
            }
            if (key === 'com_ui_marketplace') {
                return 'Tienda';
            }
            return key;
        });
        const results = filterItems([agentsEndpoint], 'tienda', undefined, undefined, localize);
        expect(results).toEqual([agentsEndpoint]);
    });
    it('does not match agents when there are no selectable agent options', () => {
        const results = filterItems([disabledAgentsEndpoint], 'my agents', undefined, undefined);
        expect(results).toEqual([]);
    });
});
