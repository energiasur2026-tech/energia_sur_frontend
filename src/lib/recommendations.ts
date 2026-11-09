/** API types only; analytics and estimates are calculated in the backend. */
export type Recommendation = {
  id: string;
  title: string;
  detail: string;
  /** Magnitud estimada del ahorro, cuando se puede cuantificar honestamente. */
  impact: string | null;
  tone: 'good' | 'action' | 'info';
};

export type HourlyPoint = { hour: number; samples: number; avgPowerW: number | null };
