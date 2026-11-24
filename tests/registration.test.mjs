import test from 'node:test';
import assert from 'node:assert/strict';
import {newRegistrationKey,today,academicYearEnd,daysLeft,expiryProblem,issueRegistration,registeredSql,requiresRegistration} from '../lib/registration.mjs';

test('keys are unique, readable and well formed', () => {
  const keys = new Set(Array.from({length: 2000}, newRegistrationKey));
  assert.equal(keys.size, 2000);
  for (const k of keys) assert.match(k, /^TJ-[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
});

test('only schools and colleges need a key', () => {
  assert.equal(requiresRegistration('school'), true);
  assert.equal(requiresRegistration('college'), true);
  assert.equal(requiresRegistration('corporate'), false);
  assert.equal(requiresRegistration('edtech'), false);
  assert.match(registeredSql('o'), /o\.kind NOT IN \('school','college'\)/);
  assert.equal(registeredSql('o').split('?').length - 1, 1);
});

test('default expiry is the last day of Chaitra', () => {
  // Follows the EMIS calendar in modules/emis/shared/bs.mjs: 30 Chaitra 2083 is 14 April 2027.
  assert.equal(academicYearEnd('2026/27'), '2027-04-14');
  assert.equal(academicYearEnd('2023/24'), '2024-04-12');
  assert.equal(academicYearEnd('1990/91'), '');
});

test('expiry date is inclusive', () => {
  assert.equal(daysLeft('2027-04-13', '2027-04-13'), 0);
  assert.equal(daysLeft('2027-04-13', '2027-04-14'), -1);
  assert.equal(daysLeft('2027-04-13', '2027-04-03'), 10);
  assert.equal(today(new Date(2026, 0, 5)), '2026-01-05');
});

test('expiry validation', () => {
  const on = '2026-11-24';
  assert.equal(expiryProblem('2027-04-13', on), '');
  assert.equal(expiryProblem('2026-11-24', on), '');
  assert.match(expiryProblem('2026-11-23', on), /today or later/);
  assert.match(expiryProblem('2029-12-31', on), /two years/);
  assert.match(expiryProblem('2027-02-30', on), /valid/);
  assert.match(expiryProblem('', on), /valid/);
});

test('renewal retires the old key before issuing a new one, and retries a clashing key', async () => {
  const calls = [];
  let clash = true;
  const exec = async (sql, values) => {
    calls.push([sql.split(' ')[0], values]);
    if (sql.startsWith('INSERT') && clash) { clash = false; throw Object.assign(new Error('dup'), {code: 'ER_DUP_ENTRY'}); }
  };
  const key = await issueRegistration(exec, {id: 'r1', orgId: 'o1', academicYear: '2026/27', expiresOn: '2027-04-13', userId: 'u1'});
  assert.equal(calls[0][0], 'UPDATE');
  assert.deepEqual(calls[0][1], ['u1', 'o1']);
  assert.equal(calls.filter(c => c[0] === 'INSERT').length, 2);
  assert.equal(calls.at(-1)[1][2], key);
  assert.equal(calls.at(-1)[1][5], '2027-04-13');
});
