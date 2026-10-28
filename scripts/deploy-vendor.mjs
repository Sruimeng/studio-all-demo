import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projects = { SUNLU: 'tripo-material-sunlu', Polymaker: 'tripo-material-polymaker' };
const [vendor, option] = process.argv.slice(2);
if (!Object.hasOwn(projects, vendor) || (option && option !== '--build-only')) throw new Error('Usage: node scripts/deploy-vendor.mjs SUNLU|Polymaker [--build-only]');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, VITE_MATERIAL_VENDOR: vendor };
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}

run('pnpm', ['build']);
const artifact = join(root, 'artifacts/vendor-sites', vendor.toLowerCase());
rmSync(artifact, { recursive: true, force: true });
mkdirSync(artifact, { recursive: true });
cpSync(join(root, '.output/public'), artifact, { recursive: true });
console.log(`Built ${vendor}: ${artifact}`);

if (option !== '--build-only') {
  const stage = mkdtempSync(join(tmpdir(), `tripo-${vendor.toLowerCase()}-`));
  try {
    writeFileSync(join(stage, 'vercel.json'), JSON.stringify({ framework: null }));
    run('vercel', ['link', '--yes', '--project', projects[vendor], '--scope', 'ruimengsuuuuu-6106s-projects'], stage);
    const output = join(stage, '.vercel/output');
    mkdirSync(output, { recursive: true });
    cpSync(artifact, join(output, 'static'), { recursive: true });
    writeFileSync(join(output, 'config.json'), JSON.stringify({ version: 3, routes: [{ handle: 'filesystem' }, { src: '/.*', dest: '/index.html' }] }));
    run('vercel', ['deploy', '--prebuilt', '--prod', '--yes', '--meta', `siteVendor=${vendor}`], stage);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}
