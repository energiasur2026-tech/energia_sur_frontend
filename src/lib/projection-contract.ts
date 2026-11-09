import type { MonthlyProjection } from './monthly-projection';
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const nullableNumber=(v:unknown)=>v===null||typeof v==='number'&&Number.isFinite(v);
/** Reject old API payloads before rendering; missing metadata must never become a fake valid tariff. */
export function isMonthlyProjection(value:unknown):value is MonthlyProjection{
 if(!record(value)||!record(value.goal)||!record(value.tariff)||!record(value.quality)||!record(value.chart))return false;
 const {goal,tariff,quality,chart}=value;
 return ['no_goal','no_data','on_track','at_risk','over'].includes(String(goal.status))
 && ['goalKwh','projectedMonthKwh','projectedCostArs','consumedKwh','dailyRateKwh','deviationKwh','remainingPerDayKwh'].every(k=>nullableNumber(goal[k]))
 && typeof tariff.valid==='boolean'&&Array.isArray(tariff.included)&&Array.isArray(tariff.excluded)
 && typeof value.month==='string'&&/^\d{4}-\d{2}$/.test(value.month)&&typeof value.daysInMonth==='number'
 && typeof quality.coverage==='number'&&typeof quality.completeDays==='number'&&typeof quality.gaps==='number'&&typeof quality.samples==='number'
 && Array.isArray(value.warnings)&&value.warnings.every(v=>typeof v==='string')&&Array.isArray(value.recommendations)
 && Array.isArray(value.monthDaily)&&Array.isArray(value.gapDays)&&Array.isArray(chart.references)&&Array.isArray(chart.observed)&&Array.isArray(chart.estimated)
 && nullableNumber(value.measuredKwh)&&nullableNumber(value.exceededKwh)&&nullableNumber(value.todayX)
 && typeof value.monthStart==='string'&&typeof value.monthEnd==='string'&&typeof value.method==='string';
}
export const PROJECTION_CONTRACT_ERROR='El backend configurado todavía no entrega la nueva proyección mensual. Actualizá el backend de EnergIA Sur o apuntá BACKEND_URL al backend local actualizado y reiniciá el frontend.';
