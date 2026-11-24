import { Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Carregando, Cartao, Linha, Opcoes, Subtitulo, Tela, Texto } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataCurta, isoData, moeda } from '@/lib/formato';
import { esc, imprimir, paginaHtml } from '@/lib/relatorios';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { useTema } from '@/lib/tema';
import { CATEGORIAS_CHAMADO, DIMENSOES, Indicadores, Projeto, STATUS_PROJETO } from '@/lib/tipos';

type Resumo = {
  ocorrencias_registradas: number; ocorrencias_resolvidas: number; tempo_medio_dias: number | null; ocorrencias_por_tipo: Record<string, number>;
  manutencoes: { item: string; data: string; custo: number | null }[]; acoes_concluidas: string[]; avisos: number; reservas: number;
  encomendas: number; enquetes: number; sugestoes: number; ajudas_concluidas: number;
};

/** Os 4 últimos trimestres como opções. */
function trimestres() {
  const h = new Date();
  const atual = Math.floor(h.getMonth() / 3);
  return Array.from({ length: 4 }, (_, i) => {
    const t = atual - i;
    const ano = h.getFullYear() + Math.floor(t / 4);
    const q = ((t % 4) + 4) % 4;
    const de = new Date(ano, q * 3, 1);
    const ate = new Date(ano, q * 3 + 3, 0);
    return { valor: `${ano}-${q}`, nome: `${q + 1}º tri/${ano}`, de, ate };
  });
}

// Relatório de gestão do trimestre: o que foi feito, quanto custou, como andam as metas.
export default function Relatorio() {
  const { c } = useTema();
  const { condominioId, membro } = useSessao();
  const opcoes = trimestres();
  const [sel, setSel] = useState(opcoes[0].valor);
  const periodo = opcoes.find((o) => o.valor === sel)!;

  const { dados } = useConsulta(async () => {
    const de = isoData(periodo.de);
    const ate = isoData(periodo.ate);
    const [r, l, p, i] = await Promise.all([
      supabase.rpc('resumo_periodo', { p_condominio: condominioId, p_de: de, p_ate: ate }),
      supabase.from('lancamentos').select('tipo, categoria, valor').eq('condominio_id', condominioId).gte('data', de).lte('data', ate),
      supabase.from('projetos').select('*').eq('condominio_id', condominioId).eq('tipo', 'projeto').returns<Projeto[]>(),
      supabase.rpc('indicadores', { p_condominio: condominioId }),
    ]);
    const lanc = (l.data ?? []) as { tipo: string; categoria: string; valor: number }[];
    const receitas = lanc.filter((x) => x.tipo === 'receita').reduce((s, x) => s + Number(x.valor), 0);
    const despesas = lanc.filter((x) => x.tipo === 'despesa').reduce((s, x) => s + Number(x.valor), 0);
    const porCat = Object.entries(lanc.filter((x) => x.tipo === 'despesa').reduce<Record<string, number>>((a, x) => { a[x.categoria] = (a[x.categoria] ?? 0) + Number(x.valor); return a; }, {}))
      .sort((a, b) => b[1] - a[1]);
    return { data: { r: r.data as Resumo, receitas, despesas, porCat, projetos: p.data ?? [], ind: (i.data ?? {}) as Indicadores }, error: r.error };
  }, [condominioId, sel]);

  async function gerarPdf() {
    if (!dados) return;
    const { r } = dados;
    const linha = (a: string, b: string | number) => `<tr><td>${esc(a)}</td><td class="n">${esc(b)}</td></tr>`;
    const corpo = `
      <h2>1. Finanças</h2>
      <div class="caixas"><div class="caixa">Entrou<b class="ok">${moeda(dados.receitas)}</b></div><div class="caixa">Saiu<b class="ruim">${moeda(dados.despesas)}</b></div>
      <div class="caixa">Resultado<b class="${dados.receitas - dados.despesas >= 0 ? 'ok' : 'ruim'}">${moeda(dados.receitas - dados.despesas)}</b></div></div>
      <table>${dados.porCat.map(([k, v]) => linha(k, moeda(v))).join('')}</table>
      <p>Inadimplência atual: ${esc(dados.ind.inadimplencia)}% das unidades.</p>
      <h2>2. Dia a dia</h2>
      <table>${linha('Ocorrências registradas', r.ocorrencias_registradas)}${linha('Ocorrências resolvidas', r.ocorrencias_resolvidas)}
      ${linha('Tempo médio para resolver', r.tempo_medio_dias !== null ? `${r.tempo_medio_dias} dias` : '—')}${linha('Encomendas recebidas', r.encomendas)}${linha('Reservas de espaços', r.reservas)}</table>
      <p>Por tipo: ${Object.entries(r.ocorrencias_por_tipo).map(([k, v]) => `${esc(CATEGORIAS_CHAMADO[k] ?? k)} (${v})`).join(', ') || '—'}</p>
      <h3>Manutenções realizadas</h3>
      <table>${r.manutencoes.map((m) => `<tr><td>${dataCurta(m.data)}</td><td>${esc(m.item)}</td><td class="n">${m.custo ? moeda(m.custo) : ''}</td></tr>`).join('') || '<tr><td>Nenhuma registrada</td></tr>'}</table>
      ${r.acoes_concluidas.length ? `<h3>Ações do calendário concluídas</h3><ul>${r.acoes_concluidas.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      <h2>3. Comunidade</h2>
      <table>${linha('Avisos publicados', r.avisos)}${linha('Enquetes', r.enquetes)}${linha('Ideias dos moradores', r.sugestoes)}${linha('Ajudas entre vizinhos', r.ajudas_concluidas)}${linha('Unidades usando o app', `${dados.ind.adesao}%`)}</table>
      <h2>4. Plano de gestão</h2>
      <table><tr><th>Projeto</th><th>Área</th><th>Situação</th><th class="n">Andamento</th></tr>
      ${dados.projetos.map((p) => `<tr><td>${esc(p.titulo)}</td><td>${esc(DIMENSOES[p.dimensao].nome)}</td><td>${esc(STATUS_PROJETO[p.status])}</td><td class="n">${p.progresso}%</td></tr>`).join('')}</table>`;
    try {
      await imprimir(paginaHtml(`Relatório de gestão — ${periodo.nome}`, `${membro?.condominios.nome ?? ''} · ${dataCurta(periodo.de)} a ${dataCurta(periodo.ate)}`, corpo));
    } catch {
      avisar('Não foi possível gerar o PDF');
    }
  }

  const r = dados?.r;
  return (
    <Tela>
      <Stack.Screen options={{ title: 'Relatório de gestão' }} />
      <Opcoes valor={sel} aoMudar={setSel} opcoes={opcoes.map((o) => ({ valor: o.valor, nome: o.nome }))} />
      {!dados || !r ? <Carregando /> : (
        <>
          <Botao icone="document-outline" titulo="Gerar PDF para a assembleia" aoTocar={gerarPdf} />
          <Subtitulo>Finanças</Subtitulo>
          <Cartao>
            <Linha style={{ justifyContent: 'space-between' }}><Texto>Entrou</Texto><Texto negrito>{moeda(dados.receitas)}</Texto></Linha>
            <Linha style={{ justifyContent: 'space-between' }}><Texto>Saiu</Texto><Texto negrito>{moeda(dados.despesas)}</Texto></Linha>
            <Linha style={{ justifyContent: 'space-between' }}><Texto negrito>Resultado</Texto><Texto negrito cor={dados.receitas - dados.despesas >= 0 ? c.sucesso : c.perigo}>{moeda(dados.receitas - dados.despesas)}</Texto></Linha>
          </Cartao>
          <Subtitulo>Dia a dia</Subtitulo>
          <Cartao>
            <Texto>{r.ocorrencias_registradas} ocorrências registradas, {r.ocorrencias_resolvidas} resolvidas{r.tempo_medio_dias !== null ? ` (em média ${String(r.tempo_medio_dias).replace('.', ',')} dias)` : ''}.</Texto>
            <Texto>{r.manutencoes.length} manutenções realizadas · {r.encomendas} encomendas · {r.reservas} reservas.</Texto>
            {r.acoes_concluidas.length ? <Texto>Ações concluídas: {r.acoes_concluidas.join(', ')}.</Texto> : null}
          </Cartao>
          <Subtitulo>Comunidade</Subtitulo>
          <Cartao>
            <Texto>{r.avisos} avisos · {r.enquetes} enquetes · {r.sugestoes} ideias · {r.ajudas_concluidas} ajudas entre vizinhos.</Texto>
            <Texto>{dados.ind.adesao}% das unidades usam o app.</Texto>
          </Cartao>
          <Subtitulo>Plano de gestão</Subtitulo>
          <Cartao>
            {dados.projetos.map((p) => <Texto key={p.id}>• {p.titulo}: {STATUS_PROJETO[p.status].toLowerCase()} ({p.progresso}%)</Texto>)}
          </Cartao>
        </>
      )}
    </Tela>
  );
}
