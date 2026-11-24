// Registration keys for schools and colleges. Shared by Next Learning, EMIS and the mobile API.
// An organization is registered when it has an unrevoked key whose expiry date (inclusive) has not passed.
import {randomBytes} from 'node:crypto';
import {bsToAd,bsMonthDays,bsYearOf,BS_FIRST,BS_LAST} from '../modules/emis/shared/bs.mjs';

export const registeredKinds=['school','college'];
export const requiresRegistration=kind=>registeredKinds.includes(kind);
export const expiredMessage='This institution’s Tejasvi registration has expired. Ask the Tejasvi Super Admin to renew the registration key for the new academic year.';

// 32 letters and digits without 0/O and 1/I, so a key can be read out over the phone.
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newRegistrationKey(){const bytes=randomBytes(16);let s='';for(const b of bytes)s+=alphabet[b%32];return 'TJ-'+s.match(/.{4}/g).join('-');}

/** Today's date (YYYY-MM-DD) on this server's clock, which is the institution's local date. */
export function today(now=new Date()){const p=n=>String(n).padStart(2,'0');return now.getFullYear()+'-'+p(now.getMonth()+1)+'-'+p(now.getDate());}

/** Default expiry for an academic year stored as '2026/27': the last day of Chaitra of that BS year, in AD. */
export function academicYearEnd(year){const bs=bsYearOf(year);if(!Number.isInteger(bs)||bs<BS_FIRST||bs>BS_LAST)return '';return bsToAd(bs,12,bsMonthDays(bs,12));}

/**
 * SQL that is 1 when organization alias `o` may be used today. Takes one parameter: today().
 * Corporate and EdTech organizations do not need a key.
 */
export const registeredSql=(o='o')=>`(${o}.kind NOT IN ('school','college') OR EXISTS(SELECT 1 FROM organization_registrations rg WHERE rg.org_id=${o}.id AND rg.revoked_at IS NULL AND rg.expires_on>=?))`;

/** Columns describing the current key of organization alias `o`, for listings. */
export const currentKeySql=(o='o')=>`(SELECT rg.registration_key FROM organization_registrations rg WHERE rg.org_id=${o}.id AND rg.revoked_at IS NULL ORDER BY rg.issued_at DESC LIMIT 1) AS registrationKey,(SELECT rg.expires_on FROM organization_registrations rg WHERE rg.org_id=${o}.id AND rg.revoked_at IS NULL ORDER BY rg.issued_at DESC LIMIT 1) AS registrationExpiresOn,(SELECT rg.academic_year FROM organization_registrations rg WHERE rg.org_id=${o}.id AND rg.revoked_at IS NULL ORDER BY rg.issued_at DESC LIMIT 1) AS registrationYear`;

/** Days from today until the inclusive expiry date: 0 on the last valid day, negative once expired. */
export function daysLeft(expiresOn,on=today()){if(!expiresOn)return null;return Math.round((Date.parse(String(expiresOn).slice(0,10)+'T00:00:00Z')-Date.parse(on+'T00:00:00Z'))/864e5);}

/** Checks an expiry date chosen by the Super Admin. Returns an error message, or '' when valid. */
export function expiryProblem(expiresOn,on=today()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn||'')||Number.isNaN(Date.parse(expiresOn+'T00:00:00Z'))||new Date(expiresOn+'T00:00:00Z').toISOString().slice(0,10)!==expiresOn)return 'Choose a valid expiry date.';
 const d=daysLeft(expiresOn,on);if(d<0)return 'The expiry date must be today or later.';if(d>2*366)return 'A registration key can be valid for at most two years.';
 return '';
}

/**
 * Revokes the current key and issues a new one on the caller's transaction.
 * `exec(sql, values)` runs a statement on that transaction. Returns the new key.
 */
export async function issueRegistration(exec,{id,orgId,academicYear,expiresOn,userId}){
 await exec('UPDATE organization_registrations SET revoked_at=UTC_TIMESTAMP(3),revoked_by=? WHERE org_id=? AND revoked_at IS NULL',[userId,orgId]);
 for(let attempt=0;;attempt++){const key=newRegistrationKey();try{await exec('INSERT INTO organization_registrations(id,org_id,registration_key,academic_year,valid_from,expires_on,issued_by) VALUES(?,?,?,?,?,?,?)',[id,orgId,key,academicYear,today(),expiresOn,userId]);return key;}catch(e){if(e?.code!=='ER_DUP_ENTRY'||attempt>=4)throw e;}}
}
