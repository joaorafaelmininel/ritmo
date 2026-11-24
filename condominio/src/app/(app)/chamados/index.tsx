import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { Botao, Carregando, Cartao, Erro, Linha, Opcoes, Selo, Tela, Texto, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { nomeUnidade, quando } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { CATEGORIAS_CHAMADO, Chamado, corStatus, STATUS_CHAMADO } from '@/lib/tipos';

export default function Chamados() {
  const { condominioId, eGestor } = useSessao();
  const [filtro, setFiltro] = useState<'abertos' | 'todos'>('abertos');
  const { dados, erro, carregando, recarregar } = useConsulta(() => {
    let q = supabase.from('chamados').select('id, titulo, categoria, status, criado_em, local, unidades(bloco, numero)')
      .eq('condominio_id', condominioId).order('criado_em', { ascending: false }).limit(200);
    if (filtro === 'abertos') q = q.in('status', ['aberto', 'em_andamento']);
    return q.returns<Chamado[]>();
  }, [condominioId, filtro]);

  return (
    <Tela aoAtualizar={recarregar} atualizando={carregando && !!dados}>
      <Stack.Screen options={{ title: eGestor ? 'Ocorrências' : 'Minhas ocorrências' }} />
      <Botao icone="add-circle-outline" titulo="Registrar ocorrência" aoTocar={() => router.push('/chamados/novo')} />
      <Texto suave>
        {eGestor
          ? 'Todas as ocorrências dos moradores. Responda e mude a situação para manter todos informados.'
          : 'Avise sobre consertos, limpeza, segurança ou convivência. Só você e a gestão veem as suas ocorrências.'}
      </Texto>
      <Opcoes valor={filtro} aoMudar={setFiltro} opcoes={[{ valor: 'abertos', nome: 'Em aberto' }, { valor: 'todos', nome: 'Todos' }]} />
      {erro ? <Erro texto={erro} aoTentar={recarregar} /> : null}
      {!dados && carregando ? <Carregando /> : null}
      {dados?.length === 0 ? <Vazio icone="checkmark-done-outline" texto="Nenhuma ocorrência aqui." /> : null}
      {dados?.map((ch) => (
        <Cartao key={ch.id} aoTocar={() => router.push(`/chamados/${ch.id}`)} rotulo={`${ch.titulo}, ${STATUS_CHAMADO[ch.status]}`}>
          <Linha>
            <Selo texto={STATUS_CHAMADO[ch.status]} tipo={corStatus(ch.status)} />
            <Selo texto={CATEGORIAS_CHAMADO[ch.categoria] ?? ch.categoria} />
          </Linha>
          <Texto tamanho="subtitulo" negrito>{ch.titulo}</Texto>
          <Texto tamanho="pequeno" suave>
            {quando(ch.criado_em)}
            {eGestor && ch.unidades ? ` · ${nomeUnidade(ch.unidades)}` : ''}
            {ch.local ? ` · ${ch.local}` : ''}
          </Texto>
        </Cartao>
      ))}
    </Tela>
  );
}
