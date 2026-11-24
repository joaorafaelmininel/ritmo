import { router, Stack } from 'expo-router';

import { avisar, Botao, Carregando, Cartao, Linha, Progresso, Selo, Tela, Texto } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { useTema } from '@/lib/tema';
import { DIMENSOES, Projeto, STATUS_PROJETO } from '@/lib/tipos';

type Voto = { projeto_id: string; votos: number; minha: boolean };

// Cada unidade escolhe até 3 projetos que quer ver feitos primeiro.
export default function Prioridades() {
  const { c } = useTema();
  const { condominioId, membro } = useSessao();

  const { dados, recarregar } = useConsulta(async () => {
    const [p, r] = await Promise.all([
      supabase.from('projetos').select('*').eq('condominio_id', condominioId).eq('tipo', 'projeto').in('status', ['planejado', 'em_andamento', 'pausado']).returns<Projeto[]>(),
      supabase.rpc('ranking_prioridades', { p_condominio: condominioId }),
    ]);
    return { data: { projetos: p.data ?? [], votos: (r.data ?? []) as Voto[] }, error: p.error ?? r.error };
  }, [condominioId]);

  async function alternar(p: Projeto, minha: boolean) {
    if (!membro?.unidade_id) return avisar('Sem unidade', 'Só moradores com unidade podem escolher prioridades.');
    const { error } = minha
      ? await supabase.from('projetos_prioridades').delete().eq('projeto_id', p.id).eq('unidade_id', membro.unidade_id)
      : await supabase.from('projetos_prioridades').insert({ projeto_id: p.id, unidade_id: membro.unidade_id });
    if (error) return avisar('Não foi possível', mensagemErro(error));
    recarregar();
  }

  if (!dados) return <Carregando />;
  const votoDe = (id: string) => dados.votos.find((v) => v.projeto_id === id) ?? { votos: 0, minha: false };
  const lista = [...dados.projetos].sort((a, b) => Number(votoDe(b.id).votos) - Number(votoDe(a.id).votos));
  const maximo = Math.max(1, ...lista.map((p) => Number(votoDe(p.id).votos)));
  const minhas = dados.votos.filter((v) => v.minha).length;

  return (
    <Tela aoAtualizar={recarregar}>
      <Stack.Screen options={{ title: 'O que fazer primeiro?' }} />
      <Texto>Escolha até <Texto negrito>3 projetos</Texto> que sua unidade quer ver feitos primeiro. A gestão usa este ranking para planejar.</Texto>
      <Cartao destaque="primaria"><Texto negrito>Sua unidade escolheu {minhas} de 3.</Texto></Cartao>
      {lista.length === 0 ? <Texto suave>Nenhum projeto em aberto no plano de gestão.</Texto> : null}
      {lista.map((p, i) => {
        const v = votoDe(p.id);
        return (
          <Cartao key={p.id} destaque={v.minha ? 'sucesso' : undefined}>
            <Linha>
              <Texto tamanho="titulo" negrito cor={c.primaria}>{i + 1}º</Texto>
              <Selo texto={DIMENSOES[p.dimensao].nome} />
              <Selo texto={STATUS_PROJETO[p.status]} tipo="primaria" />
            </Linha>
            <Texto tamanho="subtitulo" negrito>{p.titulo}</Texto>
            {p.descricao ? <Texto suave linhas={3}>{p.descricao}</Texto> : null}
            <Progresso valor={(Number(v.votos) / maximo) * 100} />
            <Texto tamanho="pequeno" suave>{v.votos} unidade{Number(v.votos) === 1 ? '' : 's'} escolheram</Texto>
            <Botao
              tipo={v.minha ? 'primario' : 'secundario'}
              icone={v.minha ? 'star' : 'star-outline'}
              titulo={v.minha ? 'Prioridade da minha unidade · retirar' : 'Quero esse primeiro'}
              desativado={!v.minha && minhas >= 3}
              aoTocar={() => alternar(p, v.minha)}
            />
            <Botao tipo="texto" titulo="Ver detalhes" aoTocar={() => router.push(`/plano/${p.id}`)} />
          </Cartao>
        );
      })}
    </Tela>
  );
}
