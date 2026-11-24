#!/usr/bin/env node
// Gera o resumo digital (hash SHA-512) do código-fonte para o Registro de
// Programa de Computador no INPI (e-Software). O INPI não recebe o código:
// recebe só este hash. GUARDE o arquivo .zip gerado sem nenhuma alteração —
// ele é a prova de que o hash corresponde ao seu código.
//
// Uso: node scripts/hash-inpi.mjs
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const versao = JSON.parse(readFileSync('package.json', 'utf8')).version;
const data = new Date().toISOString().slice(0, 10);
mkdirSync('registro-inpi', { recursive: true });
const zip = `registro-inpi/vizinhar-${versao}-${data}.zip`;

// Empacota somente arquivos versionados (sem node_modules, .env etc.)
execSync(`git archive --format=zip -o ${zip} HEAD`, { stdio: 'inherit' });
const hash = createHash('sha512').update(readFileSync(zip)).digest('hex');
const commit = execSync('git rev-parse HEAD').toString().trim();

const resumo = [
  `Programa: Vizinhar ${versao}`,
  `Arquivo: ${zip}`,
  `Commit: ${commit}`,
  `Data: ${data}`,
  `Algoritmo: SHA-512`,
  `Hash: ${hash}`,
  '',
  'Informe este hash no formulário do e-Software (INPI).',
  'Guarde o .zip e este arquivo em pelo menos dois lugares seguros (ex.: pendrive + nuvem).',
].join('\n');
writeFileSync(`${zip}.sha512.txt`, resumo + '\n');
console.log(resumo);
