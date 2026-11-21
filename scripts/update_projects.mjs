import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const owner = 'Akopyan0';
const startMark = '<!-- AUTO:PROJECTS_START -->';
const endMark = '<!-- AUTO:PROJECTS_END -->';
const folder = path.join(root, 'assets', 'projects');
const palette = { deep:'#13241A', forest:'#203328', lime:'#D7EF73', paper:'#FCFCF8', soft:'#EEF2E8', line:'#D6DECF', muted:'#526054' };
const escapeXml = (text) => String(text ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function wrap(raw,max=46,maxLines=2){
  const words=String(raw ?? '').replace(/\s+/g,' ').trim().split(' ');
  const lines=[]; let line='';
  for(const word of words){
    if((line+' '+word).trim().length>max && line){lines.push(line);line='';}
    line+=(line?' ':'')+word;
  }
  if(line) lines.push(line);
  if(lines.length>maxLines){const out=lines.slice(0,maxLines);out[maxLines-1]=out[maxLines-1].slice(0,max-2)+'…';return out;}
  return lines;
}
function card(repo,i){
  const p=palette;
  const license=repo.license && repo.license.key && !['other','none'].includes(repo.license.key);
  const kicker=license?'OPEN SOURCE':'PUBLIC REPOSITORY';
  const title=wrap(repo.name.replace(/[-_]+/g,' '),29,1)[0] || repo.name;
  const desc=wrap(repo.description || 'Source code and documentation.',59,2);
  const lang=String(repo.language || 'Software').slice(0,22);
  function text(x,y,size,color,value,serif=false,attrs=''){
    return '<text x="'+x+'" y="'+y+'" font-family="'+(serif?'Georgia,Times New Roman,serif':'Arial,Helvetica,sans-serif')+'" font-size="'+size+'" fill="'+color+'" '+attrs+'>'+escapeXml(value)+'</text>';
  }
  let out='<svg xmlns="http://www.w3.org/2000/svg" width="560" height="196" viewBox="0 0 560 196" role="img" aria-label="'+escapeXml(repo.name)+'">';
  out+='<title>'+escapeXml(repo.name)+'</title><rect width="560" height="196" fill="#FAFBF7"/>';
  out+='<line x1="22" y1="3" x2="538" y2="3" stroke="#DAE1D7"/>';
  out+=text(22,30,11,p.muted,kicker,false,'font-weight="700" letter-spacing="1"');
  out+=text(538,30,11,p.muted,String(i+1).padStart(2,'0'),false,'font-weight="700" text-anchor="end"');
  out+=text(22,87,33,p.deep,title,true);
  desc.forEach((s,j)=>{out+=text(22,119+j*20,13,p.muted,s,false);});
  out+='<line x1="22" y1="160" x2="538" y2="160" stroke="#DAE1D7"/>';
  out+=text(22,185,11,p.forest,lang.toUpperCase(),false,'font-weight="700" letter-spacing=".8"');
  out+=text(538,185,11,p.forest,'SOURCE  /',false,'font-weight="700" letter-spacing=".8" text-anchor="end"');
  out+='</svg>\n';
  return out;
}
async function repositories(){
  const token=process.env.GH_TOKEN || '';
  const headers={'Accept':'application/vnd.github+json','User-Agent':'Akopyan0-profile-refresher','X-GitHub-Api-Version':'2022-11-28'};
  if(token)headers.Authorization='Bearer '+token;
  const all=[];
  for(let page=1;page<=5;page++){
    const url='https://api.github.com/users/'+owner+'/repos?per_page=100&page='+page+'&sort=updated';
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('GitHub API returned '+response.status+'; README was not modified');
    const data=await response.json();
    if(!Array.isArray(data))throw Error('Unexpected API response');
    all.push(...data);
    if(data.length<100)break;
  }
  return all.filter(r=>
    r && r.owner && String(r.owner.login).toLowerCase()===owner.toLowerCase() &&
    typeof r.name==='string' && /^[A-Za-z0-9._-]{1,100}$/.test(r.name) &&
    r.name.toLowerCase()!==owner.toLowerCase() && r.name!=='Northstar---Portfolio' && !r.private && !r.fork && !r.archived && !r.disabled
  ).sort((a,b)=>String(b.pushed_at||b.created_at||'').localeCompare(String(a.pushed_at||a.created_at||''))).slice(0,6);
}
function markup(repos){
  if(!repos.length) return '<p align="center"><img src="assets/projects-coming.svg" width="100%" alt="New public repositories will appear here automatically." /></p>';
  const lines=['<table>','  <tbody>'];
  for(let i=0;i<repos.length;i+=2){
    lines.push('    <tr>');
    for(const r of repos.slice(i,i+2)){
      const url='https://github.com/'+owner+'/'+encodeURIComponent(r.name);
      lines.push('      <td width="50%"><a href="'+url+'"><img src="assets/projects/'+r.name+'.svg" alt="'+escapeXml(r.name)+' GitHub repository" width="100%" /></a></td>');
    }
    if(i+1===repos.length)lines.push('      <td width="50%"></td>');
    lines.push('    </tr>');
  }
  return [...lines,'  </tbody>','</table>'].join('\n');
}
async function run(){
  const repos=await repositories();
  const source=path.join(root,'README.md');
  const before=fs.readFileSync(source,'utf8');
  if(before.split(startMark).length!==2 || before.split(endMark).length!==2 || before.indexOf(startMark)>before.indexOf(endMark))throw Error('README project markers missing or duplicated');
  fs.mkdirSync(folder,{recursive:true});
  const expected=new Set();
  repos.forEach((r,i)=>{
    const name=r.name+'.svg';
    expected.add(name);
    const out=path.join(folder,name),content=card(r,i);
    if(!fs.existsSync(out)||fs.readFileSync(out,'utf8')!==content)fs.writeFileSync(out,content);
  });
  for(const name of fs.readdirSync(folder)){
    if(name.endsWith('.svg')&&!expected.has(name))fs.unlinkSync(path.join(folder,name));
  }
  const a=before.indexOf(startMark)+startMark.length,b=before.indexOf(endMark);
  const after=before.slice(0,a)+'\n'+markup(repos)+'\n'+before.slice(b);
  if(after!==before)fs.writeFileSync(source,after);
  console.log('Updated '+repos.length+' public project cards: '+repos.map(r=>r.name).join(', '));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
