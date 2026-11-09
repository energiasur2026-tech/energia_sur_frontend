/** Keep the user's text untouched; grouping is only applied to derived labels. */
export function parseGoalText(text:string):number|null{
 const raw=text.trim();if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d*)?$/.test(raw))return null;
 const value=Number(raw.replaceAll('.','').replace(',','.'));return Number.isFinite(value)&&value>0?value:null;
}
export function editableGoalNumber(value:number){return new Intl.NumberFormat('es-AR',{maximumFractionDigits:6,useGrouping:true}).format(value);}
