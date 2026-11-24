import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';

import { avisar, BotaoOuvir, Carregando, Cartao, Progresso, Selo, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataCurta } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, espaco, useTema } from '@/lib/tema';
import { Enquete } from '@/lib/tipos';

type Resultado = { opcao_id: string; texto: string; votos: number; minha: boolean };

export default function VerEnquete() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTema();
  const { membro } = useSessao();
  const confirmar = useConfirmar();

  const { dados, recarregar } = useConsulta(async () => {
    const [e, r] = await Promise.all([
      supabase.from('enquetes').select('*').eq('id', id).single<Enquete>(),
      supabase.rpc('resultado_enquete', { p_enquete: id }),
    ]);
    return { data: e.data ? { enquete: e.data, resultado: (r.data ?? []) as Resultado[] } : null, error: e.error ?? r.error };
  }, [id]);

  if (!dados) return <Carregando />;
  const { enquete, resultado } = dados;
  const aberta = !enquete.encerra_em || enquete.encerra_em > new Date().toISOString();
  const total = resultado.reduce((s, r) => s + Number(r.votos), 0);
  const jaVotei = resultado.some((r) => r.minha);

  function votar(r: Resultado) {
    if (!membro?.unidade_id) return avisar('Sem unidade', 'Só moradores com unidade cadastrada podem votar.');
    confirmar('Confirmar voto?', `Você escolheu: “${r.texto}”`, async () => {
      const { error } = await supabase.rpc('votar', { p_enquete: id, p_opcao: r.opcao_id });
      if (error) return avisar('Voto não registrado', mensagemErro(error));
      avisar('Voto registrado!', 'Obrigado por participar.');
      recarregar();
    }, 'Sim, votar');
  }

  return (
    <Tela>
      <Stack.Screen options={{ title: 'Enquete' }} />
      <Selo texto={aberta ? 'Votação aberta' : 'Encerrada'} tipo={aberta ? 'sucesso' : 'neutro'} />
      <Texto tamanho="titulo" negrito>{enquete.titulo}</Texto>
      {enquete.descricao ? <Texto>{enquete.descricao}</Texto> : null}
      {enquete.encerra_em ? <Texto suave>Votação até {dataCurta(enquete.encerra_em)}</Texto> : null}
      <BotaoOuvir texto={`${enquete.titulo}. ${enquete.descricao ?? ''}. As opções são: ${resultado.map((r) => r.texto).join('; ')}`} />

      <Texto negrito>{aberta ? (jaVotei ? 'Você já votou. Pode mudar o voto até o fim da votação.' : 'Toque na sua escolha:') : 'Resultado final:'}</Texto>
      <View style={{ gap: espaco.s }}>
        {resultado.map((r) => {
          const pct = total ? Math.round((Number(r.votos) / total) * 100) : 0;
          return (
            <Pressable
              key={r.opcao_id}
              disabled={!aberta}
              onPress={() => votar(r)}
              accessibilityRole="radio"
              accessibilityState={{ checked: r.minha, disabled: !aberta }}
              accessibilityLabel={`${r.texto}. ${r.votos} votos, ${pct} por cento${r.minha ? '. Seu voto' : ''}`}
              style={{ minHeight: ALVO_TOQUE, borderRadius: 14, borderWidth: r.minha ? 3 : 2, borderColor: r.minha ? c.primaria : c.borda, backgroundColor: c.superficie, padding: espaco.m, gap: espaco.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s }}>
                <Ionicons name={r.minha ? 'radio-button-on' : 'radio-button-off'} size={28} color={r.minha ? c.primaria : c.textoSuave} />
                <Texto negrito style={{ flex: 1 }}>{r.texto}</Texto>
                {jaVotei || !aberta ? <Texto negrito>{pct}%</Texto> : null}
              </View>
              {jaVotei || !aberta ? (
                <>
                  <Progresso valor={pct} />
                  <Texto tamanho="pequeno" suave>{r.votos} voto{Number(r.votos) === 1 ? '' : 's'}{r.minha ? ' · seu voto' : ''}</Texto>
                </>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Cartao>
        <Texto tamanho="pequeno" suave>
          {total} unidade{total === 1 ? '' : 's'} votaram. Enquetes são consultas: decisões que dependem de assembleia continuam sendo tomadas em assembleia.
        </Texto>
      </Cartao>
    </Tela>
  );
}
