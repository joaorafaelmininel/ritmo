import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { RespostaPortaria } from '@/components/respostaPortaria';
import { avisar, Botao, Campo, Carregando, Cartao, Linha, Opcoes, Selo, Subtitulo, Tela, Texto, useConfirmar, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { codigoUnidade, formatoUnidade, dataPorExtenso, isoData, nomeUnidade, quando, unidadeCombina } from '@/lib/formato';
import { notificar } from '@/lib/notificacoes';
import { responderPortaria } from '@/lib/portaria';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { espaco, useTema } from '@/lib/tema';
import { RegistroPortaria, STATUS_PORTARIA, TIPOS_PORTARIA, Unidade } from '@/lib/tipos';

export default function Portaria() {
  const { ePortaria } = useSessao();
  return ePortaria ? <PainelPortaria /> : <MinhasVisitas />;
}

/** Visão do morador: o que avisou à portaria e quem chegou. */
function MinhasVisitas() {
  const { membro } = useSessao();
  const confirmar = useConfirmar();
  const { dados, recarregar } = useConsulta(
    () => supabase.from('portaria').select('*').eq('unidade_id', membro?.unidade_id ?? '00000000-0000-0000-0000-000000000000').gte('data', isoData(new Date(Date.now() - 7 * 86400000)))
      .order('data', { ascending: false }).order('criado_em', { ascending: false }).returns<RegistroPortaria[]>(),
    [membro?.unidade_id],
  );
  if (!dados) return <Carregando />;
  const pendentes = dados.filter((r) => r.status === 'na_portaria');
  const outros = dados.filter((r) => r.status !== 'na_portaria');
  return (
    <Tela aoAtualizar={recarregar}>
      <Stack.Screen options={{ title: 'Visitas e portaria' }} />
      {pendentes.map((r) => <RespostaPortaria key={r.id} r={r} aoResponder={recarregar} />)}
      <Botao icone="megaphone-outline" titulo="Avisar a portaria" aoTocar={() => router.push('/portaria/avisar')} />
      {outros.length === 0 ? <Vazio icone="people-outline" texto="Nenhum aviso à portaria nos últimos dias." /> : null}
      {outros.map((r) => (
        <Cartao key={r.id}>
          <Linha><Selo texto={STATUS_PORTARIA[r.status].nome} tipo={STATUS_PORTARIA[r.status].tipo} /><Selo texto={TIPOS_PORTARIA[r.tipo]} /></Linha>
          <Texto tamanho="subtitulo" negrito>{r.nome}</Texto>
          <Texto suave>{dataPorExtenso(r.data)}{r.observacao ? ` · ${r.observacao}` : ''}</Texto>
          {r.status === 'entrou' && r.respondido_em ? <Texto tamanho="pequeno" suave>Entrou {quando(r.respondido_em)}</Texto> : null}
          {r.status === 'esperado' ? (
            <Botao tipo="texto" titulo="Cancelar aviso" aoTocar={() => confirmar('Cancelar aviso?', `A portaria não vai mais esperar ${r.nome}.`, async () => {
              const erro = await responderPortaria(r.id, 'cancelado');
              if (erro) avisar('Erro', erro); else recarregar();
            })} />
          ) : null}
        </Cartao>
      ))}
    </Tela>
  );
}

/** Visão da portaria: quem é esperado hoje, quem está aguardando resposta e chegada sem aviso. */
function PainelPortaria() {
  const { c } = useTema();
  const { condominioId } = useSessao();
  const [busca, setBusca] = useState('');
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<RegistroPortaria['tipo']>('visita');

  const { dados, recarregar } = useConsulta(async () => {
    const [r, u] = await Promise.all([
      supabase.from('portaria').select('*, unidades(id, bloco, numero)').eq('condominio_id', condominioId).eq('data', isoData(new Date()))
        .order('criado_em', { ascending: false }).returns<RegistroPortaria[]>(),
      supabase.from('unidades').select('id, bloco, numero').eq('condominio_id', condominioId).order('bloco').order('numero').returns<Unidade[]>(),
    ]);
    return { data: { registros: r.data ?? [], unidades: u.data ?? [] }, error: r.error };
  }, [condominioId]);

  async function chegouSemAviso() {
    if (!unidade || nome.trim().length < 2) return avisar('Escolha a unidade e escreva o nome');
    const { data, error } = await supabase.from('portaria').insert({
      condominio_id: condominioId, unidade_id: unidade.id, origem: 'portaria', status: 'na_portaria', tipo, nome: nome.trim(),
    }).select('id').single();
    if (error) return avisar('Não foi possível registrar', mensagemErro(error));
    notificar('portaria', data.id);
    setUnidade(null); setNome(''); setBusca('');
    recarregar();
  }

  async function entrou(r: RegistroPortaria) {
    const { error } = await supabase.from('portaria').update({ status: 'entrou' }).eq('id', r.id);
    if (error) return avisar('Não foi possível', mensagemErro(error));
    notificar('portaria', r.id);
    recarregar();
  }

  if (!dados) return <Carregando />;
  const esperados = dados.registros.filter((r) => r.status === 'esperado' || r.status === 'autorizado');
  const aguardando = dados.registros.filter((r) => r.status === 'na_portaria');
  const finalizados = dados.registros.filter((r) => ['entrou', 'negado', 'cancelado'].includes(r.status));
  const filtradas = busca ? dados.unidades.filter((u) => unidadeCombina(u, busca)).slice(0, 12) : [];

  return (
    <Tela aoAtualizar={recarregar}>
      <Stack.Screen options={{ title: 'Painel da portaria' }} />

      <Cartao>
        <Texto tamanho="subtitulo" negrito>Chegou alguém sem aviso</Texto>
        {unidade ? (
          <>
            <Texto>Para: <Texto negrito>{nomeUnidade(unidade)}</Texto></Texto>
            <Opcoes valor={tipo} aoMudar={setTipo} opcoes={Object.entries(TIPOS_PORTARIA).map(([v, n]) => ({ valor: v as RegistroPortaria['tipo'], nome: n }))} />
            <Campo rotulo="Nome" valor={nome} aoMudar={setNome} autoCapitalize="words" />
            <Botao titulo="Perguntar ao morador pelo app" icone="notifications-outline" aoTocar={chegouSemAviso} />
            <Botao tipo="texto" titulo="Trocar unidade" aoTocar={() => setUnidade(null)} />
          </>
        ) : (
          <>
            <Campo rotulo="Número da unidade" valor={busca} aoMudar={setBusca} autoCapitalize="characters" placeholder={formatoUnidade() === 'quadra_lote' ? 'Ex.: Q8L1' : 'Ex.: 101'} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
              {filtradas.map((u) => (
                <Pressable key={u.id} onPress={() => setUnidade(u)} accessibilityRole="button"
                  style={{ minHeight: 52, minWidth: 90, paddingHorizontal: espaco.m, borderRadius: 12, borderWidth: 2, borderColor: c.primaria, alignItems: 'center', justifyContent: 'center' }}>
                  <Texto negrito cor={c.primaria}>{codigoUnidade(u)}</Texto>
                </Pressable>
              ))}
            </View>
          </>
        )}
        <Texto tamanho="pequeno" suave>Se o morador não responder, use o interfone.</Texto>
      </Cartao>

      <Subtitulo>Aguardando resposta do morador ({aguardando.length})</Subtitulo>
      {aguardando.map((r) => (
        <Cartao key={r.id} destaque="alerta">
          <Texto negrito>{r.nome} → {nomeUnidade(r.unidades)}</Texto>
          <Texto tamanho="pequeno" suave>{TIPOS_PORTARIA[r.tipo]} · {quando(r.criado_em)}</Texto>
        </Cartao>
      ))}

      <Subtitulo>Esperados hoje ({esperados.length})</Subtitulo>
      {esperados.length === 0 ? <Texto suave>Nenhum morador avisou visitas para hoje.</Texto> : null}
      {esperados.map((r) => (
        <Cartao key={r.id} destaque={r.status === 'autorizado' ? 'sucesso' : undefined}>
          <Linha><Selo texto={STATUS_PORTARIA[r.status].nome} tipo={STATUS_PORTARIA[r.status].tipo} /><Selo texto={TIPOS_PORTARIA[r.tipo]} /></Linha>
          <Texto tamanho="subtitulo" negrito>{r.nome}</Texto>
          <Texto>{nomeUnidade(r.unidades)}{r.observacao ? ` · “${r.observacao}”` : ''}</Texto>
          <Botao icone="enter-outline" titulo="Chegou — liberar entrada" aoTocar={() => entrou(r)} />
        </Cartao>
      ))}

      {finalizados.length ? <Subtitulo>Hoje, já resolvidos</Subtitulo> : null}
      {finalizados.map((r) => (
        <Texto key={r.id} tamanho="pequeno">
          {STATUS_PORTARIA[r.status].nome}: {r.nome} · {nomeUnidade(r.unidades)}{r.respondido_em ? ` · ${quando(r.respondido_em)}` : ''}
        </Texto>
      ))}
      <Botao tipo="secundario" icone="cube-outline" titulo="Registrar encomenda" aoTocar={() => router.push('/encomendas')} />
    </Tela>
  );
}
