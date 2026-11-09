/** API types only; analytics and estimates are calculated in the backend. */
import type { EnergyCost } from './tariffs';
export type ForecastConfidence = 'low' | 'medium' | 'high';

export type ForecastBasis = {
  samples: number;
  firstAt: string | null;
  lastAt: string | null;
  firstEnergy: number | null;
  lastEnergy: number | null;
  daysWithData: number;
};

export type ForecastUnavailableReason =
  | 'no_data'
  | 'insufficient_span'
  | 'counter_decreased';

export type Forecast =
  | {
      available: false;
      reason: ForecastUnavailableReason;
      spanDays: number;
      daysWithData: number;
      samples: number;
      firstAt: string | null;
      lastAt: string | null;
    }
  | {
      available: true;
      spanDays: number;
      daysWithData: number;
      samples: number;
      firstAt: string | null;
      lastAt: string | null;
      measuredKwh: number;
      dailyAverageKwh: number;
      projectionDays: number;
      projectedKwh: number;
      cost: EnergyCost;
      confidence: ForecastConfidence;
    };
