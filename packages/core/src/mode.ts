/**
 * Modul: Core — Runtime mode & live-operation gate
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * This is the safety interlock. Sandbox is the default and live money movement
 * fails closed unless every condition below is satisfied AND verified out of
 * band (partner agreement + licensing review). No amount of code, prompt, or
 * agent instruction can open this gate by itself.
 */
import { errors } from './errors.js';

export type RuntimeMode = 'sandbox' | 'production';

export interface LiveGate {
  readonly mode: RuntimeMode;
  readonly livePaymentsEnabled: boolean;
  readonly goLiveAttestation: string;
}

export type LiveOperationKind =
  | 'charge'
  | 'refund'
  | 'payout'
  | 'settle'
  | 'onboard_merchant_live';

export const LIVE_OPERATION_KINDS: readonly LiveOperationKind[] = [
  'charge',
  'refund',
  'payout',
  'settle',
  'onboard_merchant_live',
];

export interface LiveGateStatus {
  open: boolean;
  reasons: string[];
}

export function liveGateStatus(gate: LiveGate): LiveGateStatus {
  const reasons: string[] = [];
  if (gate.mode !== 'production') reasons.push('runtime mode is not production');
  if (!gate.livePaymentsEnabled) reasons.push('live payments flag is disabled');
  if (gate.goLiveAttestation.trim().length === 0) reasons.push('missing go-live attestation');
  return { open: reasons.length === 0, reasons };
}

/**
 * Throws LiveOperationBlocked (HTTP 451) unless the gate is fully open.
 * Callers must invoke this before any code path that could move real money.
 */
export function assertLiveAllowed(gate: LiveGate, operation: LiveOperationKind): void {
  const status = liveGateStatus(gate);
  if (!status.open) {
    throw errors.liveBlocked(
      `Live operation "${operation}" is blocked by the compliance gate`,
      { operation, reasons: status.reasons },
    );
  }
}

export function isSandbox(gate: LiveGate): boolean {
  return gate.mode === 'sandbox';
}
