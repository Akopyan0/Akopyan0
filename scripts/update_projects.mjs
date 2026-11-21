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
  const words=String(raw ?? '').replace(/\\s+/g,' ').trim().split(' ');
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
  const p=palette; const bg=(i%2===0?p.soft:p.paper);
  const license=repo.license && repo.license.key && !['other','none'].includes(repo.license.key);
  const kicker=license?'OPEN SOURCE':'PUBLIC REPOSITORY';
  const title=wrap(repo.name.replace(/[-_]+/g,' '),23,2);
  const desc=wrap(repo.description || 'Source code and documentation.',58,2);
  const lang=String(repo.language || 'SOFTWARE').toUpperCase().slice(0,22);
  let result='<svg xmlns="http://www.w3.org/2000/svg" width="560" height="252" viewBox="0 0 560 252" role="img" aria-label="'+escapeXml(repo.name)+'">';
  result+='<title>'+escapeXml(repo.name)+'</title><rect width="560" height="252" fill="'+bg+'"/>';
  result+='<rect x=".5" y=".5" width="559" height="251" fill="none" stroke="'+p.line+'"/>';
  result+='<rect x="28" y="29" width="13" height="13" fill="'+p.lime+'"/>';
  function text(x,y,size,color,value,extra=''){return '<text x="'+x+'" y="'+y+'" font-family="Arial,Helvetica,sans-serif" font-size="'+size+'" font-weight="700" fill="'+color+'" '+extra+'>'+escapeXml(value)+'</text>';}
  result+=text(51,41,11,p.forest,kicker,'letter-spacing="1"');
  result+=text(530,41,11,p.muted,String(i+1).padStart(2,'0')+' / REPO','text-anchor="end" letter-spacing="1"');
  result+='<line x1="28" y1="58" x2="532" y2="58" stroke="'+p.line+'"/>';
  title.forEach((s,j)=>result+=text(28,108+j*35,31,p.deep,s,'letter-spacing="-1.3"'));
  desc.forEach((s,j)=>result+=text(28,(title.length>1?178:162)+j*18,13,p.muted,s,'font-weight="500"'));
  result+='<line x1="28" y1="214" x2="532" y2="214" stroke="'+p.line+'"/>';
  result+='<rect x="28" y="230" width="7" height="7" fill="'+p.forest+'"/>';
  result+=text(46,239,11,p.muted,lang,'letter-spacing=".6"');
  result+=text(530,239,11,p.forest,'VIEW SOURCE','text-anchor="end" letter-spacing=".6"');
  result+='</svg>\n';
  return result;
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
    r.name.toLowerCase()!==owner.toLowerCase() && !r.private && !r.fork && !r.archived && !r.disabled
  ).sort((a,b)=>String(b.pushed_at||b.created_at||'').localeCompare(String(a.pushed_at||a.created_at||''))).slice(0,6);
}
function markup(repos){
  if(!repos.length) return '<p>No public projects are available yet.</p>';
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
