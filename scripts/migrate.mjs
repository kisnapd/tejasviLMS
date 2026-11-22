import mysql from 'mysql2/promise';
import { readdir,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { root,databaseConfig } from './config.mjs';
export async function migrate(config=databaseConfig(),{quiet=false}={}){
 const c=await mysql.createConnection(config);let locked=false;
 try{
  const [locks]=await c.execute("SELECT GET_LOCK(?,15) AS acquired",['tejasvi:migrate:'+config.database]);if(!locks[0].acquired)throw new Error('Another migration is running. Try again shortly.');locked=true;
  await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(150) PRIMARY KEY, checksum CHAR(64) NOT NULL, status VARCHAR(20) NOT NULL, applied_at DATETIME(3) NULL) ENGINE=InnoDB');
  const directory=path.join(root,'database/migrations'),files=(await readdir(directory)).filter(f=>f.endsWith('.sql')).sort();
  for(const file of files){const sql=await readFile(path.join(directory,file),'utf8'),checksum=createHash('sha256').update(sql).digest('hex');const [previous]=await c.execute('SELECT * FROM schema_migrations WHERE name=?',[file]);
   if(previous.length){if(previous[0].status!=='applied')throw new Error(`${file} was interrupted. MySQL DDL is not transactional. Inspect the existing schema before repair; do not delete migration records blindly.`);if(previous[0].checksum!==checksum)throw new Error(`Applied migration ${file} has changed. Restore it; add a new migration for changes.`);if(!quiet)console.log('Already applied:',file);continue}
   await c.execute('INSERT INTO schema_migrations(name,checksum,status) VALUES(?,?,?)',[file,checksum,'running']);
   // Migration files contain only plain schema statements; no routines or quoted semicolons.
   const statements=sql.split(';').map(s=>s.trim()).filter(Boolean);for(const statement of statements)await c.query(statement);
   await c.execute("UPDATE schema_migrations SET status='applied',applied_at=UTC_TIMESTAMP(3) WHERE name=?",[file]);console.log('Applied:',file);
  }
  await c.query('DELETE FROM sessions WHERE expires_at<UTC_TIMESTAMP(3)');await c.execute('DELETE FROM rate_limits WHERE reset_at<?',[Date.now()]);
 }finally{if(locked)await c.execute('SELECT RELEASE_LOCK(?)',['tejasvi:migrate:'+config.database]);await c.end()}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){try{await migrate();console.log('Database is ready.')}catch(e){console.error('Migration failed:',e.message);process.exitCode=1}}
