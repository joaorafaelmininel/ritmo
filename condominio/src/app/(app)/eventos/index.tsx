import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { Botao, Carregando, Cartao, Linha, Opcoes, Selo, Tela, Texto, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataPorExtenso, horaDe } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { Evento, TIPOS_EVENTO } from '@/lib/tipos';


// Festas, encontros e reuniões: confirmação de presença sem listas copiadas no WhatsApp.
export default function Eventos() {
  const { condominioId, membro } = useSessao();
  const [quando, setQuando] = useState<'proximos' | 'passados'>('proximos');
  const { dados, recarregar } = useConsulta(() => {
    const agora = new Date(Date.now() - 6 * 3600000).toISOString();
    let q = supabase.from('eventos').select('*, eventos_presencas(unidade_id, adultos, criancas, rateio, prato)').eq('condominio_id', condominioId);
    q = quando === 'proximos' ? q.gte('inicio', agora).order('inicio') : q.lt('inicio', agora).order('inicio', { ascending: false }).limit(30);
    return q.returns<Evento[]>();
  }, [condominioId, quando]);

  return (
    <Tela aoAtualizar={recarregar}>
      <Stack.Screen options={{ title: 'Eventos e encontros' }} />
      <Texto suave>Festas, encontros de moradores e reuniões. Confirme a presença da sua casa com um toque.</Texto>
      <Botao icone="add-circle-outline" titulo="Organizar um evento" aoTocar={() => router.push('/eventos/novo')} />
      <Opcoes valor={quando} aoMudar={setQuando} opcoes={[{ valor: 'proximos', nome: 'Próximos' }, { valor: 'passados', nome: 'Já aconteceram' }]} />
      {!dados ? <Carregando /> : null}
      {dados?.length === 0 ? <Vazio icone="calendar-outline" texto={quando === 'proximos' ? 'Nenhum evento marcado. Que tal organizar um?' : 'Nenhum evento ainda.'} /> : null}
      {dados?.map((e) => {
        const p = e.eventos_presencas ?? [];
        const adultos = p.reduce((s, x) => s + x.adultos, 0);
        const criancas = p.reduce((s, x) => s + x.criancas, 0);
        const vou = p.some((x) => x.unidade_id === membro?.unidade_id);
        return (
          <Cartao key={e.id} aoTocar={() => router.push(`/eventos/${e.id}`)} destaque={vou ? 'sucesso' : undefined} rotulo={e.titulo}>
            <Linha>
              <Selo texto={`${TIPOS_EVENTO[e.tipo].emoji} ${TIPOS_EVENTO[e.tipo].nome}`} tipo="primaria" />
              {e.cancelado ? <Selo texto="Cancelado" tipo="perigo" /> : vou ? <Selo texto="Você vai ✓" tipo="sucesso" /> : null}
            </Linha>
            <Texto tamanho="subtitulo" negrito>{e.titulo}</Texto>
            <Texto>{dataPorExtenso(e.inicio)} · {horaDe(e.inicio)}</Texto>
            {e.local ? <Texto suave>📍 {e.local}</Texto> : null}
            <Texto tamanho="pequeno" suave>{p.length} casa{p.length === 1 ? '' : 's'} confirmada{p.length === 1 ? '' : 's'} · {adultos} adulto{adultos === 1 ? '' : 's'} · {criancas} criança{criancas === 1 ? '' : 's'}</Texto>
          </Cartao>
        );
      })}
    </Tela>
  );
}
