// Isolated QA server for end-to-end testing.
//
//   npm run qa:server            start on http://localhost:3200 using the `tejasvi_qa` database
//   npm run qa:server -- --reset wipe the QA database and QA storage first (fresh install)
//
// It never touches the launcher's own database, storage/uploads or storage/emis:
// database  -> tejasvi_qa (same MySQL server and app user, see README in this folder)
// uploads   -> storage/qa/uploads
// EMIS data -> storage/qa/emis
// Paid/outbound integrations (OpenAI, Gamma, LiveAvatar, push) are switched off.
import {readFileSync,writeFileSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {parse} from 'dotenv';
import mysql from 'mysql2/promise';
import {root,kind} from '../../scripts/common.mjs';
import {migrate} from '../../scripts/migrate.mjs';

export const QA = {
  database: process.env.QA_DATABASE || 'tejasvi_qa',
  port: Number(process.env.QA_PORT || 3200),
  dir: resolve(root, 'storage/qa'),
};
QA.origin = 'http://localhost:' + QA.port;
QA.ownerKeyFile = resolve(QA.dir, 'owner-key.txt');

const live = parse(readFileSync(resolve(root, '.env')));
if (QA.database === live.DATABASE_NAME) throw Error('QA_DATABASE must not be the live database.');
const db = {host: live.DATABASE_HOST, port: Number(live.DATABASE_PORT), user: live.DATABASE_USER, password: live.DATABASE_PASSWORD, database: QA.database, charset: 'utf8mb4', timezone: 'Z'};

async function connect() {
  try { return await mysql.createConnection({...db, multipleStatements: false}); }
  catch (e) {
    if (e.code === 'ER_DBACCESS_DENIED_ERROR' || e.code === 'ER_BAD_DB_ERROR') {
      console.error(`\nThe QA database "${QA.database}" does not exist yet or this app's MySQL user cannot open it.\n` +
        `Create it once with your MySQL administrator password (see tests/qa/README.md):\n\n` +
        `  /usr/local/mysql/bin/mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS ${QA.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON ${QA.database}.* TO '${db.user}'@'localhost';"\n`);
      process.exit(1);
    }
    throw e;
  }
}

async function reset(c) {
  const [tables] = await c.query('SELECT table_name AS t FROM information_schema.tables WHERE table_schema=?', [QA.database]);
  await c.query('SET FOREIGN_KEY_CHECKS=0');
  for (const {t} of tables) await c.query('DROP TABLE IF EXISTS ' + mysql.escapeId(t));
  await c.query('SET FOREIGN_KEY_CHECKS=1');
  rmSync(QA.dir, {recursive: true, force: true});
  console.log(`QA database ${QA.database} wiped (${tables.length} tables).`);
}

const c = await connect();
try {
  if (process.argv.includes('--reset')) await reset(c);
  await c.query('CREATE TABLE IF NOT EXISTS tejasvi_clean_install (id TINYINT PRIMARY KEY, product VARCHAR(8) NOT NULL, instance_id CHAR(32) NOT NULL, owner_claimed TINYINT NOT NULL DEFAULT 0) ENGINE=InnoDB');
  await c.query("INSERT IGNORE INTO tejasvi_clean_install (id,product,instance_id) VALUES (1,?,?)", [kind, randomBytes(16).toString('hex')]);
} finally { await c.end(); }
await migrate(db, {quiet: true});

mkdirSync(resolve(QA.dir, 'uploads'), {recursive: true});
mkdirSync(resolve(QA.dir, 'emis'), {recursive: true});
// The first-owner key lets the test suite create the Super Admin through the real setup screen.
const ownerKey = randomBytes(18).toString('hex');
writeFileSync(QA.ownerKeyFile, ownerKey + '\n', {mode: 0o600});

Object.assign(process.env, {
  ...live,
  DATABASE_NAME: QA.database,
  APP_URL: QA.origin,
  UPLOAD_DIR: resolve(QA.dir, 'uploads'),
  INDEX_PUBLIC_SITE: 'false',
  TEJASVI_FIRST_OWNER_KEY: ownerKey,
  NEXT_TELEMETRY_DISABLED: '1',
  OPENAI_API_KEY: '', GAMMA_API_KEY: '', LIVEAVATAR_API_KEY: '', EXPO_ACCESS_TOKEN: '', MOBILE_PUSH: '',
});
if (!existsSync(resolve(root, '.next/BUILD_ID'))) { console.error('Run `npm run build` first.'); process.exit(1); }
const {startServer} = await import('../../scripts/server-core.mjs');
await startServer({db, origin: QA.origin}, {emisDir: resolve(QA.dir, 'emis')});
console.log(`QA server (database ${QA.database}) — first-owner setup: ${QA.origin}/login#setup=<key in storage/qa/owner-key.txt>`);
