import {mkdtempSync,mkdirSync,writeFileSync,createWriteStream,chmodSync,existsSync,cpSync,unlinkSync,renameSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {verified,mysql,ownUploads,root,kind,label,explain} from './common.mjs';
process.umask(0o077);
let c,client,tmp;
try{
 const {db}=await verified();c=await mysql.createConnection(db);
 const [tables]=await c.execute("SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME",[db.database]);await c.end();c=null;
 const target=join(root,'backups',new Date().toISOString().replace(/[:.]/g,'-'));mkdirSync(target,{recursive:true,mode:0o700});
 client=join(target,'.mysql-client.cnf');const q=v=>'"'+String(v).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n')+'"';
 writeFileSync(client,'[client]\n'+Object.entries({host:db.host,port:db.port,user:db.user,password:db.password}).map(([k,v])=>k+'='+q(v)).join('\n')+'\n',{mode:0o600,flag:'wx'});
 const names=tables.map(r=>r.name).filter(n=>!['sessions','rate_limits'].includes(n)&&/^[a-zA-Z0-9_]+$/.test(n));
 tmp=join(target,'database.partial.sql');
 const args=['--defaults-extra-file='+client,'--protocol=TCP','--single-transaction','--no-tablespaces','--hex-blob','--set-gtid-purged=OFF'];
 async function dump(append,opts,tables){if(!tables.length)return;const child=spawn('mysqldump',[...args,...opts,db.database,...tables],{stdio:['ignore','pipe','inherit']});
  await Promise.all([new Promise((ok,no)=>{child.once('error',no);child.once('close',code=>code===0?ok():no(Error('mysqldump exited with status '+code)));}),pipeline(child.stdout,createWriteStream(tmp,{flags:append?'a':'wx',mode:0o600}))]);}
 await dump(false,[],names);await dump(true,['--no-data'],tables.map(r=>r.name).filter(n=>['sessions','rate_limits'].includes(n)));
 const storage=join(root,'storage');if(existsSync(storage))cpSync(storage,join(target,'storage'),{recursive:true});
 writeFileSync(join(target,'RESTORE.txt'),'This is a private backup of '+label+' database '+db.database+'. Keep its matching project configuration (.env) securely and separately. For disaster recovery, stop the app and ask your MySQL administrator to restore the dump into an empty recovery database, with the saved runtime account and the same installation marker. Session and rate-limit table definitions are included without active sessions. Restore the storage directory, which includes Learning files and separate institutional EMIS uploads. Do not use the fresh-start launcher to import this backup or import a dump over an operating installation.\n',{mode:0o600});
 renameSync(tmp,join(target,'database.sql'));tmp=null;console.log('Backup complete: '+target);
}catch(e){console.error(e.code==='ENOENT'?'mysqldump was not found. Add the MySQL client tools to PATH. No completed backup was produced.':explain(e));process.exitCode=1;}finally{await c?.end().catch(()=>{});if(client&&existsSync(client))unlinkSync(client);if(tmp&&existsSync(tmp))unlinkSync(tmp);}
