/**
 * Modul: MCP — JSON-RPC tool server
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * A minimal Model Context Protocol server over stdio. It exposes the sandbox as
 * tools so a coding agent can drive simulations while it writes integration
 * code. There are deliberately NO live-money tools, and no shell/file access:
 * the server's only capability is talking to the BaturPay sandbox API.
 */
export const MCP_PROTOCOL_VERSION = '2025-06-18';
export const SERVER_NAME = 'baturpay';
export const SERVER_VERSION = '0.1.0';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

export interface McpServerOptions {
  apiUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export interface McpServer {
  handle(request: JsonRpcRequest): Promise<JsonRpcResponse | null>;
  tools(): ToolDefinition[];
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true };

export function createMcpServer(options: McpServerOptions): McpServer {
  const baseUrl = options.apiUrl.replace(/\/$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;

  const call = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    const parsed = text.length > 0 ? JSON.parse(text) : null;
    if (!response.ok) {
      const message = (parsed as { error?: { message?: string } } | null)?.error?.message ?? response.statusText;
      throw new Error(`HTTP ${response.status}: ${message}`);
    }
    return parsed;
  };

  const tools: ToolDefinition[] = [
    {
      name: 'baturpay_health',
      description: 'Check the BaturPay sandbox API health and whether the live-money gate is open.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: READ_ONLY,
    },
    {
      name: 'baturpay_list_scenarios',
      description: 'List the failure-first simulation scenarios (duplicate webhook, out-of-order, timeout, etc.).',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: READ_ONLY,
    },
    {
      name: 'baturpay_get_contract',
      description: 'Return the active API contract version and OpenAPI document metadata.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: READ_ONLY,
    },
    {
      name: 'baturpay_create_invoice',
      description: 'Create a SANDBOX invoice. No real money moves. Requires BATURPAY_API_KEY.',
      inputSchema: {
        type: 'object',
        required: ['externalId', 'amountMinor'],
        properties: {
          externalId: { type: 'string' },
          amountMinor: { type: 'integer', minimum: 1 },
          currency: { type: 'string', default: 'IDR' },
          scenario: { type: 'string' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    {
      name: 'baturpay_run_scenario',
      description: 'Run a deterministic SANDBOX scenario against an invoice. Returns the scripted event stream.',
      inputSchema: {
        type: 'object',
        required: ['invoiceId', 'scenario'],
        properties: {
          invoiceId: { type: 'string' },
          scenario: { type: 'string' },
          seed: { type: 'string' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    {
      name: 'baturpay_get_invoice',
      description: 'Retrieve an invoice and its canonical status.',
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
        additionalProperties: false,
      },
      annotations: READ_ONLY,
    },
  ];

  const executeTool = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    switch (name) {
      case 'baturpay_health':
        return call('GET', '/health');
      case 'baturpay_list_scenarios':
        return call('GET', '/v1/scenarios');
      case 'baturpay_get_contract':
        return call('GET', '/v1/contracts');
      case 'baturpay_create_invoice': {
        const body = {
          externalId: String(args.externalId ?? ''),
          amountMinor: Number(args.amountMinor ?? 0),
          currency: String(args.currency ?? 'IDR'),
          ...(args.scenario ? { scenario: String(args.scenario) } : {}),
        };
        return call('POST', '/v1/invoices', body);
      }
      case 'baturpay_run_scenario': {
        const body = {
          invoiceId: String(args.invoiceId ?? ''),
          scenario: String(args.scenario ?? ''),
          ...(args.seed ? { seed: String(args.seed) } : {}),
        };
        return call('POST', '/v1/runs', body);
      }
      case 'baturpay_get_invoice':
        return call('GET', `/v1/invoices/${encodeURIComponent(String(args.id ?? ''))}`);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  };

  return {
    tools: () => tools,
    async handle(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
      const id = request.id ?? null;
      const ok = (result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result });
      const fail = (code: number, message: string): JsonRpcResponse => ({
        jsonrpc: '2.0',
        id,
        error: { code, message },
      });

      switch (request.method) {
        case 'initialize':
          return ok({
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          });
        case 'notifications/initialized':
          return null;
        case 'ping':
          return ok({});
        case 'tools/list':
          return ok({ tools });
        case 'tools/call': {
          const params = request.params ?? {};
          const name = String(params.name ?? '');
          const args = (params.arguments as Record<string, unknown>) ?? {};
          try {
            const result = await executeTool(name, args);
            return ok({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: false });
          } catch (err) {
            return ok({
              content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
              isError: true,
            });
          }
        }
        default:
          return fail(-32601, `Method not found: ${request.method}`);
      }
    },
  };
}
