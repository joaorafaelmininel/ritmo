import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { avisar, Botao, Campo, Carregando, Cartao, Linha, Opcoes, Subtitulo, Tela, Texto } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { quando } from '@/lib/formato';
import { notificar } from '@/lib/notificacoes';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, espaco, useTema } from '@/lib/tema';
import { Incidente, ORIGENS_INCIDENTE, SERVICOS } from '@/lib/tipos';

const duracao = (de: string, ate: string | null) => {
  const min = Math.round(((ate ? new Date(ate) : new Date()).getTime() - new Date(de).getTime()) / 60000);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
};

// "Acabou a luz? É só aqui?" — um toque responde, sem 30 mensagens no grupo.
export default function Servicos() {
  const { c } = useTema();
  const { condominioId, ePortaria, sessao } = useSessao();
  const uid = sessao!.user.id;
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [protocolo, setProtocolo] = useState('');
  const [previsao, setPrevisao] = useState('');
  const [origem, setOrigem] = useState<Incidente['origem']>('desconhecida');

  const { dados, recarregar } = useConsulta(
    () => supabase.from('incidentes').select('*, incidentes_relatos(perfil_id, detalhe)').eq('condominio_id', condominioId)
      .gte('inicio', new Date(Date.now() - 30 * 86400000).toISOString()).order('inicio', { ascending: false }).returns<Incidente[]>(),
    [condominioId],
  );

  async function relatar(servico: string, detalhe: string) {
    const { data, error } = await supabase.rpc('relatar_falta', { p_condominio: condominioId, p_servico: servico, p_detalhe: detalhe });
    if (error) return avisar('Não foi possível registrar', mensagemErro(error));
    const r = (data as { incidente_id: string; relatos: number; novo: boolean }[])[0];
    if (r.novo) notificar('falta', r.incidente_id);
    setEscolhido(null);
    avisar(
      r.novo ? 'Você foi o primeiro a avisar' : 'Não é só na sua casa',
      r.novo ? 'A portaria e a gestão foram avisadas. Se mais vizinhos tiverem o mesmo problema, aparece aqui.' : `${r.relatos} casas relataram o mesmo problema. A portaria já está sabendo.`,
    );
    recarregar();
  }

  async function atualizar(i: Incidente, resolvido: boolean) {
    const { error } = await supabase.from('incidentes').update({
      protocolo: protocolo.trim() || null, previsao: previsao.trim() || null, origem, status: resolvido ? 'resolvido' : 'aberto',
    }).eq('id', i.id);
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    setEditando(null);
    recarregar();
  }

  if (!dados) return <Carregando />;
  const abertos = dados.filter((i) => i.status === 'aberto');
  const resolvidos = dados.filter((i) => i.status === 'resolvido');

  return (
    <Tela aoAtualizar={recarregar}>
      <Stack.Screen options={{ title: 'Está faltando…?' }} />

      {abertos.length ? <Subtitulo>Acontecendo agora</Subtitulo> : (
        <Cartao destaque="sucesso"><Texto tamanho="subtitulo" negrito>✅ Nenhuma falta relatada agora</Texto></Cartao>
      )}
      {abertos.map((i) => {
        const s = SERVICOS[i.servico];
        const jaRelatei = i.incidentes_relatos?.some((r) => r.perfil_id === uid);
        const detalhes = [...new Set((i.incidentes_relatos ?? []).map((r) => r.detalhe).filter(Boolean))];
        return (
          <Cartao key={i.id} destaque="alerta">
            <Texto tamanho="subtitulo" negrito>{s?.emoji} {s?.nome ?? i.servico}</Texto>
            <Texto negrito>{i.incidentes_relatos?.length ?? 0} casa{(i.incidentes_relatos?.length ?? 0) === 1 ? '' : 's'} relataram · há {duracao(i.inicio, null)}</Texto>
            {detalhes.length ? <Texto suave>{detalhes.join(' · ')}</Texto> : null}
            <Texto>Causa: {ORIGENS_INCIDENTE[i.origem]}</Texto>
            {i.protocolo ? <Texto>Protocolo: <Texto negrito>{i.protocolo}</Texto></Texto> : null}
            {i.previsao ? <Texto negrito>Previsão: {i.previsao}</Texto> : null}
            {!jaRelatei ? <Botao tipo="secundario" titulo="Aqui também" aoTocar={() => relatar(i.servico, s?.detalhes[0] ?? '')} /> : <Texto tamanho="pequeno" suave>Você já avisou.</Texto>}
            {ePortaria && editando !== i.id ? (
              <Botao tipo="secundario" titulo="Atualizar (portaria)" aoTocar={() => { setEditando(i.id); setProtocolo(i.protocolo ?? ''); setPrevisao(i.previsao ?? ''); setOrigem(i.origem); }} />
            ) : null}
            {editando === i.id ? (
              <View style={{ gap: espaco.s }}>
                <Opcoes rotulo="Causa" valor={origem} aoMudar={setOrigem} opcoes={Object.entries(ORIGENS_INCIDENTE).map(([v, n]) => ({ valor: v as Incidente['origem'], nome: n }))} />
                <Campo rotulo="Protocolo" ajuda="Ex.: número do chamado na CPFL" valor={protocolo} aoMudar={setProtocolo} />
                <Campo rotulo="Previsão" valor={previsao} aoMudar={setPrevisao} placeholder="Ex.: até 4 horas" />
                <Botao titulo="Salvar" aoTocar={() => atualizar(i, false)} />
                <Botao tipo="secundario" icone="checkmark" titulo="Já voltou ao normal" aoTocar={() => atualizar(i, true)} />
                <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setEditando(null)} />
              </View>
            ) : null}
          </Cartao>
        );
      })}

      <Subtitulo>Avisar uma falta</Subtitulo>
      <Texto suave>Toque no que está faltando. Se outros vizinhos já avisaram, você vê na hora.</Texto>
      <View style={{ gap: espaco.s }}>
        {Object.entries(SERVICOS).map(([k, s]) => (
          <View key={k} style={{ gap: espaco.xs }}>
            <Pressable onPress={() => setEscolhido(escolhido === k ? null : k)} accessibilityRole="button" accessibilityLabel={`Falta de ${s.nome}`}
              style={({ pressed }) => ({ minHeight: ALVO_TOQUE + 10, borderRadius: 14, borderWidth: 2, borderColor: escolhido === k ? c.primaria : c.borda, backgroundColor: c.superficie, flexDirection: 'row', alignItems: 'center', paddingHorizontal: espaco.m, gap: espaco.m, opacity: pressed ? 0.8 : 1 })}>
              <Texto tamanho="titulo">{s.emoji}</Texto>
              <Texto tamanho="subtitulo" negrito style={{ flex: 1 }}>{s.nome}</Texto>
            </Pressable>
            {escolhido === k ? (
              <Linha>
                {s.detalhes.map((d) => <Botao key={d} tipo="secundario" titulo={d} aoTocar={() => relatar(k, d)} style={{ flexGrow: 1 }} />)}
              </Linha>
            ) : null}
          </View>
        ))}
      </View>

      {resolvidos.length ? <Subtitulo>Últimos 30 dias</Subtitulo> : null}
      {resolvidos.map((i) => (
        <Texto key={i.id} tamanho="pequeno">
          {SERVICOS[i.servico]?.emoji} {SERVICOS[i.servico]?.nome} · {quando(i.inicio)} · durou {duracao(i.inicio, i.fim)} · {ORIGENS_INCIDENTE[i.origem].split(' (')[0].toLowerCase()}
        </Texto>
      ))}
      <Texto tamanho="pequeno" suave style={{ marginTop: espaco.s }}>
        Também avise a concessionária (CPFL, operadora de internet) pelos canais deles: quanto mais protocolos, mais rápido costumam agir.
      </Texto>
    </Tela>
  );
}
