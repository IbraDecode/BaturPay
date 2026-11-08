/**
 * Modul: MCP — stdio entry point
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Newline-delimited JSON-RPC over stdin/stdout. Point your MCP-capable agent's
 * config at `tsx apps/mcp/src/index.ts` with BATURPAY_API_URL/BATURPAY_API_KEY
 * in the environment. The server never touches the filesystem or a shell.
 */
import { createInterface } from 'node:readline';
import { createMcpServer, type JsonRpcRequest } from './server.js';

const apiUrl = process.env.BATURPAY_API_URL ?? 'http://localhost:4000';
const apiKey = process.env.BATURPAY_API_KEY;

const server = createMcpServer({ apiUrl, apiKey });

function write(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

export function startStdio(): void {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(trimmed) as JsonRpcRequest;
    } catch {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      return;
    }
    void server
      .handle(request)
      .then((response) => {
        if (response) write(response);
      })
      .catch((err: unknown) => {
        write({
          jsonrpc: '2.0',
          id: request.id ?? null,
          error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
        });
      });
  });
}

startStdio();
