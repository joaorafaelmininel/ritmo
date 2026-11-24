import * as Print from 'expo-print';

import { APP_NOME } from './marca';
import { dataCurta, moeda, nomeMes } from './formato';

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

/** Página A4 simples, letra grande, para imprimir e colar no mural. */
export function paginaHtml(titulo: string, subtitulo: string, corpo: string) {
  return `<html><head><meta charset="utf-8"/><style>
    body{font-family:Helvetica,Arial,sans-serif;margin:28px;color:#111;font-size:15px}
    h1{font-size:26px;margin:0 0 4px;color:#0B4F8A} h2{font-size:19px;margin:22px 0 8px;border-bottom:2px solid #0B4F8A;padding-bottom:4px}
    .sub{color:#444;margin-bottom:14px} table{width:100%;border-collapse:collapse} td,th{padding:6px 8px;border-bottom:1px solid #ddd;text-align:left}
    th{background:#f1f4f8} .n{text-align:right;white-space:nowrap} .total td{font-weight:bold;border-top:2px solid #333}
    .caixas{display:flex;gap:10px} .caixa{flex:1;border:2px solid #ccc;border-radius:10px;padding:10px}
    .caixa b{display:block;font-size:22px} .rodape{margin-top:26px;color:#666;font-size:12px}
    .ok{color:#1B6B38}.ruim{color:#A82018}
  </style></head><body>
    <h1>${esc(titulo)}</h1><div class="sub">${esc(subtitulo)}</div>${corpo}
    <div class="rodape">Gerado pelo aplicativo ${esc(APP_NOME)} em ${dataCurta(new Date())}. Documentos completos e comprovantes disponíveis no app.</div>
  </body></html>`;
}

export async function imprimir(html: string) {
  await Print.printAsync({ html });
}

type Lanc = { tipo: 'receita' | 'despesa'; categoria: string; descricao: string; valor: number; data: string; fornecedor: string | null };

/** Resumo financeiro de um mês (balancete simplificado para o mural). */
export function htmlResumoMes(p: {
  condominio: string; mes: Date; lancamentos: Lanc[];
  saldos: { conta: string; valor: number }[]; inadimplencia: { unidades: number; total: number; valor: number } | null;
}) {
  const rec = p.lancamentos.filter((l) => l.tipo === 'receita');
  const des = p.lancamentos.filter((l) => l.tipo === 'despesa');
  const soma = (l: Lanc[]) => l.reduce((s, x) => s + Number(x.valor), 0);
  const porCat = (l: Lanc[]) => Object.entries(l.reduce<Record<string, number>>((a, x) => { a[x.categoria] = (a[x.categoria] ?? 0) + Number(x.valor); return a; }, {}))
    .sort((a, b) => b[1] - a[1]);
  const resultado = soma(rec) - soma(des);
  const tabela = (linhas: [string, number][], total: number) =>
    `<table>${linhas.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="n">${moeda(v)}</td></tr>`).join('')}<tr class="total"><td>Total</td><td class="n">${moeda(total)}</td></tr></table>`;
  const corpo = `
    <div class="caixas">
      <div class="caixa">Entrou<b class="ok">${moeda(soma(rec))}</b></div>
      <div class="caixa">Saiu<b class="ruim">${moeda(soma(des))}</b></div>
      <div class="caixa">${resultado >= 0 ? 'Sobrou' : 'Faltou'}<b class="${resultado >= 0 ? 'ok' : 'ruim'}">${moeda(Math.abs(resultado))}</b></div>
    </div>
    <h2>Receitas por categoria</h2>${rec.length ? tabela(porCat(rec), soma(rec)) : '<p>Nenhuma receita lançada.</p>'}
    <h2>Despesas por categoria</h2>${des.length ? tabela(porCat(des), soma(des)) : '<p>Nenhuma despesa lançada.</p>'}
    <h2>Despesas, uma a uma</h2>
    <table><tr><th>Data</th><th>Descrição</th><th>Fornecedor</th><th class="n">Valor</th></tr>
      ${des.map((l) => `<tr><td>${dataCurta(l.data)}</td><td>${esc(l.descricao)}</td><td>${esc(l.fornecedor ?? '')}</td><td class="n">${moeda(l.valor)}</td></tr>`).join('')}
    </table>
    ${p.saldos.length ? `<h2>Saldos das contas</h2>${tabela(p.saldos.map((s) => [s.conta, s.valor]), p.saldos.reduce((s, x) => s + x.valor, 0))}` : ''}
    ${p.inadimplencia ? `<h2>Inadimplência</h2><p>${p.inadimplencia.unidades} de ${p.inadimplencia.total} unidades com taxa em atraso, somando ${moeda(p.inadimplencia.valor)}.</p>` : ''}`;
  return paginaHtml(`Resumo financeiro — ${nomeMes(p.mes.getMonth())}/${p.mes.getFullYear()}`, p.condominio, corpo);
}
