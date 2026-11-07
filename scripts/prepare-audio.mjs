// Reproducible, licence-pinned downloads. Sources were discovered using Openverse on 2026-11-07.
// Run with Node 24 and FFMPEG_PATH (ffmpeg executable). Originals remain in ignored out/.
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..'), tmp = path.join(root, 'out/audio-src');
await mkdir(tmp, { recursive: true });
await mkdir(path.join(root, 'public/cozy/music'), { recursive: true });
await mkdir(path.join(root, 'public/cozy/sounds'), { recursive: true });
const tracks = [
  { key: 'carefree', title: 'Carefree', author: 'Kevin MacLeod', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3', page: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', music: true },
  { key: 'plant', title: 'Footsteps Dirt Gravel', author: 'PotatokingXII', id: '6e486781-b532-42d0-a27e-f8b4396f945f', url: 'https://cdn.freesound.org/previews/352/352870_4187409-hq.mp3', page: 'https://freesound.org/people/PotatokingXII/sounds/352870', duration: .5 },
  { key: 'pluck', title: 'Plucking an Elastic Band', author: 'dsebeste', id: '6198d26f-362f-442c-9728-658889041fc6', url: 'https://cdn.freesound.org/previews/355/355041_3907739-hq.mp3', page: 'https://freesound.org/people/dsebeste/sounds/355041', duration: .3 },
  { key: 'build', title: 'Wood Knock', author: 'Mrguff', id: '19380888-f422-44d9-aad1-d2b7d788871f', url: 'https://cdn.freesound.org/previews/369/369710_2855293-hq.mp3', page: 'https://freesound.org/people/Mrguff/sounds/369710', duration: .65 },
  { key: 'chime', title: 'Single chime', author: 'LloydEvans09', id: '41c6cb5b-91b5-4574-ae96-74a555b6247b', url: 'https://cdn.freesound.org/previews/185/185822_2567799-hq.mp3', page: 'https://freesound.org/people/LloydEvans09/sounds/185822', duration: 1.7 },
  { key: 'tap', title: 'Mouse click sounds', author: 'Masgame', id: '3849018d-0ac8-4f6b-b44d-5ec26a4b32af', url: 'https://cdn.freesound.org/previews/347/347544_5662401-hq.mp3', page: 'https://freesound.org/people/Masgame/sounds/347544', duration: .16 },
  { key: 'coin', title: 'Real Coin Drop', author: 'Rocotilos', id: '5ae65b94-d34b-42e0-9cbc-bec2ea5b60ef', url: 'https://cdn.freesound.org/previews/343/343462_1400623-hq.mp3', page: 'https://freesound.org/people/Rocotilos/sounds/343462', duration: .164 },
];
for (const t of tracks) {
  if (t.id) {
    const r = await fetch(`https://api.openverse.org/v1/audio/${t.id}/`), j = await r.json();
    if (!r.ok || j.license !== 'cc0' || j.url !== t.url) throw Error(`Licence/source changed: ${t.key}`);
    t.license = 'CC0 1.0'; t.licenseUrl = j.license_url;
  }
  const response = await fetch(t.url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Error(`${t.key} HTTP ${response.status}`);
  const source = path.join(tmp, t.key + '.mp3'); await writeFile(source, new Uint8Array(await response.arrayBuffer()));
  const target = path.join(root, 'public/cozy', t.music ? 'music' : 'sounds', t.key + '.mp3');
  const filter = t.music ? 'loudnorm=I=-20:TP=-2:LRA=9' : `silenceremove=start_periods=1:start_threshold=-38dB,atrim=duration=${t.duration},afade=t=out:st=${Math.max(0, t.duration - .08)}:d=0.08,loudnorm=I=-24:TP=-4:LRA=7`;
  const result = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-y', '-i', source, '-af', filter, '-ar', '44100', '-b:a', '96k', ...(t.music ? [] : ['-ac', '1']), target], { encoding: 'utf8' });
  if (result.status !== 0) throw Error(result.stderr || 'ffmpeg failed');
  t.file = path.relative(root, target).replaceAll('\\', '/');
  console.log(`${t.key}: downloaded, normalized, 96 kbps`);
}
await writeFile(path.join(root, 'public/cozy/audio-sources.json'), JSON.stringify(tracks, null, 2) + '\n');
let credits = '# Stable Acres credits\n\n## Music\n\n';
credits += '“Carefree” Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0.\n\n';
for (const t of tracks) credits += `- **${t.title}** — ${t.author}. [Source](${t.page}) · [${t.license}](${t.licenseUrl}). Used as \`${t.file}\`; ${t.music ? 'loudness normalized and re-encoded to 96 kbps MP3' : 'trimmed, faded, loudness normalized and re-encoded; discovered through Openverse'}.\n`;
credits += '\n## Visuals and tools\n\nExisting Stable Acres sprites and slab supplied with this project; their original human/AI provenance and rights should be confirmed by the owner before release. Original canvas ambience added for this prototype. No reference-game assets, text or code used.\n\nProject AI tools named by the owner: Claude, Codex, ChatGPT/GPT-Image, Gemini. This revision used Codex; an attempted cow generation did not produce an asset.\n\nFont: Fredoka, copyright The Fredoka Project Authors (https://github.com/hafontia/Fredoka-One), SIL Open Font License 1.1, served locally; see fonts/OFL.txt.\n';
await writeFile(path.join(root, 'public/cozy/CREDITS.md'), credits);
