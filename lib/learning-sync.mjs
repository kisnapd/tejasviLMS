// Mirrors the current academic year of EMIS into Learning.
//
// A cohort is a school class-section (Grade 6 · A) or a college program semester (BCA · Semester 3).
// Each cohort becomes one Learning batch. Each subject is created once per grade or semester, so its
// content is shared by every section. Students with a login join their cohort and all of its subjects;
// subject teachers are assigned to the sections they teach. Content written for a subject is linked
// to every batch that studies it, so learners see it without any manual enrolment.
//
// Batches created here are "managed": their members, subjects and teachers always follow EMIS.
// Batches made by hand in Learning are never touched. Safe to run any number of times.
import {randomUUID} from 'node:crypto';
import {one,many,json,educational} from './campus-data.mjs';

const ACTIVE = r => !r.status || r.status === 'Active';
const key = (...parts) => parts.join('|');

export async function syncLearning(c, org) {
  const campus = await one(c, "SELECT o.kind,e.profile->>'$.year' year FROM organizations o JOIN emis_campuses e ON e.org_id=o.id WHERE o.id=?", [org]);
  if (!campus || !educational(campus.kind)) return;
  const {year} = campus, school = campus.kind === 'school';
  const records = async (entity, global = false) => (await many(c, `SELECT id,data FROM emis_records WHERE org_id=? AND entity=? AND archived=0${global ? '' : ' AND year=?'}`, global ? [org, entity] : [org, entity, year])).map(r => ({...json(r.data), id: r.id}));

  // 1. Cohorts and what each one studies, read from EMIS.
  const cohorts = new Map(), offerings = [];
  if (school) {
    for (const k of (await records('classes')).filter(k => k.status !== 'Closed' && k.name))
      cohorts.set('class:' + k.id, {grade: {name: k.name}, section: String(k.section || '').trim(), label: `${k.name} ${k.section || ''}`.trim()});
    for (const s of await records('subjects')) if (s.name && cohorts.has('class:' + s.classId)) offerings.push({record: s.id, cohort: 'class:' + s.classId, name: s.name.trim(), code: s.code || '', teacher: s.teacherId});
  } else {
    const programs = new Map((await records('programs', true)).map(p => [p.id, p])), departments = new Map((await records('departments', true)).map(d => [d.id, d]));
    const cohortOf = (programId, semester) => {
      const p = programs.get(programId), n = Number(semester), d = p && departments.get(p.departmentId);
      if (!p || !d || !Number.isInteger(n) || n < 1 || n > 12) return null;
      const id = `program:${p.id}:${n}`;
      if (!cohorts.has(id)) cohorts.set(id, {grade: {name: 'Semester ' + n, program: p.name, faculty: d.name}, section: '', label: `${p.name} · Semester ${n}`});
      return id;
    };
    for (const s of await records('courses')) { const id = s.name && cohortOf(s.programId, s.semester); if (id) offerings.push({record: s.id, cohort: id, name: s.name.trim(), code: s.code || '', teacher: s.facultyId}); }
    for (const s of await records('students')) cohortOf(s.programId, s.semester);
  }

  // 2. Learning structure: grades (or semesters), sections, subjects and batches.
  const gradeIds = new Map();
  async function gradeId(g) {
    const k = key(g.faculty, g.program, g.name);
    if (gradeIds.has(k)) return gradeIds.get(k);
    let programId = null;
    if (g.program) {
      const faculty = await ensure(c, 'faculties', {org_id: org, name: g.faculty});
      programId = await ensure(c, 'programs', {org_id: org, faculty_id: faculty, name: g.program});
    }
    const id = await ensure(c, 'grades', {org_id: org, program_id: programId, name: g.name});
    gradeIds.set(k, id);
    return id;
  }
  const links = new Map((await many(c, 'SELECT cohort_key,batch_id FROM emis_cohort_links WHERE org_id=?', [org])).map(r => [r.cohort_key, r.batch_id]));
  const batchOf = new Map();
  for (const [id, h] of cohorts) {
    const grade = await gradeId(h.grade), linkKey = key(year, id);
    let batch = links.get(linkKey);
    if (!batch) {
      const section = h.section ? await ensure(c, 'sections', {org_id: org, grade_id: grade, name: h.section}) : null;
      let name = `${h.label} · ${year}`;
      if (await one(c, 'SELECT id FROM batches WHERE org_id=? AND name=?', [org, name])) name += ' · ' + id.slice(-6);
      batch = randomUUID();
      await c.execute('INSERT INTO batches(id,org_id,name,grade_id,section_id,academic_year) VALUES(?,?,?,?,?,?)', [batch, org, name.slice(0, 120), grade, section, year]);
      await c.execute('INSERT INTO emis_cohort_links(org_id,cohort_key,batch_id) VALUES(?,?,?)', [org, linkKey, batch]);
    }
    batchOf.set(id, {batch, grade});
  }
  const managed = [...batchOf.values()].map(b => b.batch);
  if (!managed.length) return;

  // 3. Desired state: subjects per batch, teachers, students.
  const teacherUser = new Map((await many(c, 'SELECT r.faculty_id f,r.user_id u FROM emis_roles r JOIN institution_memberships m ON m.org_id=r.org_id AND m.user_id=r.user_id AND m.active=1 WHERE r.org_id=? AND r.faculty_id IS NOT NULL', [org])).map(r => [r.f, r.u]));
  const studentUser = new Map((await many(c, "SELECT r.student_person_id p,r.user_id u FROM emis_roles r JOIN institution_memberships m ON m.org_id=r.org_id AND m.user_id=r.user_id AND m.active=1 WHERE r.org_id=? AND r.role='Student'", [org])).map(r => [r.p, r.u]));
  // Read what already exists once, so a sync with nothing new costs a handful of queries.
  const marks = managed.map(() => '?').join(',');
  const subjectIds = new Map((await many(c, 'SELECT id,college_semester_id g,name FROM subjects WHERE org_id=?', [org])).map(r => [key(r.g, r.name.toLowerCase()), r.id]));
  const recordLinks = new Map((await many(c, 'SELECT record_id r,subject_id s FROM emis_subject_links WHERE org_id=?', [org])).map(r => [r.r, r.s]));
  const offered = new Set((await many(c, `SELECT batch_id b,subject_id s FROM batch_subjects WHERE batch_id IN (${marks})`, managed)).map(r => key(r.b, r.s)));
  const subjectsOf = new Map(), teaching = new Set();
  for (const o of offerings) {
    const {batch, grade} = batchOf.get(o.cohort), name = o.name.slice(0, 120), k = key(grade, name.toLowerCase());
    let subject = subjectIds.get(k);
    if (!subject) { subject = randomUUID(); subjectIds.set(k, subject); await c.execute('INSERT INTO subjects(id,org_id,college_semester_id,name,code) VALUES(?,?,?,?,?)', [subject, org, grade, name, String(o.code).slice(0, 40)]); }
    if (recordLinks.get(o.record) !== subject) await c.execute('INSERT INTO emis_subject_links(org_id,record_id,subject_id) VALUES(?,?,?) ON DUPLICATE KEY UPDATE subject_id=VALUES(subject_id)', [org, o.record, subject]);
    if (!offered.has(key(batch, subject))) { offered.add(key(batch, subject)); await c.execute('INSERT INTO batch_subjects(batch_id,subject_id) VALUES(?,?)', [batch, subject]); }
    if (!subjectsOf.has(batch)) subjectsOf.set(batch, new Set());
    subjectsOf.get(batch).add(subject);
    const teacher = teacherUser.get(o.teacher);
    if (teacher) teaching.add(key(batch, subject, teacher));
  }
  const members = new Set(), studying = new Set();
  const people = new Map((await many(c, 'SELECT student_id s,person_id p FROM emis_student_links WHERE org_id=?', [org])).map(r => [r.s, r.p]));
  for (const s of (await records('students')).filter(ACTIVE)) {
    const cohort = school ? 'class:' + s.classId : `program:${s.programId}:${Number(s.semester)}`, user = studentUser.get(people.get(s.id));
    const b = batchOf.get(cohort);
    if (!b || !user) continue;
    members.add(key(b.batch, user));
    for (const subject of subjectsOf.get(b.batch) || []) studying.add(key(b.batch, subject, user));
  }

  // 4. Make the managed batches match. Remove first (student subjects follow their membership).
  await mirror(c, `SELECT batch_id a,user_id b FROM batch_members WHERE batch_id IN (${marks})`, managed, members, 'DELETE FROM batch_members WHERE batch_id=? AND user_id=?', 'INSERT IGNORE INTO batch_members(batch_id,user_id) VALUES(?,?)');
  await mirror(c, `SELECT batch_id a,subject_id b,user_id x FROM student_subjects WHERE batch_id IN (${marks})`, managed, studying, 'DELETE FROM student_subjects WHERE batch_id=? AND subject_id=? AND user_id=?', 'INSERT IGNORE INTO student_subjects(batch_id,subject_id,user_id) VALUES(?,?,?)');
  await mirror(c, `SELECT batch_id a,subject_id b,user_id x FROM teacher_assignments WHERE batch_id IN (${marks})`, managed, teaching, 'DELETE FROM teacher_assignments WHERE batch_id=? AND subject_id=? AND user_id=?', 'INSERT IGNORE INTO teacher_assignments(batch_id,subject_id,user_id) VALUES(?,?,?)');

  // 5. Subject content reaches every batch that studies the subject.
  await c.execute(`INSERT IGNORE INTO course_batches(course_id,batch_id) SELECT co.id,bs.batch_id FROM courses co JOIN batch_subjects bs ON bs.subject_id=co.subject_id WHERE co.org_id=? AND bs.batch_id IN (${marks})`, [org, ...managed]);
}

/** Finds a row by its unique columns, or inserts it. Returns its id. */
async function ensure(c, table, unique, extra = {}) {
  const cols = Object.keys(unique);
  const found = await one(c, `SELECT id FROM ${table} WHERE ${cols.map(k => unique[k] === null ? k + ' IS NULL' : k + '=?').join(' AND ')}`, cols.filter(k => unique[k] !== null).map(k => unique[k]));
  if (found) return found.id;
  const row = {id: randomUUID(), ...unique, ...extra};
  await c.execute(`INSERT INTO ${table}(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(() => '?').join(',')})`, Object.values(row));
  return row.id;
}

/** Deletes rows that are not wanted and inserts wanted rows that are missing. Rows are keyed by joined columns. */
async function mirror(c, select, args, wanted, remove, insert) {
  const have = new Set((await many(c, select, args)).map(r => key(...[r.a, r.b, r.x].filter(v => v !== undefined))));
  for (const k of have) if (!wanted.has(k)) await c.execute(remove, k.split('|'));
  for (const k of wanted) if (!have.has(k)) await c.execute(insert, k.split('|'));
}
