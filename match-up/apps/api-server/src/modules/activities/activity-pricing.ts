import type { ActivityFeeMode, ActivityJoinPolicy, ActivityRecord } from './activities.service.js';

export function isJoinPolicy(value: unknown): value is ActivityJoinPolicy {
  return value === 'open' || value === 'approval';
}

export function isFeeMode(value: unknown): value is ActivityFeeMode {
  return value === 'fixed' || value === 'split';
}

// Pricing helpers: paid/free resolution, split-cost, weather snapshot.

/** Free activities discard any fee; paid activities require a positive, cent-rounded amount. */
export function resolvePaidFee(
  isPaid: boolean | undefined,
  fee: number | undefined,
): { isPaid: boolean; fee?: number } {
  const paid = isPaid ?? false;
  if (typeof paid !== 'boolean') {
    throw new Error('isPaid must be a boolean');
  }
  if (!paid) {
    return { isPaid: false };
  }
  if (fee === undefined || typeof fee !== 'number' || !Number.isFinite(fee) || fee <= 0) {
    throw new Error('fee must be a positive number for paid activities');
  }
  // Cap to cents to keep display + storage consistent.
  return { isPaid: true, fee: Math.round(fee * 100) / 100 };
}

/** Normalises an optional weather snapshot. */
// Keep only plausible optional weather values so third-party data cannot block activity writes.
export function normalizeWeatherSnapshot(input: {
  weatherTemp?: number | null | undefined;
  weatherCode?: number | undefined;
  weatherDesc?: string | undefined;
  weatherRain?: number | undefined;
}): Partial<ActivityRecord> {
  const out: Partial<ActivityRecord> = {};
  if (input.weatherTemp !== undefined && input.weatherTemp !== null) {
    if (typeof input.weatherTemp === 'number' && Number.isFinite(input.weatherTemp)) {
      out.weatherTemp = Math.round(input.weatherTemp * 10) / 10;
    }
  } else if (input.weatherTemp === null) {
    out.weatherTemp = null;
  }
  if (
    input.weatherCode !== undefined &&
    typeof input.weatherCode === 'number' &&
    Number.isInteger(input.weatherCode) &&
    input.weatherCode >= 0 &&
    input.weatherCode <= 99
  ) {
    out.weatherCode = input.weatherCode;
  }
  if (input.weatherDesc !== undefined && typeof input.weatherDesc === 'string') {
    const desc = input.weatherDesc.trim().slice(0, 40);
    if (desc) out.weatherDesc = desc;
  }
  if (
    input.weatherRain !== undefined &&
    typeof input.weatherRain === 'number' &&
    Number.isInteger(input.weatherRain) &&
    input.weatherRain >= 0 &&
    input.weatherRain <= 100
  ) {
    out.weatherRain = input.weatherRain;
  }
  return out;
}

/** Fixed pricing needs no split fields; split pricing validates total cost and minimum attendance. */
export function resolveSplitCost(
  feeMode: ActivityFeeMode | undefined,
  totalCost: number | undefined,
  minPlayers: number | undefined,
  capacity: number,
): { feeMode: ActivityFeeMode; totalCost?: number; minPlayers?: number } {
  const mode = feeMode ?? 'fixed';
  if (!isFeeMode(mode)) {
    throw new Error('feeMode must be fixed or split');
  }
  if (mode === 'fixed') {
    return { feeMode: mode };
  }
  if (
    totalCost === undefined ||
    typeof totalCost !== 'number' ||
    !Number.isFinite(totalCost) ||
    totalCost <= 0
  ) {
    throw new Error('totalCost must be a positive number for split mode');
  }
  if (
    minPlayers !== undefined &&
    (!Number.isInteger(minPlayers) || minPlayers < 2 || minPlayers > capacity)
  ) {
    throw new Error('minPlayers must be an integer between 2 and capacity');
  }
  return {
    feeMode: mode,
    totalCost: Math.round(totalCost * 100) / 100,
    ...(minPlayers !== undefined ? { minPlayers } : {}),
  };
}
