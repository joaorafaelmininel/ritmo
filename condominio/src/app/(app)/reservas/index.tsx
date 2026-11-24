import { router, Stack } from 'expo-router';

import { avisar, Botao, Carregando, Cartao, Linha, Selo, Subtitulo, Tela, Texto, useConfirmar, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataPorExtenso, isoData, moeda, nomeUnidade } from '@/lib/formato';
import { notificar } from '@/lib/notificacoes';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { Area, PERIODOS, Reserva } from '@/lib/tipos';

const STATUS: Record<string, { nome: string; tipo: 'alerta' | 'sucesso' | 'perigo' | 'neutro' }> = {
  pendente: { nome: 'Aguardando aprovação', tipo: 'alerta' },
  confirmada: { nome: 'Confirmada', tipo: 'sucesso' },
  recusada: { nome: 'Não aprovada', tipo: 'perigo' },
  cancelada: { nome: 'Cancelada', tipo: 'neutro' },
};

export default function Reservas() {
  const { condominioId, eGestor, membro } = useSessao();
  const confirmar = useConfirmar();
  const { dados, carregando, recarregar } = useConsulta(async () => {
    const hoje = isoData(new Date());
    const [areas, minhas, pendentes] = await Promise.all([
      supabase.from('areas_comuns').select('*').eq('condominio_id', condominioId).eq('ativa', true).order('nome').returns<Area[]>(),
      membro?.unidade_id
        ? supabase.from('reservas').select('*, areas_comuns(nome)').eq('unidade_id', membro.unidade_id).gte('data', hoje).in('status', ['pendente', 'confirmada']).order('data').returns<Reserva[]>()
        : Promise.resolve({ data: [] as Reserva[] }),
      eGestor
        ? supabase.from('reservas').select('*, areas_comuns(nome), unidades(bloco, numero)').eq('condominio_id', condominioId).eq('status', 'pendente').order('data').returns<Reserva[]>()
        : Promise.resolve({ data: [] as Reserva[] }),
    ]);
    return { data: { areas: areas.data ?? [], minhas: minhas.data ?? [], pendentes: pendentes.data ?? [] }, error: areas.error };
  }, [condominioId]);

  async function decidir(r: Reserva, status: 'confirmada' | 'recusada') {
    const { error } = await supabase.from('reservas').update({ status }).eq('id', r.id);
    if (error) return avisar('Não foi possível', mensagemErro(error));
    notificar('reserva', r.id);
    recarregar();
  }

  if (!dados) return <Carregando />;
  return (
    <Tela aoAtualizar={recarregar} atualizando={carregando}>
      <Stack.Screen options={{ title: 'Reservas' }} />

      {dados.pendentes.length ? (
        <>
          <Subtitulo>Para aprovar</Subtitulo>
          {dados.pendentes.map((r) => (
            <Cartao key={r.id} destaque="alerta">
              <Texto tamanho="subtitulo" negrito>{r.areas_comuns?.nome}</Texto>
              <Texto>{dataPorExtenso(r.data)} · {PERIODOS[r.periodo]}</Texto>
              <Texto suave>{nomeUnidade(r.unidades)}{r.observacao ? ` — “${r.observacao}”` : ''}</Texto>
              <Linha>
                <Botao titulo="Aprovar" icone="checkmark" aoTocar={() => decidir(r, 'confirmada')} style={{ flex: 1 }} />
                <Botao titulo="Recusar" tipo="perigo" aoTocar={() => confirmar('Recusar reserva?', 'A unidade será avisada.', () => decidir(r, 'recusada'), 'Sim, recusar')} style={{ flex: 1 }} />
              </Linha>
            </Cartao>
          ))}
        </>
      ) : null}

      <Subtitulo>Escolha o espaço</Subtitulo>
      {dados.areas.length === 0 ? <Vazio icone="calendar-outline" texto="Nenhum espaço disponível para reserva." /> : null}
      {dados.areas.map((a) => (
        <Cartao key={a.id} aoTocar={() => router.push(`/reservas/${a.id}`)} rotulo={`Reservar ${a.nome}`}>
          <Texto tamanho="subtitulo" negrito>{a.nome}</Texto>
          {a.descricao ? <Texto suave>{a.descricao}</Texto> : null}
          <Linha>
            {a.capacidade ? <Selo texto={`Até ${a.capacidade} pessoas`} /> : null}
            {Number(a.taxa) > 0 ? <Selo texto={`Taxa ${moeda(a.taxa)}`} tipo="alerta" /> : <Selo texto="Sem taxa" tipo="sucesso" />}
          </Linha>
        </Cartao>
      ))}
      {eGestor ? <Botao tipo="secundario" icone="add" titulo="Cadastrar espaço" aoTocar={() => router.push('/reservas/area-nova')} /> : null}

      <Subtitulo>Minhas próximas reservas</Subtitulo>
      {dados.minhas.length === 0 ? <Texto suave>Você não tem reservas marcadas.</Texto> : null}
      {dados.minhas.map((r) => (
        <Cartao key={r.id}>
          <Selo texto={STATUS[r.status].nome} tipo={STATUS[r.status].tipo} />
          <Texto tamanho="subtitulo" negrito>{r.areas_comuns?.nome}</Texto>
          <Texto>{dataPorExtenso(r.data)} · {PERIODOS[r.periodo]}</Texto>
          <Botao tipo="perigo" titulo="Cancelar reserva" aoTocar={() => confirmar('Cancelar reserva?', 'O espaço ficará livre para outras unidades.', async () => {
            await supabase.from('reservas').update({ status: 'cancelada' }).eq('id', r.id);
            recarregar();
          }, 'Sim, cancelar')} />
        </Cartao>
      ))}
    </Tela>
  );
}
