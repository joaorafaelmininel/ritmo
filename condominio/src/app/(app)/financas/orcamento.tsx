import { Stack } from 'expo-router';
import { useState } from 'react';

import { SeletorPeriodo } from '@/components/lista';
import { avisar, Botao, Campo, Carregando, Cartao, Linha, Progresso, Tela, Texto } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { lerValor, moeda } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { useTema } from '@/lib/tema';
import { CATEGORIAS_DESPESA } from '@/lib/tipos';

/** Orçamento aprovado × o que foi gasto de verdade, categoria por categoria. */
export default function Orcamento() {
  const { c } = useTema();
  const { condominioId, eGestor } = useSessao();
  const [data, setData] = useState(new Date(new Date().getFullYear(), 0, 1));
  const ano = data.getFullYear();
  const [editando, setEditando] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});

  const { dados, recarregar } = useConsulta(async () => {
    const [o, l] = await Promise.all([
      supabase.from('orcamento').select('categoria, valor_previsto').eq('condominio_id', condominioId).eq('ano', ano).eq('tipo', 'despesa'),
      supabase.from('lancamentos').select('categoria, valor').eq('condominio_id', condominioId).eq('tipo', 'despesa').gte('data', `${ano}-01-01`).lte('data', `${ano}-12-31`),
    ]);
    const previsto: Record<string, number> = {};
    for (const x of o.data ?? []) previsto[x.categoria] = Number(x.valor_previsto);
    const realizado: Record<string, number> = {};
    for (const x of l.data ?? []) realizado[x.categoria] = (realizado[x.categoria] ?? 0) + Number(x.valor);
    return { data: { previsto, realizado }, error: o.error ?? l.error };
  }, [condominioId, ano]);

  async function salvar() {
    const linhas = Object.entries(valores).filter(([, v]) => v.trim()).map(([categoria, v]) => ({
      condominio_id: condominioId, ano, tipo: 'despesa', categoria, valor_previsto: lerValor(v) || 0,
    }));
    const { error } = await supabase.from('orcamento').upsert(linhas, { onConflict: 'condominio_id,ano,tipo,categoria' });
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    setEditando(false);
    recarregar();
  }

  if (!dados) return <Carregando />;
  const cats = [...new Set([...Object.keys(dados.previsto), ...Object.keys(dados.realizado)])]
    .sort((a, b) => (dados.previsto[b] ?? 0) - (dados.previsto[a] ?? 0));
  const totP = Object.values(dados.previsto).reduce((s, v) => s + v, 0);
  const totR = Object.values(dados.realizado).reduce((s, v) => s + v, 0);
  const pct = (r: number, p: number) => (p ? Math.round((r / p) * 100) : 0);

  return (
    <Tela>
      <Stack.Screen options={{ title: 'Orçamento' }} />
      <SeletorPeriodo data={data} aoMudar={setData} modo="ano" />
      <Cartao>
        <Linha style={{ justifyContent: 'space-between' }}><Texto>Previsto</Texto><Texto negrito>{moeda(totP)}</Texto></Linha>
        <Linha style={{ justifyContent: 'space-between' }}><Texto>Gasto</Texto><Texto negrito cor={totR > totP && totP ? c.perigo : c.texto}>{moeda(totR)}</Texto></Linha>
        {totP ? <Progresso valor={pct(totR, totP)} cor={totR > totP ? c.perigo : c.primaria} /> : null}
        <Texto tamanho="pequeno" suave>{totP ? `${pct(totR, totP)}% do orçamento usado.` : 'Orçamento deste ano ainda não cadastrado.'}</Texto>
      </Cartao>

      {eGestor && !editando ? (
        <Botao tipo="secundario" icone="create-outline" titulo="Cadastrar ou corrigir valores previstos" aoTocar={() => {
          setValores(Object.fromEntries(CATEGORIAS_DESPESA.map((k) => [k, dados.previsto[k] ? String(dados.previsto[k]).replace('.', ',') : ''])));
          setEditando(true);
        }} />
      ) : null}
      {editando ? (
        <Cartao>
          <Texto negrito>Valores previstos para {ano} (conforme orçamento aprovado em assembleia)</Texto>
          {CATEGORIAS_DESPESA.map((k) => (
            <Campo key={k} rotulo={k} valor={valores[k] ?? ''} aoMudar={(t) => setValores((v) => ({ ...v, [k]: t }))} keyboardType="decimal-pad" placeholder="0,00" />
          ))}
          <Botao titulo="Salvar orçamento" aoTocar={salvar} />
          <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setEditando(false)} />
        </Cartao>
      ) : null}

      {cats.map((k) => {
        const p = dados.previsto[k] ?? 0;
        const r = dados.realizado[k] ?? 0;
        const estourou = p > 0 && r > p;
        return (
          <Cartao key={k} destaque={estourou ? 'perigo' : undefined}>
            <Texto negrito>{k}</Texto>
            <Linha style={{ justifyContent: 'space-between' }}>
              <Texto suave>Previsto {p ? moeda(p) : '—'}</Texto>
              <Texto negrito cor={estourou ? c.perigo : c.texto}>Gasto {moeda(r)}</Texto>
            </Linha>
            {p ? <Progresso valor={pct(r, p)} cor={estourou ? c.perigo : c.primaria} /> : null}
            <Texto tamanho="pequeno" suave>
              {p ? (estourou ? `Passou ${moeda(r - p)} do previsto (${pct(r, p)}%)` : `${pct(r, p)}% usado · restam ${moeda(p - r)}`) : 'Sem valor previsto'}
            </Texto>
          </Cartao>
        );
      })}
    </Tela>
  );
}
