import {randomBytes} from 'node:crypto';
import {existsSync,writeFileSync,readdirSync,unlinkSync,linkSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mysql,root,envFile,kind,label,port,learning,id,prefix,configName,explain} from './common.mjs';
import {adapter} from './adapter.mjs';
import {prompts} from './prompts.mjs';
export const databaseBase='tejasvi_campus_new';
function assertEmptyFolder(){
 if(existsSync(envFile))throw Error('This folder already has database settings. Open its Start launcher to use it. For another blank installation, unzip into a new folder.');
 if(readdirSync(root).some(n=>/^\.env\./.test(n)&&!n.endsWith('.example')))throw Error('This folder contains settings from another installation. Extract the clean ZIP into a new folder.');
 for(const n of ['storage','data']){const p=resolve(root,n);if(existsSync(p)&&readdirSync(p).length)throw Error('This folder already contains application storage. Extract the clean ZIP into a new folder.');}
}
// No option accepts a source database or a path to another project. An existing database is never opened.
export async function provision(admin,adminCfg){
 assertEmptyFolder();const [[{version}]]=await admin.query('SELECT VERSION() version');if(/mariadb/i.test(version)||parseInt(version,10)<8)throw Error('Start a MySQL 8 or newer server.');
 let dbName,hasUser=false,published=false,run,tmp;
 const name='tj_'+randomBytes(8).toString('hex'),acct="'"+name+"'@'localhost'",pass=randomBytes(32).toString('hex')+'qA7!',instance=randomBytes(16).toString('hex');
 try{
  for(let n=1;n<=10000;n++){
   const candidate=databaseBase+(n===1?'':'_'+n);
   try{await admin.query('CREATE DATABASE '+id(candidate)+' CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');dbName=candidate;break;}
   catch(e){if(e.code!=='ER_DB_CREATE_EXISTS')throw e;}
  }
  if(!dbName)throw Error('No unused database name is available for this app.');
  await admin.query('CREATE USER '+acct+' IDENTIFIED BY ?', [pass]);hasUser=true;
  let partial=0;try{const [[v]]=await admin.query('SELECT @@GLOBAL.partial_revokes v');partial=Number(v.v);}catch(e){if(e.code!=='ER_UNKNOWN_SYSTEM_VARIABLE')throw e;}
  // A grant for a literal underscore must not match neighboring database names.
  await admin.query('GRANT ALL PRIVILEGES ON '+(partial?id(dbName):id(dbName).replaceAll('_','\\_'))+'.* TO '+acct);
  const db={host:adminCfg.host,port:adminCfg.port,database:dbName,user:name,password:pass,charset:'utf8mb4',timezone:'Z'};
  await adapter.initialize(db);run=await mysql.createConnection(db);
  await run.query('CREATE TABLE tejasvi_clean_install (id TINYINT PRIMARY KEY, product VARCHAR(8) NOT NULL, instance_id CHAR(32) NOT NULL, owner_claimed TINYINT NOT NULL DEFAULT 0) ENGINE=InnoDB');
  await run.execute('INSERT INTO tejasvi_clean_install (id,product,instance_id) VALUES(1,?,?)',[kind,instance]);
  const env={TEJASVI_EDITION:'campus-v1',TEJASVI_STANDALONE:kind,STANDALONE_ID:instance,APP_URL:'http://localhost:'+port,[prefix+'HOST']:db.host,[prefix+'PORT']:db.port,[configName]:dbName,[prefix+'USER']:name,[prefix+'PASSWORD']:pass,...(learning?{UPLOAD_DIR:'./storage/uploads',INDEX_PUBLIC_SITE:'false',SESSION_DAYS:7}:{EMIS_DATA_DIR:'./data',EMIS_SECURE_COOKIES:0})};
  tmp=resolve(root,'.settings-'+instance+'.tmp');writeFileSync(tmp,Object.entries(env).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600,flag:'wx'});linkSync(tmp,envFile);published=true;return dbName;
 }finally{
  if(tmp&&existsSync(tmp))unlinkSync(tmp);await run?.end().catch(()=>{});
  // Only clean up resources that this operation successfully created. Never drop or alter an existing database.
  if(!published){if(dbName)await admin.query('DROP DATABASE '+id(dbName)).catch(()=>{});if(hasUser)await admin.query('DROP USER '+acct).catch(()=>{});}
 }
}
export async function setup(){
 assertEmptyFolder();const p=prompts();let c;try{
  console.log('\n'+label+' • Fresh installation\nThis creates an empty database for this app. Create your Super Admin first. Add a school, college, or company in the browser when ready.');
  const raw=await p.ask('Local MySQL port','3306'),user=await p.ask('MySQL administrator username','root'),password=await p.secret('MySQL administrator password (hidden; Return if blank)');
  if(!/^\d+$/.test(raw)||Number(raw)<1||Number(raw)>65535)throw Error('Enter a valid MySQL port.');
  const cfg={host:'127.0.0.1',port:Number(raw),user,password};c=await mysql.createConnection(cfg);
  const name=await provision(c,cfg);console.log('Created empty database: '+name+'. No account or college has been created.');
 }finally{await c?.end();p.close();}
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){try{await setup();}catch(e){console.error(explain(e));process.exitCode=1;}}
