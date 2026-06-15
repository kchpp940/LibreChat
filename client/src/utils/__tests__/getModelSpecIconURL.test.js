import { EModelEndpoint } from 'librechat-data-provider';
import { getModelSpecIconURL } from '../endpoints';
describe('getModelSpecIconURL', () => {
    it('returns the explicit model spec icon before preset values', () => {
        const modelSpec = {
            name: 'gemini-test',
            label: 'Gemini Test',
            iconURL: EModelEndpoint.google,
            preset: {
                endpoint: EModelEndpoint.openAI,
                iconURL: EModelEndpoint.anthropic,
            },
        };
        expect(getModelSpecIconURL(modelSpec)).toBe(EModelEndpoint.google);
    });
    it('falls back to the preset icon URL when no spec icon is defined', () => {
        const modelSpec = {
            name: 'gemini-test',
            label: 'Gemini Test',
            preset: {
                endpoint: EModelEndpoint.google,
                iconURL: EModelEndpoint.openAI,
            },
        };
        expect(getModelSpecIconURL(modelSpec)).toBe(EModelEndpoint.openAI);
    });
    it('falls back to the preset endpoint when no icon URL is defined', () => {
        const modelSpec = {
            name: 'gemini-test',
            label: 'Gemini Test',
            preset: {
                endpoint: EModelEndpoint.google,
            },
        };
        expect(getModelSpecIconURL(modelSpec)).toBe(EModelEndpoint.google);
    });
    it('returns an empty icon when a runtime model spec is missing preset data', () => {
        const modelSpec = {
            name: 'gemini-test',
            label: 'Gemini Test',
        };
        expect(getModelSpecIconURL(modelSpec)).toBe('');
    });
});
