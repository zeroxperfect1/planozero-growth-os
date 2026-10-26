import { convert } from './domain.mjs';
export function calculateQuote({lines,extraCost=0,commission=30,margin=0,currency='CLP',eurUsd,usdClp}) {
  if(!Array.isArray(lines)||!lines.length)throw new Error('Agrega al menos un perfil.');
  for(const line of lines) if(!Number.isFinite(line.hours)||line.hours<=0||!Number.isFinite(line.rate)||line.rate<=0)throw new Error('Cada perfil requiere horas y una tarifa mayor a cero.');
  if(!Number.isFinite(extraCost)||extraCost<0||![commission,margin].every(v=>Number.isFinite(v)&&v>=0)||commission+margin>=100)throw new Error('Comisión y margen deben sumar menos de 100%.');
  if(!['CLP','USD','EUR'].includes(currency)||!(eurUsd>0)||!(usdClp>0))throw new Error('Configura las tasas de cambio.');
  const hours=lines.reduce((s,l)=>s+l.hours,0);
  const labor=lines.reduce((s,l)=>s+l.hours*convert(l.rate,l.currency,currency,{eurUsd,usdClp}),0);
  const direct=labor+extraCost;
  const round=v=>Math.round(v*(currency==='CLP'?1:100))/(currency==='CLP'?1:100);
  const net=round(direct/(1-(commission+margin)/100));
  const fee=round(net*commission/100);
  return {hours,labor:round(labor),direct:round(direct),net,fee,profit:round(net-direct-fee)};
}
