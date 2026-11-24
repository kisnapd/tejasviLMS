import {learnerClause,teacherClause} from '../../../lib/course-policy.ts';
import {one,fail} from '../../../lib/campus-data.mjs';
export async function learningOverview(store,u){const c=store.db.connection(),org=store.org;if(!['admin','student','teacher'].includes(u.learningRole))throw fail('A Learning role is required.',403);
 const student=u.learningRole==='student',teacher=u.learningRole==='teacher';
 const extra=student?" AND c.status='published' AND "+learnerClause():teacher?' AND '+teacherClause():'',args=student||teacher?[org,u.id,u.id]:[org];
 const metrics=await one(c,'SELECT COUNT(*) courses,COALESCE(SUM(c.status=\'published\'),0) published FROM courses c WHERE c.org_id=?'+extra,args);
 return {courses:Number(metrics.courses),published:Number(metrics.published),role:u.learningRole};
}
