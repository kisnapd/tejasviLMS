'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {adYearOfBs,bsMonthDays,bsToAd,bsYearOf,currentBsYear,formatBs,normalizeAcademicYear} from '@/modules/emis/shared/bs.mjs';
import type {RegistrationRow} from '@/lib/registration-list';

const headers={'Content-Type':'application/json','x-tejasvi-request':'1'};
const labels={active:'Active',expiring:'Expiring soon',expired:'Expired · locked',missing:'No key · locked'} as const;
function yearEnd(stored:string){try{const bs=bsYearOf(stored);return bsToAd(bs,12,bsMonthDays(bs,12));}catch{return '';}}
function ad(iso:string|null){if(!iso)return '';return new Date(iso.slice(0,10)+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});}
function when(iso:string|null){if(!iso)return '';const bs=formatBs(iso.slice(0,10));return ad(iso)+(bs?' ('+bs+' BS)':'');}
const bsLabel=(stored:string|null)=>stored?bsYearOf(stored)+' BS':'';
/** Next academic year after the current key's year, or the current year when there is no key or it has passed. */
function suggestedYear(row:RegistrationRow){const now=currentBsYear(),from=row.academicYear?bsYearOf(row.academicYear):0;return String(row.status==='active'||row.status==='expiring'?Math.max(from+1,now):Math.max(from,now));}

export function RegistrationCard({row}:{row:RegistrationRow}){
 const router=useRouter(),[open,setOpen]=useState(false),[year,setYear]=useState(()=>suggestedYear(row)),[date,setDate]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[issued,setIssued]=useState('');
 const stored=normalizeAcademicYear(year),expires=date||(stored?yearEnd(stored):'');
 async function send(body:object){setBusy(true);setError('');try{const r=await fetch('/api/registrations',{method:'POST',headers,body:JSON.stringify({orgId:row.id,...body})}),b=await r.json();if(!r.ok)throw Error(b.error||'The key could not be saved.');return b;}catch(e){setError((e as Error).message);return null;}finally{setBusy(false);}}
 async function renew(e:React.FormEvent){e.preventDefault();const b=await send({action:'renew',academicYear:year,expiresOn:expires});if(b){setIssued(b.key);setOpen(false);router.refresh();}}
 async function revoke(){if(!confirm('Revoke the key for '+row.name+'? Everyone at this institution is locked out immediately, until you issue a new key.'))return;if(await send({action:'revoke'}))router.refresh();}
 return <article id={'org-'+row.id} className={'rg-card rg-'+row.status}><div>
  <p className="tr-meta">{row.kind}{row.campusYear?' · EMIS year '+bsLabel(row.campusYear):''}</p>
  <h2>{row.name}</h2>
  <p className={'rg-status rg-status-'+row.status}>{labels[row.status]}{row.daysLeft!==null&&row.daysLeft>=0&&row.daysLeft<=30?` · ${row.daysLeft===0?'last day today':row.daysLeft+' day'+(row.daysLeft===1?'':'s')+' left'}`:''}</p>
  {row.key?<dl className="rg-key"><div><dt>Key</dt><dd><code>{row.key}</code></dd></div><div><dt>Academic year</dt><dd>{bsLabel(row.academicYear)} ({row.academicYear})</dd></div><div><dt>Valid until</dt><dd>{when(row.expiresOn)}</dd></div></dl>:<p>This institution has no current key.</p>}
  {issued&&<p className="rg-issued" role="status">New key issued: <code>{issued}</code>. Give it to the institution’s administrator.</p>}
  {row.history.length>0&&<details className="rg-history"><summary>Earlier keys ({row.history.length})</summary><ul>{row.history.map(h=><li key={h.key}><code>{h.key}</code> · {bsLabel(h.academicYear)} · until {ad(h.expiresOn)}{h.revokedAt?' · retired '+ad(h.revokedAt):''}</li>)}</ul></details>}
  {open&&<form className="rg-form" onSubmit={renew}>
   <label>Academic year (BS)<input value={year} required maxLength={12} inputMode="numeric" onChange={e=>{setYear(e.currentTarget.value);setDate('');}} aria-describedby={'yr-'+row.id}/></label>
   <small id={'yr-'+row.id}>{stored?'Baishakh to Chaitra '+bsYearOf(stored)+' · AD '+adYearOfBs(bsYearOf(stored)):'Enter a year such as '+currentBsYear()+'.'}</small>
   <label>Valid until<input type="date" required value={expires} onChange={e=>setDate(e.currentTarget.value)}/></label>
   <small>{expires&&formatBs(expires)?'Last valid day: '+formatBs(expires)+' BS':'Prefilled with the last day of Chaitra. Change it if needed.'}</small>
   <div className="rg-actions"><button type="submit" disabled={busy||!stored||!expires}>{busy?'Saving…':row.key?'Issue renewal key':'Issue key'}</button><button type="button" className="rg-secondary" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button></div>
   {row.key&&<small>The current key {row.key} stops working as soon as the new key is issued.</small>}
  </form>}
  {error&&<p role="alert" className="rg-error">{error}</p>}
 </div>
 {!open&&<div className="rg-actions rg-side"><button type="button" disabled={busy} onClick={()=>{setOpen(true);setIssued('');}}>{row.key?'Renew':'Issue key'}</button>{row.key&&<button type="button" className="rg-danger" disabled={busy} onClick={revoke}>Revoke</button>}</div>}
 </article>;
}
