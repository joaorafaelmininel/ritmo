import * as Linking from 'expo-linking';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, Carregando, Cartao, Linha, Opcoes, Selo, Tela, Texto, useConfirmar, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { Prestador } from '@/lib/tipos';

// origem=indicado → prestadores que os vizinhos recomendam; origem=morador → negócios dos próprios moradores
export default function Prestadores() {
  const { origem = 'indicado' } = useLocalSearchParams<{ origem?: 'indicado' | 'morador' }>();
  const { condominioId, sessao, eGestor } = useSessao();
  const uid = sessao!.user.id;
  const confirmar = useConfirmar();
  const [tipo, setTipo] = useState('todos');
  const [comentando, setComentando] = useState<string | null>(null);
  const [comentario, setComentario] = useState('');
  const [novidade, setNovidade] = useState<Record<string, string>>({});
  const morador = origem === 'morador';

  const { dados, recarregar } = useConsulta(
    () => supabase.from('prestadores').select('*, perfis(nome), prestadores_recomendacoes(perfil_id, comentario, perfis(nome))')
      .eq('condominio_id', condominioId).eq('origem', origem).eq('ativo', true).order('tipo').returns<Prestador[]>(),
    [condominioId, origem],
  );

  async function recomendar(p: Prestador) {
    const { error } = await supabase.from('prestadores_recomendacoes').insert({ prestador_id: p.id, comentario: comentario.trim() || null });
    if (error) return avisar('Não foi possível', mensagemErro(error));
    setComentando(null); setComentario('');
    recarregar();
  }

  async function retirar(p: Prestador) {
    await supabase.from('prestadores_recomendacoes').delete().eq('prestador_id', p.id).eq('perfil_id', uid);
    recarregar();
  }

  if (!dados) return <Carregando />;
  const hoje = new Date().toDateString();
  const deHoje = dados.filter((p) => p.novidade && p.novidade_em && new Date(p.novidade_em).toDateString() === hoje);
  const tipos = [...new Set(dados.map((p) => p.tipo))].sort();
  const lista = dados
    .filter((p) => tipo === 'todos' || p.tipo === tipo)
    .sort((a, b) => (b.prestadores_recomendacoes?.length ?? 0) - (a.prestadores_recomendacoes?.length ?? 0));

  return (
    <Tela aoAtualizar={recarregar}>
      <Stack.Screen options={{ title: morador ? 'Negócios de moradores' : 'Prestadores indicados' }} />
      <Texto suave>
        {morador
          ? 'Serviços e empresas dos próprios vizinhos. Valorize quem mora aqui!'
          : 'Profissionais que os vizinhos já contrataram e recomendam. Os mais recomendados aparecem primeiro.'}
      </Texto>
      <Botao icone="add-circle-outline" titulo={morador ? 'Divulgar meu negócio' : 'Indicar um prestador'} aoTocar={() => router.push(`/prestadores/novo?origem=${origem}`)} />
      {morador && deHoje.length ? (
        <Cartao destaque="primaria">
          <Texto tamanho="subtitulo" negrito>☀️ Hoje nos negócios dos vizinhos</Texto>
          {deHoje.map((p) => <Texto key={p.id}>• <Texto negrito>{p.nome}:</Texto> {p.novidade}</Texto>)}
        </Cartao>
      ) : null}
      {tipos.length > 1 ? <Opcoes valor={tipo} aoMudar={setTipo} opcoes={[{ valor: 'todos', nome: 'Todos' }, ...tipos.map((t) => ({ valor: t, nome: t }))]} /> : null}
      {lista.length === 0 ? <Vazio icone="people-outline" texto={morador ? 'Nenhum negócio divulgado ainda.' : 'Nenhuma indicação ainda. Seja o primeiro!'} /> : null}

      {lista.map((p) => {
        const recs = p.prestadores_recomendacoes ?? [];
        const recomendei = recs.some((r) => r.perfil_id === uid);
        const tel = p.telefone?.replace(/\D/g, '');
        const meu = p.autor_id === uid;
        return (
          <Cartao key={p.id}>
            <Linha>
              <Selo texto={p.tipo} tipo="primaria" />
              {recs.length ? <Selo texto={`👍 ${recs.length} recomenda${recs.length > 1 ? 'm' : ''}`} tipo="sucesso" /> : null}
            </Linha>
            <Texto tamanho="subtitulo" negrito>{p.nome}</Texto>
            {p.descricao ? <Texto>{p.descricao}</Texto> : null}
            <Texto tamanho="pequeno" suave>{morador ? `Morador(a): ${p.perfis?.nome ?? ''}` : `Indicado por ${p.perfis?.nome ?? 'um vizinho'}`}</Texto>
            {recs.filter((r) => r.comentario).slice(0, 3).map((r, i) => (
              <Texto key={i} tamanho="pequeno">💬 “{r.comentario}” — {r.perfis?.nome ?? 'vizinho'}</Texto>
            ))}
            {tel && tel.length >= 10 ? (
              <Linha>
                <Botao tipo="secundario" icone="call-outline" titulo="Ligar" aoTocar={() => { Linking.openURL(`tel:${tel}`); }} style={{ flexGrow: 1 }} />
                <Botao tipo="secundario" icone="logo-whatsapp" titulo="WhatsApp" aoTocar={() => { Linking.openURL(`https://wa.me/55${tel.replace(/^55/, '')}`); }} style={{ flexGrow: 1 }} />
              </Linha>
            ) : p.telefone ? <Texto>Contato: {p.telefone}</Texto> : null}

            {!meu ? (
              recomendei ? (
                <Botao tipo="texto" icone="thumbs-up" titulo="Você recomenda · retirar" aoTocar={() => retirar(p)} />
              ) : comentando === p.id ? (
                <>
                  <Campo rotulo="Quer deixar um comentário?" ajuda="Opcional. Ex.: pontual, preço justo" valor={comentario} aoMudar={setComentario} />
                  <Botao icone="thumbs-up-outline" titulo="Recomendar" aoTocar={() => recomendar(p)} />
                  <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setComentando(null)} />
                </>
              ) : (
                <Botao tipo="secundario" icone="thumbs-up-outline" titulo="Já contratei e recomendo" aoTocar={() => { setComentando(p.id); setComentario(''); }} />
              )
            ) : null}
            {meu && morador ? (
              <>
                <Campo rotulo="Hoje tem…" ajuda="Cardápio do dia, promoção, novidade. Aparece no topo para os vizinhos (só hoje)." valor={novidade[p.id] ?? ''} aoMudar={(t) => setNovidade((x) => ({ ...x, [p.id]: t }))} multilinha />
                <Botao tipo="secundario" icone="megaphone-outline" titulo="Divulgar hoje" desativado={!(novidade[p.id] ?? '').trim()} aoTocar={async () => {
                  const { error } = await supabase.from('prestadores').update({ novidade: novidade[p.id].trim(), novidade_em: new Date().toISOString() }).eq('id', p.id);
                  if (error) return avisar('Não foi possível', mensagemErro(error));
                  setNovidade((x) => ({ ...x, [p.id]: '' }));
                  recarregar();
                }} />
              </>
            ) : null}
            {meu || eGestor ? (
              <Botao tipo="texto" titulo="Remover" aoTocar={() => confirmar('Remover?', p.nome, async () => {
                await supabase.from('prestadores').update({ ativo: false }).eq('id', p.id);
                recarregar();
              })} />
            ) : null}
          </Cartao>
        );
      })}
      <Texto tamanho="pequeno" suave>As indicações são dos moradores. O condomínio não se responsabiliza pelos serviços contratados.</Texto>
    </Tela>
  );
}
