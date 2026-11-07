// Refuse the commit if staged paths/content resemble credentials. Never print matched secrets.
import { execFileSync } from 'node:child_process';
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const files = git('diff', '--cached', '--name-only', '-z', '--diff-filter=ACM').toString().split('\0').filter(Boolean);
const rules = [
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['OpenAI key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/],
  ['AWS key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['assigned secret', /(?:api[_-]?key|access[_-]?token|client[_-]?secret|private[_-]?key)\s*[:=]\s*["'][A-Za-z0-9_+\/=.-]{20,}["']/i],
  ['Solana secret-key byte array', /(?:\b\d{1,3}\s*,\s*){63}\d{1,3}/],
];
let failures = 0;
for (const file of files) {
  if (/(?:^|\/)(?:\.env[^/]*|[^/]*(?:KEY|TOKEN)[^/]*)$/.test(file) || /(?:^|\/)(?:node_modules|\.vercel|out)\//.test(file)) { console.error(`${file}: forbidden staged path`); failures++; }
  const bytes = git('show', `:${file}`);
  if (bytes.includes(0)) continue;
  const content = bytes.toString('utf8');
  for (const [name, pattern] of rules) if (pattern.test(content)) { console.error(`${file}: possible ${name}`); failures++; }
}
if (failures) { console.error(`REFUSING COMMIT: ${failures} credential/path findings. Remove them from the index and rerun.`); process.exit(1); }
console.log(`PASS: ${files.length} staged files scanned; no credential patterns found.`);
