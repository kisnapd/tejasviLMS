import { rows } from './db';
import { loginDestination } from './login-destination';
import { registeredSql, today } from './registration.mjs';

/**
 * Where a person lands after signing in.
 * Someone in exactly one usable organization goes straight to it (through /enter, which picks
 * EMIS or Learning and sets the brand). Everyone else chooses on My workspaces.
 */
export async function signInHome(userId:string,platformAdmin:boolean):Promise<string|null>{
 const orgs=await rows(`SELECT o.id,o.kind,o.emis,m.role,r.role erpRole,${registeredSql('o')} registered FROM institution_memberships m JOIN organizations o ON o.id=m.org_id LEFT JOIN emis_roles r ON r.org_id=m.org_id AND r.user_id=m.user_id WHERE m.user_id=? AND m.active=1`,[today(),userId]);
 if(platformAdmin)return orgs.length?'/workspaces':loginDestination(null,true);
 const usable=orgs.filter(o=>(Number(o.registered)||platformAdmin)&&orgHome(o as {id:string;kind:string;role:string;erpRole?:string|null;emis:number}));
 if(usable.length===1)return '/enter/'+usable[0].id;
 if(orgs.length)return '/workspaces';
 return loginDestination(null,platformAdmin);
}

/**
 * The home for one membership. School and college members with an EMIS role start in EMIS,
 * where their daily work (attendance, homework, marks, fees, results) is. Others start in Learning.
 */
export function orgHome(m:{id:string;kind:string;role:string;erpRole?:string|null;emis?:number|boolean},prefer?:'learning'|'emis'):string|null{
 const edu=m.kind==='school'||m.kind==='college',emis=edu&&m.erpRole&&Number(m.emis)?'/erp/'+m.id+'/':null,learning=loginDestination({kind:m.kind,role:m.role},false);
 if(prefer==='learning')return learning||emis;
 return emis||learning;
}
