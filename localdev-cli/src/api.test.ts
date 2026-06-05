import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalDevAPI } from './api.js';
import fetch from 'node-fetch';

// Mock node-fetch
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

// Mock ws
vi.mock('ws', () => ({
  WebSocket: vi.fn(),
}));

describe('LocalDevAPI', () => {
  let api: LocalDevAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new LocalDevAPI();
  });

  it('getStatus should return status from backend', async () => {
    const mockStatus = { mode: 'local', active_model: 'test-model' };
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockStatus,
    });

    const status = await api.getStatus();
    expect(status).toEqual(mockStatus);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/config/status'));
  });

  it('getStatus should return error when backend is unreachable', async () => {
    (fetch as any).mockRejectedValue(new Error('Connection refused'));

    const status = await api.getStatus();
    expect(status).toEqual({ error: 'Connection refused' });
  });

  it('getSystemResources should return resources', async () => {
    const mockResources = { cpu_percent: 10, ram_percent: 20 };
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResources,
    });

    const resources = await api.getSystemResources();
    expect(resources).toEqual(mockResources);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/system-resources'));
  });

  it('getGitStatus should return git changes', async () => {
    const mockGit = { changes: [{ path: 'file.txt', staged: true }] };
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockGit,
    });

    const gitStatus = await api.getGitStatus();
    expect(gitStatus).toEqual(mockGit);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/git/status'));
  });

  it('indexDirectory should send POST request', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success' }),
    });

    const result = await api.indexDirectory('/test/path');
    expect(result).toEqual({ status: 'success' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rag/index-directory'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ path: '/test/path' }),
      })
    );
  });

  it('setActiveModel should send POST request', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success' }),
    });

    const result = await api.setActiveModel('new-model');
    expect(result).toEqual({ status: 'success' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/config/active-model'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ model: 'new-model' }),
      })
    );
  });
});
