import {formatBs} from '@/modules/emis/shared/bs.mjs';
/** '2027-04-13' → '13 Apr 2027 (30 Chaitra 2083)'. */
export function formatExpiry(iso?:string|null){if(!iso)return '';const d=String(iso).slice(0,10),ad=new Date(d+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}),bs=formatBs(d);return bs?`${ad} (${bs})`:ad}
