#!/usr/bin/env node
/**
 * Escolhe o perfil Firebase (Vite mode) conforme a branch Git.
 * Evita apontar culturalapp-fb9b0 na branch Oraculo-IS e vice-versa.
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/** @type {Record<string, { mode: string; firebase: string; label: string }>} */
const BRANCH_TO_PROFILE = {
  'Oraculo-IS': {
    mode: 'oraculo-is',
    firebase: 'oraculo-is',
    label: 'Instituto dos Sonhos (oraculo-is)',
  },
  'oraculo-roxo': {
    mode: 'culturalapp',
    firebase: 'culturalapp-fb9b0',
    label: 'Oráculo Cultural (culturalapp-fb9b0)',
  },
  main: {
    mode: 'culturalapp',
    firebase: 'culturalapp-fb9b0',
    label: 'Oráculo Cultural (culturalapp-fb9b0)',
  },
};

function currentBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function profileByMode(mode) {
  return (
    Object.values(BRANCH_TO_PROFILE).find((p) => p.mode === mode) ?? {
      mode,
      firebase: mode === 'oraculo-is' ? 'oraculo-is' : 'culturalapp-fb9b0',
      label: mode,
    }
  );
}

function warnLegacyEnv() {
  if (!existsSync('.env')) return;
  console.warn('');
  console.warn('⚠️  Existe um arquivo .env na raiz.');
  console.warn('   Ele pode sobrescrever o perfil da branch. Prefira:');
  console.warn('   • .env.oraculo-is / .env.culturalapp (commitados, por projeto)');
  console.warn('   • .env.local (só segredos: Gemini, etc.)');
  console.warn('   Renomeie ou apague .env se notar projeto Firebase errado.');
  console.warn('');
}

const command = process.argv[2];
const forcedMode = process.argv[3];

if (command === 'check') {
  const branch = currentBranch();
  const profile = BRANCH_TO_PROFILE[branch];
  console.log(`Branch Git: ${branch || '(desconhecida)'}`);
  if (profile) {
    console.log(`Perfil esperado: ${profile.label}`);
    console.log(`Vite mode: ${profile.mode} → arquivo .env.${profile.mode}`);
    console.log(`Firebase CLI: firebase use ${profile.firebase}`);
    console.log(existsSync(`.env.${profile.mode}`) ? '✔ Arquivo de perfil encontrado.' : '✖ Falta .env.' + profile.mode);
  } else {
    console.log('Branch sem mapeamento automático. Use:');
    console.log('  npm run dev:is');
    console.log('  npm run dev:culturalapp');
  }
  warnLegacyEnv();
  process.exit(profile ? 0 : 1);
}

if (command === 'firebase-use') {
  const branch = currentBranch();
  const profile = forcedMode ? profileByMode(forcedMode) : BRANCH_TO_PROFILE[branch];
  if (!profile) {
    console.error('Branch sem perfil. Passe o mode: node scripts/firebase-env.mjs firebase-use oraculo-is');
    process.exit(1);
  }
  console.log(`firebase use ${profile.firebase}`);
  execSync(`npx firebase use ${profile.firebase}`, { stdio: 'inherit' });
  process.exit(0);
}

if (command !== 'dev' && command !== 'build') {
  console.error('Uso: node scripts/firebase-env.mjs <dev|build|check|firebase-use> [oraculo-is|culturalapp]');
  process.exit(1);
}

const branch = currentBranch();
const profile = forcedMode ? profileByMode(forcedMode) : BRANCH_TO_PROFILE[branch];

if (!profile) {
  console.error(`Branch "${branch}" não tem perfil Firebase mapeado.`);
  console.error('Use explicitamente: npm run dev:is  ou  npm run dev:culturalapp');
  process.exit(1);
}

console.log(`\n🔥 ${profile.label}`);
console.log(`   branch: ${branch} → vite --mode ${profile.mode}\n`);

warnLegacyEnv();

if (command === 'build') {
  const tsc = spawnSync('npx', ['tsc'], { stdio: 'inherit', shell: true });
  if (tsc.status !== 0) process.exit(tsc.status ?? 1);
  const build = spawnSync('npx', ['vite', 'build', '--mode', profile.mode], {
    stdio: 'inherit',
    shell: true,
  });
  process.exit(build.status ?? 1);
}

const dev = spawnSync('npx', ['vite', '--mode', profile.mode], { stdio: 'inherit', shell: true });
process.exit(dev.status ?? 1);
