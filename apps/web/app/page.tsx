'use client';

/**
 * Modul: Web — Sandbox dashboard
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * A deliberately plain control room for the sandbox: bootstrap a workspace,
 * create invoices, fire failure scenarios, and watch webhooks land. Everything
 * here is simulated.
 */
import { useCallback, useEffect, useState } from 'react';
import { api, API_URL, type Delivery, type Health, type Invoice, type Scenario } from '../lib/api';

const KEY_STORAGE = 'baturpay.sandbox.key';

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState('');
  const [health, setHealth] = useState<Health | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(KEY_STORAGE) : null;
    if (stored) setApiKey(stored);
    void api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  const refresh = useCallback(
    async (key: string) => {
      if (!key) return;
      const [sc, inv, del] = await Promise.all([
        api.scenarios(key).catch(() => [] as Scenario[]),
        api.invoices(key).catch(() => ({ data: [] as Invoice[] })),
        api.deliveries(key).catch(() => [] as Delivery[]),
      ]);
      setScenarios(sc);
      setInvoices(inv.data);
      setDeliveries(del);
    },
    [],
  );

  useEffect(() => {
    void refresh(apiKey);
  }, [apiKey, refresh]);

  const withBusy = async (label: string, fn: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage(`${label} failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const saveKey = (key: string): void => {
    setApiKey(key);
    if (typeof window !== 'undefined') window.localStorage.setItem(KEY_STORAGE, key);
  };

  const bootstrap = (): Promise<void> =>
    withBusy('bootstrap', async () => {
      const result = await api.bootstrap('Sandbox Dashboard');
      saveKey(result.apiKey.secret);
      setMessage('Workspace created. API key stored in this browser only.');
      setHealth(await api.health());
    });

  const createInvoice = (): Promise<void> =>
    withBusy('create invoice', async () => {
      const externalId = `INV-${Date.now()}`;
      await api.createInvoice(apiKey, externalId, 50_000);
      await refresh(apiKey);
      setMessage(`Created ${externalId} for IDR 50,000`);
    });

  const runScenario = (invoiceId: string, scenario: string): Promise<void> =>
    withBusy('run scenario', async () => {
      const run = await api.runScenario(apiKey, invoiceId, scenario);
      await refresh(apiKey);
      setMessage(`Ran ${scenario} → ${run.finalStatus}`);
    });

  const dispatch = (): Promise<void> =>
    withBusy('dispatch', async () => {
      const result = await api.dispatch(apiKey);
      await refresh(apiKey);
      setMessage(`Dispatch: ${result.delivered} delivered, ${result.retried} retried, ${result.failed} failed`);
    });

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>BaturPay — Sandbox</h1>
          <p className="muted">Payment developer workbench. All transactions are simulated.</p>
        </div>
        <div className="row">
          <span className="badge warn">simulation — no funds move</span>
          {health ? (
            <span className={`badge ${health.liveGateOpen ? 'danger' : 'ok'}`}>
              {health.mode} · live gate {health.liveGateOpen ? 'OPEN' : 'closed'}
            </span>
          ) : (
            <span className="badge danger">api offline ({API_URL})</span>
          )}
        </div>
      </div>

      <section className="card">
        <h2>Workspace</h2>
        <div className="row">
          <input
            style={{ minWidth: 380, flex: 1 }}
            placeholder="sk_sandbox_..."
            value={apiKey}
            onChange={(e) => saveKey(e.target.value.trim())}
          />
          <button className="secondary" onClick={() => void refresh(apiKey)} disabled={busy || !apiKey}>
            Refresh
          </button>
          <button onClick={() => void bootstrap()} disabled={busy}>
            Bootstrap workspace
          </button>
        </div>
        {message && <p className="muted" style={{ marginTop: 10 }}>{message}</p>}
      </section>

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Invoices</h2>
          <div className="row">
            <button onClick={() => void createInvoice()} disabled={busy || !apiKey}>
              Create demo invoice
            </button>
            <button className="secondary" onClick={() => void dispatch()} disabled={busy || !apiKey}>
              Dispatch webhooks
            </button>
          </div>
        </div>
        {invoices.length === 0 ? (
          <p className="muted">No invoices yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>External ID</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Run scenario</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.externalId}</td>
                  <td>
                    {inv.currency} {inv.amountMinor.toLocaleString('en-US')}
                  </td>
                  <td>{inv.status}</td>
                  <td>
                    <div className="row">
                      <select
                        value={chosen[inv.id] ?? scenarios[0]?.name ?? ''}
                        onChange={(e) => setChosen({ ...chosen, [inv.id]: e.target.value })}
                      >
                        {scenarios.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="secondary"
                        onClick={() => void runScenario(inv.id, chosen[inv.id] ?? scenarios[0]?.name ?? 'success')}
                        disabled={busy || scenarios.length === 0}
                      >
                        Run
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Webhook deliveries</h2>
        {deliveries.length === 0 ? (
          <p className="muted">No deliveries yet. Register an endpoint and run a scenario.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>HTTP</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td>
                    <code>{d.eventType}</code>
                  </td>
                  <td>{d.status}</td>
                  <td>{d.attempts}</td>
                  <td>{d.responseStatus ?? '-'}</td>
                  <td className="muted">{d.error ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Scenarios (failure-first)</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          {scenarios.map((s) => (
            <li key={s.name}>
              <code>{s.name}</code> — {s.title}
            </li>
          ))}
          {scenarios.length === 0 && <li>Load a workspace to see scenarios.</li>}
        </ul>
      </section>
    </main>
  );
}
