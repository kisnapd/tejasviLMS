import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const root=fileURLToPath(new URL('../',import.meta.url));
dotenv.config({path:path.join(root,'.env.local'),quiet:true});
dotenv.config({path:path.join(root,'.env'),quiet:true});
export function databaseConfig(){if(!process.env.DATABASE_NAME||!process.env.DATABASE_USER)throw new Error('Open Start-Tejasvi.command to set up this project.');return {host:process.env.DATABASE_HOST||'127.0.0.1',port:Number(process.env.DATABASE_PORT||3306),user:process.env.DATABASE_USER,password:process.env.DATABASE_PASSWORD||'',database:process.env.DATABASE_NAME,charset:'utf8mb4',timezone:'Z'}}
