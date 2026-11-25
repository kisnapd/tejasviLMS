import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {identity,readJson,respond,failure,AppError} from '@/lib/platform-server';
import {one,run,transaction} from '@/lib/db';
import {expiryProblem,issueRegistration,requiresRegistration} from '@/lib/registration.mjs';
import {normalizeAcademicYear} from '@/modules/emis/shared/bs.mjs';
import {registrationList} from '@/lib/registration-list';
import {syncLearning} from '@/lib/learning-sync.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';

async function superAdmin(){const user=await identity();if(!user.platformAdmin)throw new AppError('Only the Tejasvi Super Admin can manage registration keys.',403);return user}

export async function GET(){try{await superAdmin();return respond({organizations:await registrationList()})}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const user=await superAdmin(),body=await readJson(request,4096),base=z.object({action:z.enum(['renew','revoke','plan']),orgId:z.string().uuid()}).parse(body);
 const org=await one('SELECT id,kind FROM organizations WHERE id=?',[base.orgId]);if(!org)throw new AppError('Organization not found.',404);
 if(!requiresRegistration(org.kind))throw new AppError('Only schools and colleges use registration keys.');
 if(base.action==='plan'){
  // Turning EMIS on brings Learning in step with whatever EMIS already holds. Turning it off keeps every record.
  const emis=z.object({emis:z.boolean()}).parse(body).emis;
  await transaction(async c=>{await run('UPDATE organizations SET emis=? WHERE id=?',[emis,org.id],c);if(emis)await syncLearning(c,org.id);});
  return respond({ok:true});
 }
 if(base.action==='revoke'){
  const r=await run('UPDATE organization_registrations SET revoked_at=UTC_TIMESTAMP(3),revoked_by=? WHERE org_id=? AND revoked_at IS NULL',[user.userId,org.id]);
  if(!r.affectedRows)throw new AppError('This organization has no current key to revoke.');return respond({ok:true});
 }
 const data=z.object({academicYear:z.string().trim().min(1).max(12),expiresOn:z.string().trim().max(10)}).parse(body),year=normalizeAcademicYear(data.academicYear);
 if(!year)throw new AppError('Enter the academic year in Bikram Sambat, for example 2083, or in AD as 2026/27.');
 const problem=expiryProblem(data.expiresOn);if(problem)throw new AppError(problem);
 const key=await transaction(async c=>{await one('SELECT id FROM organizations WHERE id=? FOR UPDATE',[org.id],c);return issueRegistration((sql:string,values:any[])=>run(sql,values,c),{id:randomUUID(),orgId:org.id,academicYear:year,expiresOn:data.expiresOn,userId:user.userId})});
 return respond({ok:true,key},201);
}catch(e){return failure(e)}}
