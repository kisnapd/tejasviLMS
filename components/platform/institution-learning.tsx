'use client';
import {useEffect,useMemo,useState} from 'react';
import {Plus,Users,BookOpen} from 'lucide-react';
import type {Course} from '@/lib/platform-types';
import type {SubjectPreset} from './editors';

type Subject={id:string;name:string;code:string;semester_name:string|null;program_name:string|null};
type Structure={userId:string;subjects:Subject[];batchSubjects:{batch_id:string;subject_id:string}[];teachers:{batch_id:string;subject_id:string;user_id:string;name:string}[]};
const byNumber=(a:string,b:string)=>a.localeCompare(b,undefined,{numeric:true});

/**
 * Subjects for a school or college. Staff see every subject they can teach, grouped by grade
 * (or program semester), with its content. Subjects come from EMIS, or from Classes & enrolments for Learning-only institutions.
 * Learners see the subject content assigned to them. Non-credit courses keep a simple list.
 */
export function InstitutionLearning({orgId,courses,academic,college,learner,teacher,emis,onCreate,onOpen,onSetup}:{orgId:string;courses:Course[];academic:boolean;college:boolean;learner:boolean;teacher:boolean;emis:boolean;onCreate:(subject?:SubjectPreset)=>void;onOpen:(c:Course)=>void;onSetup?:()=>void}){
 const [search,setSearch]=useState(''),[structure,setStructure]=useState<Structure|null>(null),[error,setError]=useState('');
 const staffSubjects=academic&&!learner;
 useEffect(()=>{if(!staffSubjects)return;let live=true;fetch('/api/academics?org='+orgId).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(live)setStructure(d)}).catch(e=>{if(live)setError((e as Error).message)});return()=>{live=false}},[orgId,staffSubjects]);
 const match=(...text:(string|null|undefined)[])=>text.join(' ').toLowerCase().includes(search.trim().toLowerCase());
 const title=academic?(learner?'My subjects':'Subjects'):'Non-credit courses';

 const groups=useMemo(()=>{
  if(!structure)return [];
  const mine=teacher?new Set(structure.teachers.filter(t=>t.user_id===structure.userId).map(t=>t.subject_id)):null;
  const grouped=new Map<string,Subject[]>();
  for(const s of structure.subjects){
   if(mine&&!mine.has(s.id)&&!courses.some(c=>c.subjectId===s.id))continue;
   if(!match(s.name,s.code,s.semester_name,s.program_name,...courses.filter(c=>c.subjectId===s.id).map(c=>c.title)))continue;
   const label=s.semester_name?(s.program_name?`${s.program_name} · ${s.semester_name}`:s.semester_name):'Other subjects';
   grouped.set(label,[...(grouped.get(label)||[]),s]);
  }
  return [...grouped.entries()].sort(([a],[b])=>a==='Other subjects'?1:b==='Other subjects'?-1:byNumber(a,b)).map(([label,list])=>({label,list:list.sort((a,b)=>a.name.localeCompare(b.name))}));
 },[structure,courses,search,teacher]);

 const header=<div className="workspace-title"><div><p className="workspace-kicker">{college?'COLLEGE LEARNING':'SCHOOL LEARNING'}</p><h1>{title}</h1><p>{academic?(learner?'Lessons and work for the subjects you study.':`Each subject belongs to a ${college?'program semester':'grade'} and reaches every ${college?'student in it':'section'} automatically.`):'Optional, standalone learning outside the regular subject curriculum.'}</p></div>{!academic&&!learner&&<button className="button button-orange" onClick={()=>onCreate()}>Create non-credit course</button>}</div>;
 const searchBox=<label className="field">Search {title.toLowerCase()}<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={academic?'Subject, code or grade':'Search optional learning'}/></label>;

 if(staffSubjects)return <>{header}{error&&<p className="error-box" role="alert">{error}</p>}{searchBox}
  {!structure&&!error&&<p role="status">Loading subjects…</p>}
  {structure&&!groups.length&&<section className="editor-section"><h2>{search?'No matching subjects':'No subjects yet'}</h2><p>{search?'Try another subject, code or grade.':teacher?`Subjects appear here once you are assigned to teach them${emis?' in EMIS':''}.`:emis?`Add ${college?'courses to each program semester':'subjects to each class'} in EMIS. They appear here automatically.`:'Create grades, subjects and classes in Classes & enrolments, then add students to each class.'}</p>{!emis&&onSetup&&!search&&<button className="button button-orange" onClick={onSetup}>Open Classes & enrolments</button>}</section>}
  {groups.map(g=><section key={g.label} className="subject-group" aria-labelledby={'grade-'+g.label}><h2 id={'grade-'+g.label}>{g.label}</h2><div className="subject-list">{g.list.map(s=>{
   const content=courses.filter(c=>c.subjectId===s.id),sections=new Set(structure!.batchSubjects.filter(b=>b.subject_id===s.id).map(b=>b.batch_id)).size,teachers=[...new Set(structure!.teachers.filter(t=>t.subject_id===s.id).map(t=>t.name))];
   return <article key={s.id} className="subject-row"><div className="subject-row-head"><div><h3>{s.name}{s.code&&<small> · {s.code}</small>}</h3><p className="muted"><Users size={14}/> {sections} {college?'group':'section'}{sections===1?'':'s'}{teachers.length?' · '+teachers.join(', '):' · Teacher has no login yet'}</p></div><button className="button button-outline" onClick={()=>onCreate({id:s.id,name:s.name,grade:g.label})}><Plus size={15}/> Add content</button></div>
    {content.length?<ul className="subject-content">{content.map(c=><li key={c.id}><button className="quiet-link" onClick={()=>onOpen(c)}><BookOpen size={15}/> {c.title}</button><span className={'badge'+(c.status==='published'?'':' badge-muted')}>{c.status}</span><small>{c.unitIds?.length||0} units · {c.lessons.length} lessons</small></li>)}</ul>:<p className="muted">No content yet.</p>}</article>;})}</div></section>)}</>;

 const items=courses.filter(c=>Boolean(c.subjectId)===academic&&match(c.title,c.audience,c.description));
 return <>{header}{searchBox}
  <div className="course-grid">{items.map(c=><article key={c.id} className="course-card"><div className="course-card-body"><span className="badge">{academic?'SUBJECT':'NON-CREDIT'} · {c.status}</span><h2>{c.title}</h2><p>{c.audience}</p><p className="course-description">{c.description}</p><p>{c.unitIds?.length||0} units · {c.lessons.length} lessons</p><button className="button button-outline" onClick={()=>onOpen(c)}>{learner?'Open learning':'Manage course'}</button></div></article>)}</div>
  {!items.length&&<section className="editor-section"><h2>{search?'No matching content':academic?'Nothing to study yet':'No non-credit courses yet'}</h2><p>{search?'Try another title.':academic?'Your teachers’ lessons for each subject appear here.':learner?'Your institution will publish optional learning here.':'Create optional learning outside the regular subjects.'}</p></section>}</>;
}
