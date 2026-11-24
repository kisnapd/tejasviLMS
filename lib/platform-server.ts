import { one, type DB } from './db';
import { registeredSql, today, expiredMessage } from './registration.mjs';
import { roles, type RoleKey } from './platform-types';
import { AppError } from './errors';
export { AppError, respond, failure, readJson, checkWrite, boundedBody } from './errors';
export { identity } from './auth';
export async function membership(orgId:string,userId:string){const row=await one<{id:string;name:string;kind:string;role:string;registered:number;platformAdmin:number}>(`SELECT o.id,o.name,o.kind,m.role,${registeredSql('o')} AS registered,u.platform_admin AS platformAdmin FROM organizations o JOIN memberships m ON o.id=m.org_id JOIN users u ON u.id=m.user_id WHERE o.id=? AND m.user_id=?`,[today(),orgId,userId]);if(row?.role==='parent')throw new AppError('This role is no longer available. Contact your administrator.',403);if(!row)throw new AppError('You do not have access to this organization.',403);if(!Number(row.registered)&&!Number(row.platformAdmin))throw new AppError(expiredMessage,403);const {registered:_r,platformAdmin:_p,...member}=row;return member}
/** Throws when a school or college has no valid registration key, unless the user is the platform Super Admin. */
export async function assertRegistered(orgId:string,userId:string,db?:DB){const row=await one(`SELECT ${registeredSql('o')} AS registered,(SELECT platform_admin FROM users WHERE id=?) AS platformAdmin FROM organizations o WHERE o.id=?`,[today(),userId,orgId],db);if(row&&!Number(row.registered)&&!Number(row.platformAdmin))throw new AppError(expiredMessage,403)}
export function canEdit(m:{kind:string;role:string}){if(m.role!=='admin'&&!(['school','college','edtech'].includes(m.kind)&&m.role==='teacher'))throw new AppError('Only administrators and teachers can change learning content.',403)}
export function requireAdmin(m:{role:string}){if(m.role!=='admin')throw new AppError('Administrator access is required.',403)}
export function checkRole(value:string):RoleKey{if(!Object.hasOwn(roles,value))throw new AppError('Choose a valid workspace.');return value as RoleKey}
export function jsonValue(value:unknown){return typeof value==='string'?JSON.parse(value):value}
