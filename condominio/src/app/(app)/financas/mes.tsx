import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { SeletorPeriodo } from '@/components/lista';
import { Carregando, Cartao, Linha, Subtitulo, Tela, Texto } from '@/components/ui';
import { abrirArquivo } from '@/lib/arquivos';
import { useConsulta } from '@/lib/consulta';
import { dataCurta, isoData, moeda } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { espaco, useTema } from '@/lib/tema';
import { Lancamento } from '@/lib/tipos';

/** Todos os lançamentos de um mês, receitas e despesas separadas. */
export default function Mes() {
  const { c } = useTema();
  const { condominioId } = useSessao();
  const { m } = useLocalSearchParams<{ m?: string }>();
  const hoje = new Date();
  const [mes, setMes] = useState(m ? new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1) : new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  const { dados } = useConsulta(() => {
    const fim = isoData(new Date(mes.getFullYear(), mes.getMonth() + 1, 0));
    return supabase.from('lancamentos').select('*').eq('condominio_id', condominioId).gte('data', isoData(mes)).lte('data', fim)
      .order('data', { ascending: false }).returns<(Lancamento & { nota_fiscal: string | null; forma_pagamento: string | null })[]>();
  }, [condominioId, mes.getTime()]);

  const receitas = dados?.filter((l) => l.tipo === 'receita') ?? [];
  const despesas = dados?.filter((l) => l.tipo === 'despesa') ?? [];
  const total = (l: Lancamento[]) => l.reduce((s, x) => s + Number(x.valor), 0);

  const lista = (itens: typeof receitas) => (
    <View style={{ gap: espaco.s }}>
      {itens.map((l) => (
        <Cartao key={l.id} aoTocar={l.comprovante_path ? () => abrirArquivo(l.comprovante_path!) : undefined} rotulo={`${l.descricao}, ${moeda(l.valor)}`}>
          <Linha style={{ justifyContent: 'space-between' }}>
            <Texto negrito style={{ flex: 1 }}>{l.descricao}</Texto>
            <Texto negrito cor={l.tipo === 'receita' ? c.sucesso : c.perigo}>{moeda(l.valor)}</Texto>
          </Linha>
          <Texto tamanho="pequeno" suave>
            {dataCurta(l.data)} · {l.categoria}{l.fornecedor ? ` · ${l.fornecedor}` : ''}{l.nota_fiscal ? ` · NF ${l.nota_fiscal}` : ''}
          </Texto>
          <Texto tamanho="pequeno" cor={l.comprovante_path ? c.primaria : c.textoSuave}>
            {l.comprovante_path ? '📎 Tocar para ver o comprovante' : 'Sem comprovante anexado'}
          </Texto>
        </Cartao>
      ))}
    </View>
  );

  return (
    <Tela>
      <Stack.Screen options={{ title: 'Receitas e despesas' }} />
      <SeletorPeriodo data={mes} aoMudar={setMes} />
      {!dados ? <Carregando /> : (
        <>
          <Cartao>
            <Linha style={{ justifyContent: 'space-between' }}><Texto>Entrou</Texto><Texto negrito cor={c.sucesso}>{moeda(total(receitas))}</Texto></Linha>
            <Linha style={{ justifyContent: 'space-between' }}><Texto>Saiu</Texto><Texto negrito cor={c.perigo}>{moeda(total(despesas))}</Texto></Linha>
            <Linha style={{ justifyContent: 'space-between' }}>
              <Texto negrito>Resultado</Texto>
              <Texto tamanho="subtitulo" negrito cor={total(receitas) - total(despesas) >= 0 ? c.sucesso : c.perigo}>{moeda(total(receitas) - total(despesas))}</Texto>
            </Linha>
          </Cartao>
          <Subtitulo>Despesas ({despesas.length})</Subtitulo>
          {despesas.length ? lista(despesas) : <Texto suave>Nenhuma despesa lançada.</Texto>}
          <Subtitulo>Receitas ({receitas.length})</Subtitulo>
          {receitas.length ? lista(receitas) : <Texto suave>Nenhuma receita lançada.</Texto>}
        </>
      )}
    </Tela>
  );
}
