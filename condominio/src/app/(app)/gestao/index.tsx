import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { Botao, Carregando, Cartao, Ladrilho, Linha, Progresso, Subtitulo, Tela, Texto } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { isoData, moeda } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { espaco, useTema } from '@/lib/tema';

// Painel da síndica: indicadores das quatro dimensões e atalhos de gestão.
export default function Gestao() {
  const { c } = useTema();
  const { condominioId, membro } = useSessao();
  const { dados, carregando, recarregar } = useConsulta(async () => {
    const hoje = isoData(new Date());
    const conta = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
    const [unidades, membros, chamados, reservas, manut, pedidos, inad, projetos, unidadesComMorador] = await Promise.all([
      conta(supabase.from('unidades').select('id', { count: 'exact', head: true }).eq('condominio_id', condominioId)),
      conta(supabase.from('membros').select('id', { count: 'exact', head: true }).eq('condominio_id', condominioId).eq('ativo', true)),
      conta(supabase.from('chamados').select('id', { count: 'exact', head: true }).eq('condominio_id', condominioId).in('status', ['aberto', 'em_andamento'])),
      conta(supabase.from('reservas').select('id', { count: 'exact', head: true }).eq('condominio_id', condominioId).eq('status', 'pendente')),
      conta(supabase.from('manutencoes').select('id', { count: 'exact', head: true }).eq('condominio_id', condominioId).lt('proxima', hoje)),
      conta(supabase.from('solicitacoes_titular').select('id', { count: 'exact', head: true }).neq('status', 'concluida')),
      supabase.rpc('resumo_inadimplencia', { p_condominio: condominioId }),
      supabase.from('projetos').select('progresso, status, tipo').eq('condominio_id', condominioId),
      supabase.from('membros').select('unidade_id').eq('condominio_id', condominioId).eq('ativo', true).not('unidade_id', 'is', null),
    ]);
    const proj = (projetos.data ?? []).filter((p) => p.tipo === 'projeto');
    const i = (inad.data as { unidades_em_atraso: number; valor_em_atraso: number }[] | null)?.[0];
    return {
      data: {
        unidades, membros, chamados, reservas, manut, pedidos,
        adesao: unidades ? Math.round((new Set((unidadesComMorador.data ?? []).map((m) => m.unidade_id)).size / unidades) * 100) : 0,
        emAtraso: i?.unidades_em_atraso ?? 0, valorAtraso: i?.valor_em_atraso ?? 0,
        progressoPlano: proj.length ? Math.round(proj.reduce((s, p) => s + p.progresso, 0) / proj.length) : 0,
      },
      error: null,
    };
  }, [condominioId]);

  const ir = (r: string) => () => router.push(r as never);
  if (!dados) return <Carregando />;
  return (
    <Tela aoAtualizar={recarregar} atualizando={carregando}>
      <Stack.Screen options={{ title: 'Painel da gestão' }} />
      <Texto tamanho="subtitulo" negrito>{membro?.condominios.nome}</Texto>

      <Cartao>
        <Texto negrito>Adesão ao app: {dados.adesao}% das unidades</Texto>
        <Progresso valor={dados.adesao} cor={c.sucesso} />
        <Texto tamanho="pequeno" suave>{dados.membros} pessoas cadastradas em {dados.unidades} unidades.</Texto>
      </Cartao>
      <Cartao>
        <Texto negrito>Plano de gestão: {dados.progressoPlano}% dos projetos</Texto>
        <Progresso valor={dados.progressoPlano} />
      </Cartao>
      <Cartao destaque={dados.emAtraso ? 'alerta' : undefined}>
        <Texto negrito>Inadimplência</Texto>
        <Texto>{dados.emAtraso} unidades · {moeda(dados.valorAtraso)}</Texto>
      </Cartao>

      <Subtitulo>Pendências</Subtitulo>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
        <Ladrilho titulo="Ocorrências abertas" icone="hammer-outline" aoTocar={ir('/chamados')} contador={dados.chamados} />
        <Ladrilho titulo="Reservas p/ aprovar" icone="calendar-outline" aoTocar={ir('/reservas')} contador={dados.reservas} />
        <Ladrilho titulo="Manutenções atrasadas" icone="construct-outline" aoTocar={ir('/manutencoes')} contador={dados.manut} />
        <Ladrilho titulo="Pedidos LGPD" icone="shield-outline" aoTocar={ir('/gestao/registros')} contador={dados.pedidos} />
      </View>

      <Subtitulo>Cadastro</Subtitulo>
      <Botao icone="grid-outline" titulo="Unidades e códigos de acesso" aoTocar={ir('/gestao/unidades')} />
      <Botao tipo="secundario" icone="people-outline" titulo="Moradores e funções" aoTocar={ir('/gestao/moradores')} />
      <Botao tipo="secundario" icone="settings-outline" titulo="Dados do condomínio" aoTocar={ir('/gestao/condominio')} />

      <Subtitulo>Atalhos</Subtitulo>
      <Linha>
        <Botao tipo="secundario" icone="megaphone-outline" titulo="Novo aviso" aoTocar={ir('/aviso/novo')} style={{ flexGrow: 1 }} />
        <Botao tipo="secundario" icone="checkbox-outline" titulo="Nova enquete" aoTocar={ir('/enquetes/nova')} style={{ flexGrow: 1 }} />
      </Linha>
      <Linha>
        <Botao tipo="secundario" icone="cash-outline" titulo="Lançamento" aoTocar={ir('/financas/lancamento')} style={{ flexGrow: 1 }} />
        <Botao tipo="secundario" icone="receipt-outline" titulo="Cobranças" aoTocar={ir('/cobrancas')} style={{ flexGrow: 1 }} />
      </Linha>
      <Botao tipo="secundario" icone="cube-outline" titulo="Registrar encomenda" aoTocar={ir('/encomendas')} />
      <Botao tipo="secundario" icone="time-outline" titulo="Registro de alterações e pedidos LGPD" aoTocar={ir('/gestao/registros')} />
    </Tela>
  );
}
