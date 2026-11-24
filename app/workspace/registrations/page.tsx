import {redirect} from 'next/navigation';
import {getUser} from '@/lib/auth';
import {registrationList} from '@/lib/registration-list';
import {RegistrationCard} from './registration-card';
import '../demo-requests/inbox.css';
import './registrations.css';
export const dynamic='force-dynamic';
export const metadata={title:'Registration keys | Tejasvi Campus',robots:{index:false,follow:false}};

export default async function Page(){
 const u=await getUser();if(!u)redirect('/login');if(u.mustChangePassword)redirect('/change-password');if(!u.platformAdmin)redirect('/workspaces');
 const list=await registrationList(),count=(s:string)=>list.filter(r=>r.status===s).length,attention=count('expired')+count('missing');
 return <main className="tr-inbox"><div className="tr-wrap"><header><a href="/workspaces">← My workspaces</a><span>Platform Super Admin</span></header>
  <p className="tr-kicker">TEJASVI CAMPUS / LICENSING</p><h1>Registration keys</h1>
  <p>Each school and college needs a valid registration key. When a key expires, nobody at that institution can open Learning, EMIS or the mobile app until you renew it. Their records are kept. Renewing creates a new key for the academic year and retires the old one.</p>
  {list.length>0&&<dl className="rg-summary"><div><dt>Active</dt><dd>{count('active')}</dd></div><div><dt>Expiring within 30 days</dt><dd>{count('expiring')}</dd></div><div className={attention?'rg-alert':''}><dt>Locked</dt><dd>{attention}</dd></div></dl>}
  {list.length?<div className="tr-list">{list.map(r=><RegistrationCard key={r.id+':'+(r.key||'none')} row={r}/>)}</div>:<section className="tr-empty"><h2>No schools or colleges yet</h2><p>A key is created automatically when you create a school or college from My workspaces.</p></section>}
 </div></main>;
}
