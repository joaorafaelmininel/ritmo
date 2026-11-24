import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { avisar, BotaoOuvir, Botao, Campo, Carregando, Cartao, Linha, Opcoes, Progresso, Selo, Subtitulo, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataCurta, moeda, quando } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { DIMENSOES, Projeto, STATUS_PROJETO } from '@/lib/tipos';

type Atualizacao = { id: string; texto: string; criado_em: string; perfis: { nome: string } | null };

export default function VerProjeto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { eGestor } = useSessao();
  const confirmar = useConfirmar();
  const [texto, setTexto] = useState('');

  const { dados, recarregar } = useConsulta(async () => {
    const [p, a] = await Promise.all([
      supabase.from('projetos').select('*').eq('id', id).single<Projeto>(),
      supabase.from('projetos_atualizacoes').select('id, texto, criado_em, perfis(nome)').eq('projeto_id', id).order('criado_em', { ascending: false }).returns<Atualizacao[]>(),
    ]);
    return { data: p.data ? { projeto: p.data, historico: a.data ?? [] } : null, error: p.error };
  }, [id]);

  if (!dados) return <Carregando />;
  const { projeto: p, historico } = dados;
  const info = DIMENSOES[p.dimensao];

  async function atualizar(campos: Partial<Projeto>, nota?: string) {
    const { error } = await supabase.from('projetos').update(campos).eq('id', id);
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    if (nota) await supabase.from('projetos_atualizacoes').insert({ projeto_id: id, texto: nota });
    recarregar();
  }

  async function registrar() {
    if (!texto.trim()) return;
    const { error } = await supabase.from('projetos_atualizacoes').insert({ projeto_id: id, texto: texto.trim() });
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    setTexto('');
    recarregar();
  }

  return (
    <Tela>
      <Stack.Screen options={{ title: info.nome }} />
      <Linha>
        <Selo texto={STATUS_PROJETO[p.status]} tipo="primaria" />
        <Selo texto={p.tipo === 'processo' ? 'Rotina (processo)' : 'Projeto'} />
      </Linha>
      <Texto tamanho="titulo" negrito>{p.titulo}</Texto>
      {p.descricao ? <Texto>{p.descricao}</Texto> : null}
      <BotaoOuvir texto={`${p.titulo}. ${p.descricao ?? ''}. Situação: ${STATUS_PROJETO[p.status]}.`} />
      <Cartao>
        {p.tipo === 'projeto' ? (
          <>
            <Texto negrito>{p.progresso}% concluído</Texto>
            <Progresso valor={p.progresso} cor={info.cor} />
          </>
        ) : null}
        {p.responsavel ? <Texto>Responsável: {p.responsavel}</Texto> : null}
        {p.prazo ? <Texto>Prazo: {dataCurta(p.prazo)}</Texto> : null}
        {p.orcamento ? <Texto>Orçamento previsto: {moeda(p.orcamento)}</Texto> : null}
      </Cartao>

      {eGestor ? (
        <>
          <Subtitulo>Atualizar (gestão)</Subtitulo>
          <Opcoes
            rotulo="Situação"
            valor={p.status}
            aoMudar={(s) => atualizar({ status: s }, `Situação alterada para: ${STATUS_PROJETO[s]}`)}
            opcoes={Object.entries(STATUS_PROJETO).map(([valor, nome]) => ({ valor: valor as Projeto['status'], nome }))}
          />
          {p.tipo === 'projeto' ? (
            <Opcoes
              rotulo="Andamento"
              valor={String(p.progresso)}
              aoMudar={(v) => atualizar({ progresso: Number(v), status: Number(v) === 100 ? 'concluido' : p.status === 'planejado' && Number(v) > 0 ? 'em_andamento' : p.status })}
              opcoes={['0', '10', '25', '50', '75', '90', '100'].map((v) => ({ valor: v, nome: `${v}%` }))}
            />
          ) : null}
          <Opcoes rotulo="Quem vê" valor={p.publico ? 's' : 'n'} aoMudar={(v) => atualizar({ publico: v === 's' })} opcoes={[{ valor: 's', nome: 'Todos os moradores' }, { valor: 'n', nome: 'Só gestão e conselho' }]} />
          <Campo rotulo="Registrar novidade" ajuda="Aparece no histórico para os moradores." valor={texto} aoMudar={setTexto} multilinha />
          <Botao icone="create-outline" titulo="Registrar" aoTocar={registrar} />
        </>
      ) : null}

      <Subtitulo>Histórico</Subtitulo>
      {historico.length === 0 ? <Texto suave>Sem atualizações ainda.</Texto> : null}
      {historico.map((h) => (
        <Cartao key={h.id}>
          <Texto tamanho="pequeno" suave>{quando(h.criado_em)}{h.perfis?.nome ? ` · ${h.perfis.nome}` : ''}</Texto>
          <Texto>{h.texto}</Texto>
        </Cartao>
      ))}

      {eGestor ? (
        <Botao tipo="perigo" icone="trash-outline" titulo="Apagar do plano" aoTocar={() => confirmar('Apagar?', p.titulo, async () => {
          await supabase.from('projetos').delete().eq('id', id);
          router.back();
        }, 'Sim, apagar')} />
      ) : null}
    </Tela>
  );
}
