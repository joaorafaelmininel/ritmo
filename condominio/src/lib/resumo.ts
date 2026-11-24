import { useConsulta } from './consulta';
import { isoData } from './formato';
import { useSessao } from './sessao';
import { supabase } from './supabase';

export type AvisoResumo = { id: string; titulo: string; importante: boolean; publicado_em: string; lido: boolean };

export type Resumo = {
  avisos: AvisoResumo[];
  naoLidos: number;
  encomendas: number;
  cobranca: { valor: number; vencimento: string } | null;
  paraAprovar: number;
  ocorrenciasAbertas: number;
  manutencoesVencidas: number;
};

/** Números que aparecem como "bolinhas" nos botões (novidades e pendências). */
export function useResumo() {
  const { membro, condominioId, eGestor, sessao } = useSessao();
  const unidadeId = membro?.unidade_id;

  return useConsulta<Resumo>(async () => {
    const uid = sessao!.user.id;
    const desde = new Date(Date.now() - 30 * 86400000).toISOString();
    const contar = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
    const [avisos, lidos, encomendas, cob, paraAprovar, ocorrencias, manutencoes] = await Promise.all([
      supabase.from('avisos').select('id, titulo, importante, publicado_em').eq('condominio_id', condominioId)
        .gte('publicado_em', desde).order('importante', { ascending: false }).order('publicado_em', { ascending: false }).limit(20),
      supabase.from('avisos_leituras').select('aviso_id').eq('perfil_id', uid),
      unidadeId ? contar(supabase.from('encomendas').select('id', { count: 'exact', head: true }).eq('unidade_id', unidadeId).is('retirada_em', null)) : 0,
      unidadeId
        ? supabase.from('cobrancas').select('valor, vencimento').eq('unidade_id', unidadeId).eq('status', 'aberta').order('vencimento').limit(1)
        : Promise.resolve({ data: [] as { valor: number; vencimento: string }[] }),
      eGestor ? contar(supabase.from('reservas').select('id', { count: 'exact', head: true }).eq('condominio_id', condominioId).eq('status', 'pendente')) : 0,
      eGestor ? contar(supabase.from('chamados').select('id', { count: 'exact', head: true }).eq('condominio_id', condominioId).in('status', ['aberto', 'em_andamento'])) : 0,
      eGestor ? contar(supabase.from('manutencoes').select('id', { count: 'exact', head: true }).eq('condominio_id', condominioId).lt('proxima', isoData(new Date()))) : 0,
    ]);
    const lidosSet = new Set((lidos.data ?? []).map((l) => l.aviso_id));
    const lista = (avisos.data ?? []).map((a) => ({ ...a, lido: lidosSet.has(a.id) }));
    return {
      data: {
        avisos: lista,
        naoLidos: lista.filter((a) => !a.lido).length,
        encomendas,
        cobranca: (cob as { data: { valor: number; vencimento: string }[] | null }).data?.[0] ?? null,
        paraAprovar,
        ocorrenciasAbertas: ocorrencias,
        manutencoesVencidas: manutencoes,
      },
      error: avisos.error,
    };
  }, [condominioId, unidadeId]);
}
