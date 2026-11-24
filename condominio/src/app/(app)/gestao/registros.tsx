import { Stack } from 'expo-router';

import { avisar, Botao, Carregando, Cartao, Selo, Subtitulo, Tela, Texto } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { quando } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';

type Pedido = { id: string; tipo: string; detalhes: string | null; status: string; criado_em: string; perfis: { nome: string } | null };
type Registro = { id: number; acao: string; tabela: string; criado_em: string; perfis: { nome: string } | null };

const ACOES: Record<string, string> = { insert: 'criou', update: 'alterou', delete: 'apagou' };
const TABELAS: Record<string, string> = { lancamentos: 'lançamento financeiro', cobrancas: 'cobrança', membros: 'cadastro de morador', documentos: 'documento', orcamento: 'orçamento' };

export default function Registros() {
  const { condominioId } = useSessao();
  const { dados, recarregar } = useConsulta(async () => {
    const [p, a] = await Promise.all([
      supabase.from('solicitacoes_titular').select('id, tipo, detalhes, status, criado_em, perfis(nome)').order('criado_em', { ascending: false }).returns<Pedido[]>(),
      supabase.from('auditoria').select('id, acao, tabela, criado_em, perfis(nome)').eq('condominio_id', condominioId).order('criado_em', { ascending: false }).limit(60).returns<Registro[]>(),
    ]);
    return { data: { pedidos: p.data ?? [], auditoria: a.data ?? [] }, error: p.error ?? a.error };
  }, [condominioId]);

  async function concluir(id: string) {
    const { error } = await supabase.from('solicitacoes_titular').update({ status: 'concluida', concluido_em: new Date().toISOString() }).eq('id', id);
    if (error) return avisar('Erro', mensagemErro(error));
    recarregar();
  }

  if (!dados) return <Carregando />;
  return (
    <Tela>
      <Stack.Screen options={{ title: 'Registros' }} />
      <Subtitulo>Pedidos de moradores sobre dados (LGPD)</Subtitulo>
      <Texto tamanho="pequeno" suave>Responda em até 15 dias (LGPD, art. 19, II). Pedidos de cópia e exclusão o próprio morador faz no app.</Texto>
      {dados.pedidos.length === 0 ? <Texto suave>Nenhum pedido.</Texto> : null}
      {dados.pedidos.map((p) => (
        <Cartao key={p.id} destaque={p.status !== 'concluida' ? 'alerta' : undefined}>
          <Selo texto={p.status === 'concluida' ? 'Concluído' : 'Aguardando resposta'} tipo={p.status === 'concluida' ? 'sucesso' : 'alerta'} />
          <Texto negrito>{p.perfis?.nome ?? 'Ex-morador'} — {p.tipo}</Texto>
          {p.detalhes ? <Texto>{p.detalhes}</Texto> : null}
          <Texto tamanho="pequeno" suave>{quando(p.criado_em)}</Texto>
          {p.status !== 'concluida' ? <Botao tipo="secundario" titulo="Marcar como respondido" aoTocar={() => concluir(p.id)} /> : null}
        </Cartao>
      ))}

      <Subtitulo>Alterações recentes</Subtitulo>
      <Texto tamanho="pequeno" suave>Registro automático de mudanças em finanças, cadastro e documentos — transparência para o conselho.</Texto>
      {dados.auditoria.map((r) => (
        <Texto key={r.id} tamanho="pequeno">
          {quando(r.criado_em)} · {r.perfis?.nome ?? 'Sistema'} {ACOES[r.acao] ?? r.acao} {TABELAS[r.tabela] ?? r.tabela}
        </Texto>
      ))}
    </Tela>
  );
}
