export type SupplyHelpContext={province:string;locality:string;provider:string};
export type CategoryProposal={code:string;label:string;inputText:string;pricingAvailable:boolean};
export type CategoryHelpRequest={requestId:string;meterSelection:string|null;context:SupplyHelpContext};
export type CategoryHelpApply=CategoryHelpRequest&{proposal:CategoryProposal;ack:(applied:boolean,message?:string)=>void};
export const CATEGORY_HELP_OPEN='energia:lumi-category-help';
export const CATEGORY_HELP_APPLY='energia:lumi-category-apply';
export function sameSupplyContext(a:SupplyHelpContext,b:SupplyHelpContext){return a.province===b.province&&a.locality.trim()===b.locality.trim()&&a.provider===b.provider;}
