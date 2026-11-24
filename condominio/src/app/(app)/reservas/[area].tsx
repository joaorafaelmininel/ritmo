import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { avisar, BotaoOuvir, Carregando, Cartao, Campo, Opcoes, Subtitulo, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataLocal, dataPorExtenso, isoData, moeda } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, espaco, useTema } from '@/lib/tema';
import { Area, PERIODOS } from '@/lib/tipos';

const DIAS = 60;

// Lista de dias em vez de calendário: botões grandes, "Livre" ou "Ocupado" escrito por extenso.
export default function ReservarArea() {
  const { area: areaId } = useLocalSearchParams<{ area: string }>();
  const { c, f } = useTema();
  const { condominioId, membro } = useSessao();
  const confirmar = useConfirmar();
  const [periodo, setPeriodo] = useState('dia');
  const [observacao, setObservacao] = useState('');

  const { dados, recarregar } = useConsulta(async () => {
    const hoje = new Date();
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + DIAS);
    const [a, o] = await Promise.all([
      supabase.from('areas_comuns').select('*').eq('id', areaId).single<Area>(),
      supabase.rpc('datas_ocupadas', { p_area: areaId, p_de: isoData(hoje), p_ate: isoData(fim) }),
    ]);
    return { data: a.data ? { area: a.data, ocupadas: (o.data ?? []) as { data: string; periodo: string }[] } : null, error: a.error ?? o.error };
  }, [areaId]);

  if (!dados) return <Carregando />;
  const { area, ocupadas } = dados;

  const ocupado = (dia: string) =>
    ocupadas.some((o) => o.data === dia && (o.periodo === periodo || o.periodo === 'dia' || periodo === 'dia'));

  const hoje = new Date();
  const dias = Array.from({ length: DIAS }, (_, i) => isoData(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i)));

  function reservar(dia: string) {
    if (!membro?.unidade_id) return avisar('Sem unidade', 'Seu cadastro não está ligado a uma unidade. Fale com a síndica.');
    confirmar(
      'Confirmar reserva?',
      `${area.nome}\n${dataPorExtenso(dia)} — ${PERIODOS[periodo]}${Number(area.taxa) > 0 ? `\nTaxa: ${moeda(area.taxa)}` : ''}`,
      async () => {
        const { error } = await supabase.from('reservas').insert({
          condominio_id: condominioId, area_id: area.id, unidade_id: membro.unidade_id, data: dia, periodo, observacao: observacao.trim() || null,
        });
        if (error) { recarregar(); return avisar('Não foi possível reservar', mensagemErro(error)); }
        avisar(
          area.exige_aprovacao ? 'Pedido de reserva enviado' : 'Reserva confirmada!',
          area.exige_aprovacao ? 'A gestão vai aprovar e você será avisado(a).' : 'O espaço está reservado para você.',
        );
        router.back();
      },
      'Sim, reservar',
    );
  }

  return (
    <Tela>
      <Stack.Screen options={{ title: area.nome }} />
      {area.regras || area.descricao ? (
        <Cartao>
          <Texto negrito>Regras de uso</Texto>
          <Texto>{area.regras ?? area.descricao}</Texto>
          <BotaoOuvir texto={`${area.nome}. ${area.regras ?? area.descricao}`} />
        </Cartao>
      ) : null}
      <Opcoes rotulo="Qual período?" valor={periodo} aoMudar={setPeriodo} opcoes={Object.entries(PERIODOS).map(([valor, nome]) => ({ valor, nome }))} />
      <Campo rotulo="Observação" ajuda="Opcional. Ex.: aniversário, 30 convidados" valor={observacao} aoMudar={setObservacao} />
      <Subtitulo>Toque no dia que você quer</Subtitulo>
      <View style={{ gap: espaco.s }}>
        {dias.map((dia) => {
          const livre = !ocupado(dia);
          const d = dataLocal(dia);
          const fimDeSemana = d.getDay() === 0 || d.getDay() === 6;
          return (
            <Pressable
              key={dia}
              disabled={!livre}
              onPress={() => reservar(dia)}
              accessibilityRole="button"
              accessibilityState={{ disabled: !livre }}
              accessibilityLabel={`${dataPorExtenso(dia)}, ${livre ? 'livre' : 'ocupado'}`}
              style={({ pressed }) => ({
                minHeight: ALVO_TOQUE, borderRadius: 12, borderWidth: 2, paddingHorizontal: espaco.m,
                borderColor: livre ? c.sucesso : c.borda, backgroundColor: livre ? (pressed ? c.sucessoSuave : c.superficie) : c.fundo,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              })}>
              <Texto negrito={fimDeSemana} cor={livre ? c.texto : c.textoSuave} style={{ flex: 1 }}>
                {dataPorExtenso(dia)}
              </Texto>
              <Texto negrito cor={livre ? c.sucesso : c.textoSuave} style={{ fontSize: f('pequeno') }}>{livre ? 'LIVRE' : 'Ocupado'}</Texto>
            </Pressable>
          );
        })}
      </View>
    </Tela>
  );
}
