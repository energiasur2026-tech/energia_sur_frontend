/** API types only. Rates, taxes, credits and conversions live exclusively in backend. */
export interface TariffTier { minKwh:number;maxKwh:number;cargoFijo:number;valorTramo:number }
export type ElectricityBreakdown={category:string;segment:string;version:string;effectiveFrom:string|null;source:string;fixedCharge:number;variableCharge:number;subtotal:number;knownTotal:number;totalElectricity:number|null;pending:string[];lines:{id:string;label:string;amount:number;kind:string}[];credits:{amount:number}[];taxes:{amount:number}[];excludedServices:string[]};
export type EnergyCost={tier:TariffTier;fixedCharge:number;variableCharge:number;total:number;breakdown?:ElectricityBreakdown;warning?:string};
