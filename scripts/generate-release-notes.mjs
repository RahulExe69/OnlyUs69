import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

const runGit = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const currentCommit = process.env.GITHUB_SHA || runGit('rev-parse', 'HEAD');
const releaseRepoPath = process.env.RELEASE_REPO_PATH || 'release-repo';
const currentVersion = String(process.env.RELEASE_VERSION_NAME || 'current');
let previousCommit = '';
try {
  const previous = JSON.parse(await readFile(new URL('../release-repo/latest.json', import.meta.url), 'utf8'));
  previousCommit = String(previous.sourceCommit || '');
} catch {}
if (previousCommit && !/^[a-f0-9]{40}$/i.test(previousCommit)) previousCommit = '';
if (previousCommit) {
  try { runGit('cat-file', '-e', previousCommit + '^{commit}'); }
  catch { previousCommit = ''; }
}
if (!previousCommit) {
  const tags = runGit('tag', '--list', 'v[0-9]*', '--sort=-version:refname')
    .split('\n').filter(Boolean).filter(tag => tag !== (process.env.RELEASE_VERSION_TAG || ''));
  if (tags.length) {
    try { previousCommit = runGit('rev-list', '-n', '1', tags[0]); } catch {}
  }
}
const range = previousCommit ? previousCommit + '..' + currentCommit : currentCommit;
const subjects = runGit('log', '--no-merges', '--format=%s', range).split('\n').map(s => s.trim()).filter(Boolean);
const changedFiles = runGit('diff', '--name-only', previousCommit ? previousCommit : currentCommit + '^', currentCommit)
  .split('\n').map(s => s.trim()).filter(Boolean);

const groups = [
  { title: 'New features', items: [] },
  { title: 'Improvements', items: [] },
  { title: 'Bug fixes', items: [] },
  { title: 'Other updates', items: [] }
];
const seen = new Set();
for (const subject of subjects) {
  const clean = subject.replace(/^(feat|feature|fix|bugfix|perf|refactor|docs|chore|build|ci|test)(\([^)]*\))?!?:\s*/i, '')
    .replace(/^[\[({].*?[\])}]\s*/, '').trim();
  if (!clean || seen.has(clean.toLowerCase())) continue;
  seen.add(clean.toLowerCase());
  if (/^(feat|feature)(\(|:|$)/i.test(subject) || /\b(add|introduc|implement|support|enable|new)\b/i.test(subject)) groups[0].items.push(clean);
  else if (/^(fix|bugfix)(\(|:|$)/i.test(subject) || /\b(fix|crash|broken|prevent|resolve|correct)\b/i.test(subject)) groups[2].items.push(clean);
  else if (/\b(perf|performance|optim|improv|refactor|speed|cache|reduce)\b/i.test(subject)) groups[1].items.push(clean);
  else groups[3].items.push(clean);
}
const meaningful = groups.filter(group => group.items.length);
if (!meaningful.length) {
  meaningful.push({ title: 'Improvements', items: [`Updates and refinements in version ${currentVersion}.`] });
}
const limit = 5;
for (const group of meaningful) group.items = group.items.slice(0, limit);
const releaseNotes = meaningful.map(group => ({ title: group.title, items: group.items }));
const markdown = [
  `## What's new in OnlyUs ${currentVersion}`,
  '',
  ...releaseNotes.flatMap(group => [`### ${group.title}`, ...group.items.map(item => `- ${item}`), '']),
  '---',
  `Generated automatically from changes since ${previousCommit ? previousCommit.slice(0, 7) : 'the available version history'}.`,
  ''
].join('\n');
await writeFile('release-notes.json', JSON.stringify(releaseNotes, null, 2) + '\n');
await writeFile('release-notes.md', markdown);
console.log(`Generated Play Store-style notes with ${releaseNotes.length} section(s) from ${subjects.length} commit(s) and ${changedFiles.length} changed file(s).`);
