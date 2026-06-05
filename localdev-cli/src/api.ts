import fetch from 'node-fetch';
import { WebSocket } from 'ws';

const BACKEND_URL = process.env.LOCALDEV_BACKEND_URL || 'http://localhost:8000';
const WS_URL = BACKEND_URL.replace('http', 'ws');

export class LocalDevAPI {
  async getStatus(): Promise<any> {
    try {
      const response = await fetch(`${BACKEND_URL}/config/status`);
      if (!response.ok) throw new Error('Backend unreachable');
      return await response.json() as any;
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  async getSystemResources(): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/api/system-resources`);
    return await response.json() as any;
  }

  async getGitStatus(): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/git/status`);
    return await response.json() as any;
  }

  async generateCommitMessage(): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/git/generate-message`, { method: 'POST' });
    return await response.json() as any;
  }

  async commit(message: string): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/git/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    return await response.json() as any;
  }

  async indexDirectory(path: string): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/rag/index-directory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    return await response.json() as any;
  }

  async semanticSearch(query: string, currentFile: string = ''): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/rag/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, current_file: currentFile }),
    });
    return await response.json() as any;
  }

  async listModels(): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/ollama/models`);
    return await response.json() as any;
  }

  async showModel(modelName: string): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/ollama/show/${encodeURIComponent(modelName)}`);
    return await response.json() as any;
  }

  async setActiveModel(modelName: string): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/config/active-model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName }),
    });
    return await response.json() as any;
  }

  async setCloudMode(creds: { access_key: string, secret_key: string, region: string, session_token?: string }): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/config/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'cloud',
        aws_access_key: creds.access_key,
        aws_secret_key: creds.secret_key,
        aws_region: creds.region,
        aws_session_token: creds.session_token
      }),
    });
    return await response.json() as any;
  }

  async listCloudInstances(creds: any): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/cloud/list-instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });
    return await response.json() as any;
  }

  async startRalph(workDir: string, model?: string): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/ralph/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ work_dir: workDir, model }),
    });
    return await response.json() as any;
  }

  async getRalphStatus(taskId: string): Promise<any> {
    const response = await fetch(`${BACKEND_URL}/ralph/status/${taskId}`);
    return await response.json() as any;
  }

  createCloudProvisionSocket() {
    return new WebSocket(`${WS_URL}/ws/cloud/provision`);
  }

  createChatSocket() {
    return new WebSocket(`${WS_URL}/ws/ollama/chat_v2`);
  }
}

export const api = new LocalDevAPI();
