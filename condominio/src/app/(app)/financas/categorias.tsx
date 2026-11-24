import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Carregando, Cartao, Linha, Opcoes, Progresso, Tela, Texto } from '@/components/ui';
import { abrirArquivo } from '@/lib/arquivos';
import { useConsulta } from '@/lib/consulta';
import { dataCurta, isoData, moeda } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { ALVO_TOQUE, espaco, useTema } from '@/lib/tema';
import { Lancamento } from '@/lib/tipos';

type Periodo = 'mes' | 'ano' | 'anterior' | '12m';

function intervalo(p: Periodo): [string, string] {
  const h = new Date();
  if (p === 'mes') return [isoData(new Date(h.getFullYear(), h.getMonth(), 1)), isoData(h)];
  if (p === 'ano') return [`${h.getFullYear()}-01-01`, isoData(h)];
  if (p === 'anterior') return [`${h.getFullYear() - 1}-01-01`, `${h.getFullYear() - 1}-12-31`];
  return [isoData(new Date(h.getFullYear(), h.getMonth() - 11, 1)), isoData(h)];
}

/** Para onde vai (ou de onde vem) o dinheiro, agrupado pela classificação contábil. */
export default function Categorias() {
  const { c } = useTema();
  const { condominioId } = useSessao();
  const { tipo = 'despesa' } = useLocalSearchParams<{ tipo?: 'despesa' | 'receita' }>();
  const [periodo, setPeriodo] = useState<Periodo>('ano');
  const [aberta, setAberta] = useState<string | null>(null);

  const { dados } = useConsulta(() => {
    const [de, ate] = intervalo(periodo);
    return supabase.from('lancamentos').select('*').eq('condominio_id', condominioId).eq('tipo', tipo).gte('data', de).lte('data', ate)
      .order('data', { ascending: false }).returns<(Lancamento & { nota_fiscal: string | null })[]>();
  }, [condominioId, tipo, periodo]);

  const total = (dados ?? []).reduce((s, l) => s + Number(l.valor), 0);
  const grupos = Object.entries(
    (dados ?? []).reduce<Record<string, typeof dados>>((acc, l) => { (acc[l.categoria] ??= []).push(l); return acc; }, {}),
  ).map(([cat, itens]) => ({ cat, itens: itens!, soma: itens!.reduce((s, l) => s + Number(l.valor), 0) })).sort((a, b) => b.soma - a.soma);
  const cor = tipo === 'despesa' ? c.perigo : c.sucesso;

  return (
    <Tela>
      <Stack.Screen options={{ title: tipo === 'despesa' ? 'Despesas por categoria' : 'Receitas por categoria' }} />
      <Opcoes valor={periodo} aoMudar={setPeriodo} opcoes={[
        { valor: 'mes', nome: 'Este mês' }, { valor: 'ano', nome: 'Este ano' }, { valor: '12m', nome: 'Últimos 12 meses' }, { valor: 'anterior', nome: 'Ano passado' },
      ]} />
      {!dados ? <Carregando /> : (
        <>
          <Cartao>
            <Texto>Total {tipo === 'despesa' ? 'gasto' : 'recebido'}</Texto>
            <Texto tamanho="grande" negrito cor={cor}>{moeda(total)}</Texto>
            <Texto tamanho="pequeno" suave>Toque numa categoria para ver cada lançamento e a nota.</Texto>
          </Cartao>
          {grupos.length === 0 ? <Texto suave>Nenhum lançamento neste período.</Texto> : null}
          {grupos.map((g) => {
            const pct = total ? Math.round((g.soma / total) * 100) : 0;
            const expandida = aberta === g.cat;
            return (
              <Cartao key={g.cat}>
                <Pressable onPress={() => setAberta(expandida ? null : g.cat)} accessibilityRole="button" accessibilityState={{ expanded: expandida }}
                  accessibilityLabel={`${g.cat}: ${moeda(g.soma)}, ${pct} por cento. ${expandida ? 'Toque para fechar' : 'Toque para ver os lançamentos'}`}
                  style={{ minHeight: ALVO_TOQUE, gap: espaco.xs }}>
                  <Linha style={{ justifyContent: 'space-between' }}>
                    <Texto negrito style={{ flex: 1 }}>{g.cat}</Texto>
                    <Texto negrito>{moeda(g.soma)}</Texto>
                  </Linha>
                  <Progresso valor={pct} cor={cor} />
                  <Texto tamanho="pequeno" suave>{pct}% do total · {g.itens.length} lançamento{g.itens.length > 1 ? 's' : ''} · {expandida ? 'fechar ▲' : 'ver ▼'}</Texto>
                </Pressable>
                {expandida ? (
                  <View style={{ gap: espaco.s, marginTop: espaco.s }}>
                    {g.itens.map((l) => (
                      <Pressable key={l.id} disabled={!l.comprovante_path} onPress={() => abrirArquivo(l.comprovante_path!)}
                        accessibilityRole={l.comprovante_path ? 'button' : undefined}
                        style={{ borderTopWidth: 1, borderColor: c.borda, paddingTop: espaco.s, minHeight: ALVO_TOQUE }}>
                        <Linha style={{ justifyContent: 'space-between' }}>
                          <Texto style={{ flex: 1 }}>{l.descricao}</Texto>
                          <Texto negrito>{moeda(l.valor)}</Texto>
                        </Linha>
                        <Texto tamanho="pequeno" suave>
                          {dataCurta(l.data)}{l.fornecedor ? ` · ${l.fornecedor}` : ''}{l.nota_fiscal ? ` · NF ${l.nota_fiscal}` : ''}
                        </Texto>
                        <Texto tamanho="pequeno" cor={l.comprovante_path ? c.primaria : c.textoSuave}>
                          {l.comprovante_path ? '📎 Ver nota / comprovante' : 'Sem comprovante anexado'}
                        </Texto>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </Cartao>
            );
          })}
        </>
      )}
    </Tela>
  );
}
