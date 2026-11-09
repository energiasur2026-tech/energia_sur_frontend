/** API types only. All goal/tariff calculations run in the backend. */
export type GoalInputMode = 'kwh' | 'ars';

export type GoalStatus = 'no_goal' | 'no_data' | 'on_track' | 'at_risk' | 'over';

export type GoalProgress = {
  status: GoalStatus;
  goalKwh: number | null;
  goalCostArs: number | null;
  inputMode: GoalInputMode;
  /** Cuánto se puede consumir por día y por semana para llegar a la meta. */
  allowedPerDayKwh: number | null;
  allowedPerWeekKwh: number | null;
  daysInMonth: number;
  elapsedDays: number;
  /**
   * Días del mes efectivamente cubiertos por lecturas. Puede ser menor que
   * `elapsedDays` si el medidor se instaló o se cayó a mitad de mes.
   */
  measuredDays: number | null;
  /** `measuredDays / elapsedDays`. Por debajo de 1, parte del mes no se midió. */
  coverage: number | null;
  consumedKwh: number | null;
  /** Consumo diario medido: la base de toda la proyección. */
  dailyRateKwh: number | null;
  /**
   * Lo que debería haber consumido **durante los días medidos**, al ritmo del
   * objetivo. Se calcula sobre los días medidos y no sobre los transcurridos
   * para que la comparación contra lo consumido sea entre las mismas fechas.
   */
  expectedKwh: number | null;
  projectedMonthKwh: number | null;
  projectedCostArs: number | null;
  deviationKwh: number | null;
  deviationPct: number | null;
  /** Consumo diario que queda disponible para el resto del mes. */
  remainingPerDayKwh: number | null;
};
