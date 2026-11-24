import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, Carregando, Cartao, Linha, Selo, Tela, Texto, useConfirmar, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataPorExtenso, horaDe } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';

type Comissao = {
  id: string; nome: string; descricao: string | null; ativa: boolean;
  comissoes_membros: { perfil_id: string; coordenador: boolean; perfis: { nome: string } | null }[];
};
type Reuniao = { id: string; titulo: string; inicio: string; comissao_id: string };

// Comissões de condôminos: grupos voluntários (obras, segurança, eventos, finanças).
export default function Comissoes() {
  const { condominioId, sessao, eGestor } = useSessao();
  const uid = sessao!.user.id;
  const confirmar = useConfirmar();
  const [nova, setNova] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');

  const { dados, recarregar } = useConsulta(async () => {
    const [c, r] = await Promise.all([
      supabase.from('comissoes').select('*, comissoes_membros(perfil_id, coordenador, perfis(nome))').eq('condominio_id', condominioId).eq('ativa', true).order('nome').returns<Comissao[]>(),
      supabase.from('eventos').select('id, titulo, inicio, comissao_id').eq('condominio_id', condominioId).not('comissao_id', 'is', null)
        .eq('cancelado', false).gte('inicio', new Date().toISOString()).order('inicio').returns<Reuniao[]>(),
    ]);
    return { data: { comissoes: c.data ?? [], reunioes: r.data ?? [] }, error: c.error };
  }, [condominioId]);

  async function criar() {
    if (nome.trim().length < 3) return avisar('Dê um nome à comissão');
    const { error } = await supabase.from('comissoes').insert({ condominio_id: condominioId, nome: nome.trim(), descricao: descricao.trim() || null });
    if (error) return avisar('Não foi possível criar', mensagemErro(error));
    setNova(false); setNome(''); setDescricao('');
    recarregar();
  }

  if (!dados) return <Carregando />;
  return (
    <Tela aoAtualizar={recarregar}>
      <Stack.Screen options={{ title: 'Comissões de condôminos' }} />
      <Texto suave>Grupos de moradores voluntários que ajudam a gestão a estudar e acompanhar temas importantes. Qualquer condômino pode participar.</Texto>
      {dados.comissoes.length === 0 ? <Vazio icone="people-outline" texto="Nenhuma comissão criada ainda." /> : null}
      {dados.comissoes.map((cm) => {
        const membros = cm.comissoes_membros ?? [];
        const participo = membros.some((m) => m.perfil_id === uid);
        const reunioes = dados.reunioes.filter((r) => r.comissao_id === cm.id);
        return (
          <Cartao key={cm.id} destaque={participo ? 'sucesso' : undefined}>
            <Linha style={{ justifyContent: 'space-between' }}>
              <Texto tamanho="subtitulo" negrito style={{ flex: 1 }}>{cm.nome}</Texto>
              <Selo texto={`${membros.length} participante${membros.length === 1 ? '' : 's'}`} tipo="primaria" />
            </Linha>
            {cm.descricao ? <Texto>{cm.descricao}</Texto> : null}
            {membros.length ? <Texto tamanho="pequeno" suave>{membros.map((m) => `${m.perfis?.nome ?? 'Morador(a)'}${m.coordenador ? ' (coordenação)' : ''}`).join(', ')}</Texto> : null}
            {reunioes.map((r) => (
              <Cartao key={r.id} aoTocar={() => router.push(`/eventos/${r.id}`)} rotulo={r.titulo}>
                <Texto negrito>📋 {r.titulo}</Texto>
                <Texto tamanho="pequeno">{dataPorExtenso(r.inicio)} · {horaDe(r.inicio)}</Texto>
              </Cartao>
            ))}
            {participo ? (
              <>
                <Botao tipo="secundario" icone="calendar-outline" titulo="Marcar reunião" aoTocar={() => router.push(`/eventos/novo?comissao=${cm.id}`)} />
                <Botao tipo="texto" titulo="Sair da comissão" aoTocar={() => confirmar('Sair da comissão?', cm.nome, async () => {
                  await supabase.from('comissoes_membros').delete().eq('comissao_id', cm.id).eq('perfil_id', uid);
                  recarregar();
                })} />
              </>
            ) : (
              <Botao icone="hand-right-outline" titulo="Quero participar" aoTocar={async () => {
                const { error } = await supabase.from('comissoes_membros').insert({ comissao_id: cm.id });
                if (error) avisar('Não foi possível', mensagemErro(error)); else recarregar();
              }} />
            )}
          </Cartao>
        );
      })}
      {eGestor && !nova ? <Botao tipo="secundario" icone="add" titulo="Criar comissão" aoTocar={() => setNova(true)} /> : null}
      {nova ? (
        <Cartao>
          <Campo rotulo="Nome" valor={nome} aoMudar={setNome} placeholder="Ex.: Comissão de obras" />
          <Campo rotulo="Objetivo" valor={descricao} aoMudar={setDescricao} multilinha />
          <Botao titulo="Criar" aoTocar={criar} />
          <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setNova(false)} />
        </Cartao>
      ) : null}
      {eGestor && dados.comissoes.length === 0 && !nova ? (
        <Botao tipo="texto" titulo="Criar as 4 do plano (obras, segurança, eventos, finanças)" aoTocar={async () => {
          const { error } = await supabase.from('comissoes').insert(['Obras', 'Segurança', 'Eventos', 'Finanças'].map((n) => ({ condominio_id: condominioId, nome: `Comissão de ${n.toLowerCase()}` })));
          if (error) avisar('Erro', mensagemErro(error)); else recarregar();
        }} />
      ) : null}
    </Tela>
  );
}
