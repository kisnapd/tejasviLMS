import mysql from 'mysql2/promise';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {parse} from 'dotenv';
import {randomBytes,scryptSync} from 'node:crypto';
import {kind} from './product.mjs';
export {mysql,kind};
export const learning=true,label='Tejasvi',port=3000;
export const root=fileURLToPath(new URL('../',import.meta.url)), envFile=resolve(root,'.env');
export const configName=learning?'DATABASE_NAME':'MYSQL_DATABASE',prefix=learning?'DATABASE_':'MYSQL_';
export const ownUploads=resolve(root,learning?'storage/uploads':'data/uploads');
export function id(s){if(!/^[A-Za-z0-9_]{1,64}$/.test(s))throw Error('Use only letters, digits and underscores for database names.');return '\u0060'+s+'\u0060';}
export function settings(){
 if(!existsSync(envFile))throw Error('This folder has not been set up. Open its Start launcher first.');
 if(existsSync(resolve(root,'.env.local')))throw Error('This standalone folder must use its own .env; move any .env.local from an older project out of this folder.');
 const env=parse(readFileSync(envFile));if(env.TEJASVI_EDITION!=='campus-v1'||env.TEJASVI_STANDALONE!==kind||!/^([a-f0-9]{32})$/.test(env.STANDALONE_ID||''))throw Error('This is not the configuration made by this Tejasvi launcher. Use a fresh extraction; do not copy an old .env.');
 const db={host:env[prefix+'HOST'],port:Number(env[prefix+'PORT']),user:env[prefix+'USER'],password:env[prefix+'PASSWORD'],database:env[configName],charset:'utf8mb4',timezone:'Z'};
 const origin=new URL(env.APP_URL);if(origin.origin!=='http://localhost:'+port)throw Error('For the local pilot, restore APP_URL=http://localhost:'+port+' in this folder’s .env.');
 return {env,db,origin:origin.origin};
}
export async function verified(){const c=settings(),db=await mysql.createConnection(c.db);try{const [[r]]=await db.query('SELECT product,instance_id,owner_claimed FROM tejasvi_clean_install WHERE id=1');if(!r||r.product!==kind||r.instance_id!==c.env.STANDALONE_ID)throw Error('The selected database is not the new database created for this folder.');return {...c,firstOwner:!Number(r.owner_claimed)};}finally{await db.end();}}
export const validEmail=s=>s.length<=200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export async function newPassword(p){const value=await p.secret('New password for this account (12–128 characters)'),again=await p.secret('Confirm that new password');if(value!==again||value.length<12||value.length>128)throw Error('The two passwords must match and be 12–128 characters.');return value;}
export function verifier(password){const salt=randomBytes(16).toString('hex');return (learning?'scrypt:':'')+salt+':'+scryptSync(password,salt,64,{N:learning?32768:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex');}
export function explain(e){
 const help={ECONNREFUSED:'MySQL is not running at that address. Start it on your Mac, then open the same launcher again.',ER_ACCESS_DENIED_ERROR:'MySQL did not accept that database username/password. Enter the MySQL administrator password, not an LMS or EMIS login.',ER_DBACCESS_DENIED_ERROR:'The MySQL administrator needs permission to create a new database, create a database user, and grant access to that database.',ER_SPECIFIC_ACCESS_DENIED_ERROR:'Use a local MySQL administrator who can create a database, a user and grant access.',ER_BAD_DB_ERROR:'That MySQL database name was not found.',EADDRINUSE:'The local web address is in use. Stop the old copy with Control+C, then reopen this launcher.'};
 return help[e?.code]||(!e?.sql&&!e?.sqlMessage?e?.message:null)||('MySQL could not finish ('+(e?.code||'database error')+').');
}
