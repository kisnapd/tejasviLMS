import {one,run,type DB} from './db';
import {AppError} from './errors';
// Subject content in a school or college keeps its subject and follows class or semester enrolment.
export const curriculumKind=(kind:string)=>kind==='school'||kind==='college';
export async function curriculumSubject(org:string,user:string,role:string,subjectId:string,courseId?:string,db?:DB){
 const subject=subjectId?await one('SELECT * FROM subjects WHERE id=? AND org_id=?',[subjectId,org],db):null;
 if(subjectId&&!subject)throw new AppError('Choose a subject in this institution.',403);
 if(courseId){const prior=await one('SELECT subject_id FROM courses WHERE id=? AND org_id=?',[courseId,org],db);if(prior?.subject_id&&prior.subject_id!==subjectId)throw new AppError('Keep this content linked to its original subject. Create separate content for a different subject.');}
 if(subject&&role==='teacher'&&!await one('SELECT t.subject_id FROM teacher_assignments t JOIN batches b ON b.id=t.batch_id WHERE b.org_id=? AND t.subject_id=? AND t.user_id=?',[org,subjectId,user],db))throw new AppError('Ask your administrator to assign you this teaching subject.',403);
 return subject;
}
export async function linkCurriculumSubject(courseId:string,org:string,user:string,role:string,subject:{id:string;college_semester_id?:string|null},db?:DB){
 await run(`INSERT IGNORE INTO course_batches(course_id,batch_id) SELECT ?,b.id FROM batches b JOIN batch_subjects bs ON bs.batch_id=b.id AND bs.subject_id=? WHERE b.org_id=?${subject.college_semester_id?' AND b.grade_id=?':''}${role==='teacher'?' AND EXISTS(SELECT 1 FROM teacher_assignments t WHERE t.batch_id=b.id AND t.subject_id=bs.subject_id AND t.user_id=?)':''}`,[courseId,subject.id,org,...(subject.college_semester_id?[subject.college_semester_id]:[]),...(role==='teacher'?[user]:[])],db);
}
