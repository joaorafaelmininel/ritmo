import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share } from 'react-native';

import { Contador } from '@/components/contador';
import { avisar, BotaoOuvir, Botao, Campo, Carregando, Cartao, Linha, Marcar, Selo, Subtitulo, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataPorExtenso, horaDe } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { Evento, TIPOS_EVENTO } from '@/lib/tipos';

type Tarefa = { id: string; descricao: string; responsavel_id: string | null; perfis: { nome: string } | null };

export default function VerEvento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { membro, sessao, eGestor } = useSessao();
  const uid = sessao!.user.id;
  const confirmar = useConfirmar();
  const [editando, setEditando] = useState(false);
  const [adultos, setAdultos] = useState(2);
  const [criancas, setCriancas] = useState(0);
  const [rateio, setRateio] = useState(true);
  const [prato, setPrato] = useState('');
  const [novaTarefa, setNovaTarefa] = useState('');

  const { dados, recarregar } = useConsulta(async () => {
    const [e, t] = await Promise.all([
      supabase.from('eventos').select('*, organizador:perfis!eventos_organizador_id_fkey(nome), eventos_presencas(unidade_id, adultos, criancas, rateio, prato, perfis(nome))').eq('id', id).single<Evento>(),
      supabase.from('eventos_tarefas').select('id, descricao, responsavel_id, perfis(nome)').eq('evento_id', id).order('criado_em').returns<Tarefa[]>(),
    ]);
    return { data: e.data ? { ev: e.data, tarefas: t.data ?? [] } : null, error: e.error };
  }, [id]);

  if (!dados) return <Carregando />;
  const { ev, tarefas } = dados;
  const presencas = ev.eventos_presencas ?? [];
  const minha = presencas.find((p) => p.unidade_id === membro?.unidade_id);
  const organizo = ev.organizador_id === uid || eGestor;
  const totA = presencas.reduce((s, p) => s + p.adultos, 0);
  const totC = presencas.reduce((s, p) => s + p.criancas, 0);
  const noRateio = presencas.filter((p) => p.rateio).length;

  async function confirmarPresenca() {
    if (!membro?.unidade_id) return avisar('Sem unidade', 'Seu cadastro não está ligado a uma unidade.');
    const { error } = await supabase.from('eventos_presencas').upsert({
      evento_id: id, unidade_id: membro.unidade_id, adultos, criancas, rateio, prato: prato.trim() || null,
    }, { onConflict: 'evento_id,unidade_id' });
    if (error) return avisar('Não foi possível confirmar', mensagemErro(error));
    setEditando(false);
    recarregar();
  }

  async function tarefa(t: Tarefa, assumir: boolean) {
    const { error } = await supabase.from('eventos_tarefas').update({ responsavel_id: assumir ? uid : null }).eq('id', t.id);
    if (error) return avisar('Não foi possível', mensagemErro(error));
    recarregar();
  }

  function compartilhar() {
    const texto = `${TIPOS_EVENTO[ev.tipo].emoji} *${ev.titulo}*\n📅 ${dataPorExtenso(ev.inicio)}, ${horaDe(ev.inicio)}${ev.local ? `\n📍 ${ev.local}` : ''}${ev.contribuicao ? `\n💰 ${ev.contribuicao}` : ''}\n\n${presencas.length} casas já confirmaram. Confirme a sua pelo app Vizinhar → Comunidade → Eventos.`;
    Share.share({ message: texto });
  }

  return (
    <Tela>
      <Stack.Screen options={{ title: TIPOS_EVENTO[ev.tipo].nome }} />
      {ev.cancelado ? <Selo texto="EVENTO CANCELADO" tipo="perigo" /> : null}
      <Texto tamanho="titulo" negrito>{TIPOS_EVENTO[ev.tipo].emoji} {ev.titulo}</Texto>
      <Texto tamanho="subtitulo">{dataPorExtenso(ev.inicio)} · {horaDe(ev.inicio)}</Texto>
      {ev.local ? <Texto>📍 {ev.local}</Texto> : null}
      {ev.descricao ? <Cartao><Texto>{ev.descricao}</Texto></Cartao> : null}
      {ev.contribuicao ? <Cartao destaque="alerta"><Texto negrito>Contribuição</Texto><Texto>{ev.contribuicao}</Texto></Cartao> : null}
      <Texto tamanho="pequeno" suave>Organização: {ev.organizador?.nome ?? 'gestão'}</Texto>
      <BotaoOuvir texto={`${ev.titulo}. ${dataPorExtenso(ev.inicio)}, às ${horaDe(ev.inicio)}. ${ev.local ? `Local: ${ev.local}.` : ''} ${ev.descricao ?? ''}`} />

      <Cartao destaque="primaria">
        <Texto tamanho="subtitulo" negrito>{presencas.length} casa{presencas.length === 1 ? '' : 's'} confirmada{presencas.length === 1 ? '' : 's'}</Texto>
        <Texto>{totA} adulto{totA === 1 ? '' : 's'} · {totC} criança{totC === 1 ? '' : 's'}{ev.contribuicao ? ` · ${noRateio} no rateio` : ''}</Texto>
      </Cartao>

      {!ev.cancelado && (editando || !minha) ? (
        <Cartao>
          <Texto tamanho="subtitulo" negrito>{minha ? 'Alterar minha confirmação' : 'Vou! Quantos da minha casa?'}</Texto>
          <Contador rotulo="Adultos" valor={adultos} aoMudar={setAdultos} />
          <Contador rotulo="Crianças" valor={criancas} aoMudar={setCriancas} />
          {ev.contribuicao ? <Marcar rotulo="Participo do rateio" valor={rateio} aoMudar={setRateio} /> : null}
          {ev.pede_prato ? <Campo rotulo="O que vou levar" valor={prato} aoMudar={setPrato} placeholder="Ex.: bolo de milho" /> : null}
          <Botao icone="checkmark-circle-outline" titulo={minha ? 'Salvar' : 'Confirmar presença'} aoTocar={confirmarPresenca} />
          {editando ? <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setEditando(false)} /> : null}
        </Cartao>
      ) : null}
      {minha && !editando ? (
        <Cartao destaque="sucesso">
          <Texto negrito>✓ Sua casa vai: {minha.adultos} adulto{minha.adultos === 1 ? '' : 's'} e {minha.criancas} criança{minha.criancas === 1 ? '' : 's'}</Texto>
          {minha.prato ? <Texto>Vai levar: {minha.prato}</Texto> : null}
          <Linha>
            <Botao tipo="secundario" titulo="Alterar" aoTocar={() => { setAdultos(minha.adultos); setCriancas(minha.criancas); setRateio(minha.rateio); setPrato(minha.prato ?? ''); setEditando(true); }} style={{ flexGrow: 1 }} />
            <Botao tipo="perigo" titulo="Não vou mais" aoTocar={() => confirmar('Retirar confirmação?', '', async () => {
              await supabase.from('eventos_presencas').delete().eq('evento_id', id).eq('unidade_id', membro!.unidade_id!);
              recarregar();
            })} style={{ flexGrow: 1 }} />
          </Linha>
        </Cartao>
      ) : null}

      {tarefas.length || organizo ? <Subtitulo>Quem ajuda com o quê</Subtitulo> : null}
      {tarefas.map((t) => (
        <Cartao key={t.id} destaque={t.responsavel_id ? undefined : 'alerta'}>
          <Linha style={{ justifyContent: 'space-between' }}>
            <Texto negrito style={{ flex: 1 }}>{t.descricao}</Texto>
            <Selo texto={t.responsavel_id ? `✓ ${t.perfis?.nome ?? 'alguém'}` : 'Precisa de alguém'} tipo={t.responsavel_id ? 'sucesso' : 'alerta'} />
          </Linha>
          {!t.responsavel_id ? <Botao tipo="secundario" icone="hand-right-outline" titulo="Eu cuido disso" aoTocar={() => tarefa(t, true)} /> : null}
          {t.responsavel_id === uid ? <Botao tipo="texto" titulo="Não vou conseguir" aoTocar={() => tarefa(t, false)} /> : null}
        </Cartao>
      ))}
      {organizo ? (
        <Linha>
          <Campo rotulo="Nova tarefa" valor={novaTarefa} aoMudar={setNovaTarefa} placeholder="Ex.: Descartáveis" style={{ minWidth: 200 }} />
          <Botao tipo="secundario" titulo="Adicionar" desativado={novaTarefa.trim().length < 2} aoTocar={async () => {
            await supabase.from('eventos_tarefas').insert({ evento_id: id, descricao: novaTarefa.trim() });
            setNovaTarefa(''); recarregar();
          }} />
        </Linha>
      ) : null}

      {presencas.length ? <Subtitulo>Quem vai</Subtitulo> : null}
      {presencas.map((p, i) => (
        <Texto key={i}>• {p.perfis?.nome || 'Vizinho(a)'} — {p.adultos + p.criancas} pessoa{p.adultos + p.criancas === 1 ? '' : 's'}{p.prato ? ` · leva ${p.prato}` : ''}</Texto>
      ))}

      <Botao tipo="secundario" icone="share-social-outline" titulo="Divulgar no WhatsApp" aoTocar={compartilhar} />
      {organizo && !ev.cancelado ? (
        <Botao tipo="texto" titulo="Cancelar evento" aoTocar={() => confirmar('Cancelar evento?', 'Quem confirmou verá que foi cancelado.', async () => {
          await supabase.from('eventos').update({ cancelado: true }).eq('id', id);
          router.back();
        }, 'Sim, cancelar')} />
      ) : null}
    </Tela>
  );
}
