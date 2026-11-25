import {rows} from './db';
import {today,daysLeft} from './registration.mjs';

export type RegistrationRow={id:string;name:string;kind:string;emis:boolean;campusYear:string;key:string|null;academicYear:string|null;expiresOn:string|null;issuedAt:string|null;daysLeft:number|null;status:'active'|'expiring'|'expired'|'missing';history:{key:string;academicYear:string;expiresOn:string;issuedAt:string;revokedAt:string|null}[]};

/** Every school and college with its current key and earlier keys, for the Super Admin. */
export async function registrationList():Promise<RegistrationRow[]>{
 const orgs=await rows("SELECT o.id,o.name,o.kind,o.emis,JSON_UNQUOTE(JSON_EXTRACT(c.profile,'$.year')) AS campusYear FROM organizations o LEFT JOIN emis_campuses c ON c.org_id=o.id WHERE o.kind IN ('school','college') ORDER BY o.name");
 const keys=orgs.length?await rows(`SELECT org_id,registration_key,academic_year,expires_on,issued_at,revoked_at FROM organization_registrations WHERE org_id IN (${orgs.map(()=>'?').join(',')}) ORDER BY issued_at DESC`,orgs.map(o=>o.id)):[];
 const now=today();
 return orgs.map(o=>{
  const mine=keys.filter(k=>k.org_id===o.id),current=mine.find(k=>!k.revoked_at)||null,left=current?daysLeft(current.expires_on,now):null;
  const status=!current?'missing':left!<0?'expired':left!<=30?'expiring':'active';
  return {id:o.id,name:o.name,kind:o.kind,emis:!!Number(o.emis),campusYear:o.campusYear||'',key:current?.registration_key||null,academicYear:current?.academic_year||null,expiresOn:current?String(current.expires_on).slice(0,10):null,issuedAt:current?.issued_at||null,daysLeft:left,status,
   history:mine.filter(k=>k!==current).slice(0,10).map(k=>({key:k.registration_key,academicYear:k.academic_year,expiresOn:String(k.expires_on).slice(0,10),issuedAt:k.issued_at,revokedAt:k.revoked_at}))};
 });
}
