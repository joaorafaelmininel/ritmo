import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Botao, Carregando, Cartao, Linha, Progresso, Subtitulo, Tela, Texto } from '@/components/ui';
import { linkArquivo } from '@/lib/arquivos';
import { useConsulta } from '@/lib/consulta';
import { dataCurta, isoData, moeda, nomeMes } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { espaco, useTema } from '@/lib/tema';
import { Lancamento } from '@/lib/tipos';
import * as Linking from 'expo-linking';

function Seta({ nome, rotulo, aoTocar, desativado }: { nome: 'chevron-back' | 'chevron-forward'; rotulo: string; aoTocar: () => void; desativado?: boolean }) {
  const { c } = useTema();
  return (
    <Pressable
      onPress={aoTocar}
      disabled={desativado}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: desativado }}
      style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: c.primaria, alignItems: 'center', justifyContent: 'center', opacity: desativado ? 0.3 : 1 }}>
      <Ionicons name={nome} size={30} color={c.primaria} />
    </Pressable>
  );
}

// Prestação de contas aberta: todo morador vê receitas e despesas do condomínio.
export default function Financas() {
  const { c } = useTema();
  const { condominioId, eGestor } = useSessao();
  const hoje = new Date();
  const [mes, setMes] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  const { dados, carregando, recarregar } = useConsulta(async () => {
    const inicio = isoData(mes);
    const fim = isoData(new Date(mes.getFullYear(), mes.getMonth() + 1, 0));
    const [l, i] = await Promise.all([
      supabase.from('lancamentos').select('*').eq('condominio_id', condominioId).gte('data', inicio).lte('data', fim).order('data', { ascending: false }).returns<Lancamento[]>(),
      supabase.rpc('resumo_inadimplencia', { p_condominio: condominioId }),
    ]);
    const inad = (i.data as { unidades_total: number; unidades_em_atraso: number; valor_em_atraso: number }[] | null)?.[0] ?? null;
    return { data: { lancamentos: l.data ?? [], inad }, error: l.error };
  }, [condominioId, mes.getTime()]);

  const mudarMes = (d: number) => setMes(new Date(mes.getFullYear(), mes.getMonth() + d, 1));
  const ehMesAtual = mes.getFullYear() === hoje.getFullYear() && mes.getMonth() === hoje.getMonth();

  const receitas = dados?.lancamentos.filter((l) => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0) ?? 0;
  const despesas = dados?.lancamentos.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0) ?? 0;
  const porCategoria = Object.entries(
    (dados?.lancamentos ?? []).filter((l) => l.tipo === 'despesa').reduce<Record<string, number>>((acc, l) => {
      acc[l.categoria] = (acc[l.categoria] ?? 0) + Number(l.valor);
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);


  return (
    <Tela aoAtualizar={recarregar} atualizando={carregando && !!dados}>
      <Linha style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <Seta rotulo="Mês anterior" nome="chevron-back" aoTocar={() => mudarMes(-1)} />
        <Texto tamanho="subtitulo" negrito centro style={{ flex: 1 }}>
          {nomeMes(mes.getMonth())} de {mes.getFullYear()}
        </Texto>
        <Seta rotulo="Próximo mês" nome="chevron-forward" aoTocar={() => mudarMes(1)} desativado={ehMesAtual} />
      </Linha>

      {!dados ? <Carregando /> : (
        <>
          <Cartao>
            <Linha style={{ justifyContent: 'space-between' }}>
              <Texto>Entrou</Texto>
              <Texto negrito cor={c.sucesso}>{moeda(receitas)}</Texto>
            </Linha>
            <Linha style={{ justifyContent: 'space-between' }}>
              <Texto>Saiu</Texto>
              <Texto negrito cor={c.perigo}>{moeda(despesas)}</Texto>
            </Linha>
            <View style={{ height: 1, backgroundColor: c.borda, marginVertical: espaco.xs }} />
            <Linha style={{ justifyContent: 'space-between' }}>
              <Texto negrito>Resultado do mês</Texto>
              <Texto tamanho="subtitulo" negrito cor={receitas - despesas >= 0 ? c.sucesso : c.perigo}>{moeda(receitas - despesas)}</Texto>
            </Linha>
          </Cartao>

          {dados.inad ? (
            <Cartao>
              <Texto negrito>Inadimplência hoje</Texto>
              <Texto>
                {dados.inad.unidades_em_atraso} de {dados.inad.unidades_total} unidades com taxa em atraso ({moeda(dados.inad.valor_em_atraso)}).
              </Texto>
              <Texto tamanho="pequeno" suave>Por respeito à privacidade, não mostramos quais unidades.</Texto>
            </Cartao>
          ) : null}

          <Botao tipo="secundario" icone="receipt-outline" titulo="Meus boletos" aoTocar={() => router.push('/cobrancas')} />
          {eGestor ? <Botao icone="add-circle-outline" titulo="Lançar receita ou despesa" aoTocar={() => router.push('/financas/lancamento')} /> : null}

          {porCategoria.length ? <Subtitulo>Para onde foi o dinheiro</Subtitulo> : null}
          {porCategoria.map(([cat, v]) => (
            <View key={cat} style={{ gap: 4 }}>
              <Linha style={{ justifyContent: 'space-between' }}>
                <Texto>{cat}</Texto>
                <Texto negrito>{moeda(v)}</Texto>
              </Linha>
              <Progresso valor={(v / despesas) * 100} cor={c.perigo} />
            </View>
          ))}

          <Subtitulo>Todos os lançamentos</Subtitulo>
          {dados.lancamentos.length === 0 ? <Texto suave>Nenhum lançamento neste mês.</Texto> : null}
          {dados.lancamentos.map((l) => (
            <Cartao
              key={l.id}
              aoTocar={l.comprovante_path ? async () => Linking.openURL(await linkArquivo(l.comprovante_path!)) : undefined}
              rotulo={`${l.descricao}, ${moeda(l.valor)}`}>
              <Linha style={{ justifyContent: 'space-between' }}>
                <Texto negrito style={{ flex: 1 }}>{l.descricao}</Texto>
                <Texto negrito cor={l.tipo === 'receita' ? c.sucesso : c.perigo}>{l.tipo === 'receita' ? '+' : '−'} {moeda(l.valor)}</Texto>
              </Linha>
              <Texto tamanho="pequeno" suave>
                {dataCurta(l.data)} · {l.categoria}{l.fornecedor ? ` · ${l.fornecedor}` : ''}{l.comprovante_path ? ' · 📎 ver comprovante' : ''}
              </Texto>
            </Cartao>
          ))}
        </>
      )}
    </Tela>
  );
}
