import { dataService as _dataService } from 'librechat-data-provider';
import axios from 'axios';
jest.mock('axios');
const mockedAxios = axios;
describe('getMemories', () => {
    it('should fetch memories from /api/memories', async () => {
        const mockData = [{ key: 'foo', value: 'bar', updated_at: '2024-05-01T00:00:00Z' }];
        mockedAxios.get.mockResolvedValueOnce({ data: mockData });
        const result = await _dataService.getMemories();
        expect(mockedAxios.get).toHaveBeenCalledWith('/api/memories', expect.any(Object));
        expect(result).toEqual(mockData);
    });
});
