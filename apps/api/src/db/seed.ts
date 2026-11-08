/**
 * Modul: API — Seed a demo workspace
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { loadConfig } from '@baturpay/config';
import { newId } from '@baturpay/core';
import { buildApiKeyRecord, mintApiKey } from '../services/auth.js';
import { recordAudit } from '../services/audit.js';
import { createStore } from '../store/index.js';

export async function seed(): Promise<{ workspaceId: string; apiKey: string }> {
  const config = loadConfig();
  const store = await createStore(config);
  try {
    const workspace = await store.createWorkspace({ id: newId('ws'), name: 'Demo Sandbox' });
    const minted = mintApiKey(config.apiKeyPepper);
    const record = buildApiKeyRecord(workspace.id, minted, ['sandbox:*']);
    await store.createApiKey(record);
    await recordAudit(store, {
      workspaceId: workspace.id,
      actor: 'seed',
      action: 'workspace.created',
      resource: workspace.id,
      metadata: { name: workspace.name },
    });
    return { workspaceId: workspace.id, apiKey: minted.plaintext };
  } finally {
    await store.close();
  }
}

async function main(): Promise<void> {
  const result = await seed();
  console.log('Seeded demo workspace');
  console.log(`  workspace id : ${result.workspaceId}`);
  console.log(`  api key      : ${result.apiKey}`);
  console.log('Store the key now; it is shown only once.');
}

const isMain = process.argv[1] && process.argv[1].endsWith('seed.ts');
if (isMain) {
  main().catch((err) => {
    console.error('seed failed:', err);
    process.exit(1);
  });
}
