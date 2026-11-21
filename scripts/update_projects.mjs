import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const username = 'Akopyan0';
const start = '<!-- AUTO:PROJECTS_START -->';
const end = '<!-- AUTO:PROJECTS_END -->';
const cardsDir = path.join(root, 'assets', 'projects');
const LF = String.fromCharCode(10);

function escapeXml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function wrap(value, max = 33, maxLines = 2) {
  const words = String(value ?? '').replace(/\s+/g, ' ').trim().split(' ');
  const lines = []; let current = '';
  for (const word of words) {
    if (current && (current.length + 1 + word.length) > max) {
      lines.push(current); current = '';
    }
    current += (current ? ' ' : '') + word;
  }
  if (current) lines.push(current);
  const output = lines.slice(0, maxLines);
  if (lines.length > maxLines && output.length) {
    output[output.length - 1] = output[output.length - 1].slice(0, max - 3) + '...';
  }
  return output;
}
function label(x, y, value, size, color, weight = 500, extra = '') {
  return '<text x="' + x + '" y="' + y + '" fill="' + color +
    '" font-family="Inter,Arial,Helvetica,sans-serif" font-size="' + size +
    '" font-weight="' + weight + '" ' + extra + '>' + escapeXml(value) + '</text>';
}
function renderCard(repo, index) {
  const primary = index % 2 ? '#EDF2E7' : '#F8F9F3';
  const title = wrap(repo.name.replace(/[-_]+/g, ' '), 23, 2);
  const desc = wrap(repo.description || 'Source code and documentation.', 45, 2);
  const language = String(repo.language || 'Software').toUpperCase().slice(0, 23);
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="275" viewBox="0 0 560 275" role="img" aria-label="' + escapeXml(repo.name) + '">';
  s += '<title>' + escapeXml(repo.name) + '</title>';
  s += '<rect width="560" height="275" fill="' + primary + '"/>';
  s += '<rect width="12" height="275" fill="#D7EF73"/>';
  s += '<line x1="35" y1="64" x2="528" y2="64" stroke="#D7DFD3"/>';
  s += label(35, 44, 'REPOSITORY / ' + String(index + 1).padStart(2, '0'), 13, '#2F503A', 800, 'letter-spacing="1.3"');
  s += label(527, 44, 'PUBLIC', 13, '#5B695E', 700, 'text-anchor="end" letter-spacing=".8"');
  title.forEach((value, i) => { s += label(35, 117 + i * 42, value, 34, '#172F22', 800, 'letter-spacing="-1.3"'); });
  const descriptionStart = title.length > 1 ? 201 : 165;
  desc.forEach((value, i) => { s += label(36, descriptionStart + i * 20, value, 14, '#5B695E', 500); });
  s += '<line x1="35" y1="240" x2="528" y2="240" stroke="#D7DFD3"/>';
  s += label(35, 264, language, 13, '#203328', 750, 'letter-spacing=".6"');
  s += label(528, 264, 'VIEW SOURCE', 13, '#203328', 750, 'text-anchor="end" letter-spacing=".5"');
  return s + '</svg>' + LF;
}
async function getProjects() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'akopyan-profile', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GH_TOKEN) headers.Authorization = 'Bearer ' + process.env.GH_TOKEN;
  const results = [];
  for (let page = 1; page <= 5; page++) {
    const url = 'https://api.github.com/users/' + username + '/repos?per_page=100&sort=updated&page=' + page;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error('GitHub API failed: ' + response.status);
    const repos = await response.json();
    if (!Array.isArray(repos)) throw Error('Unexpected GitHub API response');
    results.push(...repos);
    if (repos.length < 100) break;
  }
  return results.filter(r =>
    r && r.owner && r.owner.login.toLowerCase() === username.toLowerCase() &&
    typeof r.name === 'string' && /^[a-z0-9._-]{1,100}$/i.test(r.name) &&
    ![username.toLowerCase(), 'northstar---portfolio'].includes(r.name.toLowerCase()) &&
    !r.private && !r.fork && !r.archived && !r.disabled
  ).sort((a, b) => String(b.pushed_at || b.created_at).localeCompare(String(a.pushed_at || a.created_at))).slice(0, 6);
}
function renderSection(repos) {
  if (repos.length === 0) return '';
  const lines = ['<p align="center"><img src="assets/latest-heading.svg" width="100%" alt="More public projects" /></p>', '<table><tbody>'];
  for (let i = 0; i < repos.length; i += 2) {
    lines.push('<tr>');
    for (const repo of repos.slice(i, i + 2)) {
      const url = 'https://github.com/' + username + '/' + encodeURIComponent(repo.name);
      lines.push('<td width="50%"><a href="' + url + '"><img width="100%" src="assets/projects/' + repo.name + '.svg" alt="' + escapeXml(repo.name) + ' public repository" /></a></td>');
    }
    if (i + 1 === repos.length) lines.push('<td width="50%"></td>');
    lines.push('</tr>');
  }
  lines.push('</tbody></table>');
  return lines.join(LF);
}
async function main() {
  const repos = await getProjects();
  const readme = path.join(root, 'README.md');
  const original = fs.readFileSync(readme, 'utf8');
  if (original.split(start).length !== 2 || original.split(end).length !== 2 ||
      original.indexOf(start) > original.indexOf(end)) {
    throw Error('README auto-section markers missing or duplicated');
  }
  const expected = new Set(repos.map(r => r.name + '.svg'));
  fs.mkdirSync(cardsDir, { recursive: true });
  for (const [index, repo] of repos.entries()) {
    const target = path.join(cardsDir, repo.name + '.svg');
    const content = renderCard(repo, index);
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
      fs.writeFileSync(target, content);
    }
  }
  for (const filename of fs.readdirSync(cardsDir)) {
    if (filename.endsWith('.svg') && !expected.has(filename)) {
      fs.unlinkSync(path.join(cardsDir, filename));
    }
  }
  const a = original.indexOf(start) + start.length;
  const b = original.indexOf(end);
  const updated = original.slice(0, a) + LF + renderSection(repos) + LF + original.slice(b);
  if (updated !== original) fs.writeFileSync(readme, updated);
  console.log('Public projects synced: ' + repos.length);
}
main().catch(err => { console.error(err); process.exitCode = 1; });
