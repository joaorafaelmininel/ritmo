import { Stack } from 'expo-router';
import { useState } from 'react';

import { SeletorPeriodo } from '@/components/lista';
import { Carregando, Cartao, Linha, Opcoes, Selo, Tela, Texto } from '@/components/ui';
import { abrirArquivo } from '@/lib/arquivos';
import { useConsulta } from '@/lib/consulta';
import { dataCurta, isoData, moeda } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { useTema } from '@/lib/tema';
import { Lancamento } from '@/lib/tipos';

/** Cada pagamento do mês com sua nota fiscal ou comprovante — e quais ainda estão sem. */
export default function Notas() {
  const { c } = useTema();
  const { condominioId } = useSessao();
  const h = new Date();
  const [mes, setMes] = useState(new Date(h.getFullYear(), h.getMonth(), 1));
  const [categoria, setCategoria] = useState('todas');

  const { dados } = useConsulta(() => supabase.from('lancamentos').select('*').eq('condominio_id', condominioId).eq('tipo', 'despesa')
    .gte('data', isoData(mes)).lte('data', isoData(new Date(mes.getFullYear(), mes.getMonth() + 1, 0)))
    .order('data', { ascending: false }).returns<(Lancamento & { nota_fiscal: string | null; forma_pagamento: string | null })[]>(),
  [condominioId, mes.getTime()]);

  const categorias = [...new Set((dados ?? []).map((l) => l.categoria))].sort();
  const lista = (dados ?? []).filter((l) => categoria === 'todas' || l.categoria === categoria);
  const comNota = (dados ?? []).filter((l) => l.comprovante_path).length;

  return (
    <Tela>
      <Stack.Screen options={{ title: 'Notas e comprovantes' }} />
      <SeletorPeriodo data={mes} aoMudar={(d) => { setMes(d); setCategoria('todas'); }} />
      {!dados ? <Carregando /> : (
        <>
          <Cartao destaque={dados.length && comNota < dados.length ? 'alerta' : undefined}>
            <Texto negrito>{comNota} de {dados.length} pagamentos com comprovante</Texto>
            <Texto tamanho="pequeno" suave>Toque num pagamento para abrir a nota fiscal ou o recibo.</Texto>
          </Cartao>
          {categorias.length > 1 ? (
            <Opcoes valor={categoria} aoMudar={setCategoria} opcoes={[{ valor: 'todas', nome: 'Todas' }, ...categorias.map((x) => ({ valor: x, nome: x }))]} />
          ) : null}
          {lista.length === 0 ? <Texto suave>Nenhuma despesa neste mês.</Texto> : null}
          {lista.map((l) => (
            <Cartao key={l.id} aoTocar={l.comprovante_path ? () => abrirArquivo(l.comprovante_path!) : undefined} rotulo={`${l.descricao}, ${moeda(l.valor)}`}>
              <Linha>
                <Selo texto={l.categoria} />
                {l.comprovante_path ? <Selo texto="📎 Com nota" tipo="sucesso" /> : <Selo texto="Sem comprovante" tipo="alerta" />}
              </Linha>
              <Linha style={{ justifyContent: 'space-between' }}>
                <Texto negrito style={{ flex: 1 }}>{l.descricao}</Texto>
                <Texto negrito cor={c.perigo}>{moeda(l.valor)}</Texto>
              </Linha>
              <Texto tamanho="pequeno" suave>
                Pago em {dataCurta(l.data)}{l.fornecedor ? ` · ${l.fornecedor}` : ''}{l.nota_fiscal ? ` · NF nº ${l.nota_fiscal}` : ''}{l.forma_pagamento ? ` · ${l.forma_pagamento}` : ''}
              </Texto>
            </Cartao>
          ))}
        </>
      )}
    </Tela>
  );
}
