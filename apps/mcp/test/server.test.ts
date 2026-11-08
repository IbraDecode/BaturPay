/**
 * Modul: MCP tests
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { describe, expect, it, vi } from 'vitest';
import { createMcpServer } from '../src/server.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('mcp server', () => {
  it('answers initialize with protocol metadata', async () => {
    const server = createMcpServer({ apiUrl: 'http://localhost:4000' });
    const res = await server.handle({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    expect(res?.result).toMatchObject({ serverInfo: { name: 'baturpay' } });
  });

  it('lists tools and marks read-only ones', async () => {
    const server = createMcpServer({ apiUrl: 'http://localhost:4000' });
    const res = await server.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const tools = (res?.result as { tools: Array<{ name: string; annotations?: Record<string, unknown> }> }).tools;
    expect(tools.length).toBeGreaterThanOrEqual(6);
    const health = tools.find((t) => t.name === 'baturpay_health');
    expect(health?.annotations?.readOnlyHint).toBe(true);
  });

  it('ignores the initialized notification', async () => {
    const server = createMcpServer({ apiUrl: 'http://localhost:4000' });
    const res = await server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(res).toBeNull();
  });

  it('calls a tool and returns text content', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 'ok', mode: 'sandbox', liveGateOpen: false })) as unknown as typeof fetch;
    const server = createMcpServer({ apiUrl: 'http://localhost:4000', fetchImpl });
    const res = await server.handle({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'baturpay_health', arguments: {} },
    });
    const result = res?.result as { content: Array<{ text: string }>; isError: boolean };
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content[0]!.text).mode).toBe('sandbox');
  });

  it('reports tool errors without crashing the server', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    const server = createMcpServer({ apiUrl: 'http://localhost:4000', fetchImpl });
    const res = await server.handle({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'baturpay_health', arguments: {} },
    });
    const result = res?.result as { isError: boolean };
    expect(result.isError).toBe(true);
  });

  it('returns method-not-found for unknown methods', async () => {
    const server = createMcpServer({ apiUrl: 'http://localhost:4000' });
    const res = await server.handle({ jsonrpc: '2.0', id: 5, method: 'bogus' });
    expect(res?.error?.code).toBe(-32601);
  });
});
