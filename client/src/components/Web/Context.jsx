import { createContext, useContext } from 'react';
import { useSearchContext } from '~/Providers';
export const CitationContext = createContext({
    hoveredCitationId: null,
    setHoveredCitationId: () => { },
});
export function useHighlightState(citationId) {
    const { hoveredCitationId } = useContext(CitationContext);
    return citationId && hoveredCitationId === citationId;
}
const refTypeMap = {
    search: 'organic',
    ref: 'references',
    news: 'topStories',
    file: 'references',
};
export function useCitation({ turn, index, refType: _refType, }) {
    const { searchResults } = useSearchContext();
    if (!_refType) {
        return undefined;
    }
    const refType = refTypeMap[_refType.toLowerCase()]
        ? refTypeMap[_refType.toLowerCase()]
        : _refType;
    if (!searchResults || !searchResults[turn] || !searchResults[turn][refType]) {
        return undefined;
    }
    const source = searchResults[turn][refType][index];
    if (!source) {
        return undefined;
    }
    return {
        ...source,
        turn,
        refType: _refType.toLowerCase(),
        index,
        link: source.link ?? '',
        title: source.title ?? '',
        snippet: source['snippet'] ?? '',
        attribution: source.attribution ?? '',
    };
}
export function useCompositeCitations(citations) {
    const { searchResults } = useSearchContext();
    const result = [];
    for (const { turn, refType: _refType, index } of citations) {
        const refType = refTypeMap[_refType.toLowerCase()]
            ? refTypeMap[_refType.toLowerCase()]
            : _refType;
        if (!searchResults || !searchResults[turn] || !searchResults[turn][refType]) {
            continue;
        }
        const source = searchResults[turn][refType][index];
        if (!source) {
            continue;
        }
        result.push({
            ...source,
            turn,
            refType: _refType.toLowerCase(),
            index,
            link: source.link ?? '',
            title: source.title ?? '',
            snippet: source['snippet'] ?? '',
            attribution: source.attribution ?? '',
        });
    }
    return result;
}
