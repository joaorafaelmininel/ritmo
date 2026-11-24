import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RespostaPortaria } from '@/components/respostaPortaria';
import { Botao, Cartao, Selo, Tela, Texto } from '@/components/ui';
import { quando, nomeUnidade, saudacao } from '@/lib/formato';
import { useResumo } from '@/lib/resumo';
import { useSessao } from '@/lib/sessao';
import { espaco, useTema } from '@/lib/tema';
import { Dimensao, DIMENSOES } from '@/lib/tipos';

const ORDEM: Dimensao[] = ['financeira', 'comunidade', 'operacional', 'desenvolvimento'];
const ROTAS: Record<Dimensao, string> = {
  financeira: '/financas', comunidade: '/dimensao/comunidade', operacional: '/dia-a-dia', desenvolvimento: '/dimensao/desenvolvimento',
};

/** Botão grande e colorido de uma dimensão, com explicação curta embaixo do nome. */
function BotaoDimensao({ d, contador }: { d: Dimensao; contador?: number }) {
  const { f } = useTema();
  const info = DIMENSOES[d];
  return (
    <Pressable
      onPress={() => router.push(ROTAS[d] as never)}
      accessibilityRole="button"
      accessibilityLabel={`${info.botao}: ${info.descricao}${contador ? `. ${contador} novidade${contador > 1 ? 's' : ''}` : ''}`}
      style={({ pressed }) => ({
        minHeight: 104, borderRadius: 20, paddingHorizontal: espaco.m, paddingVertical: espaco.m,
        backgroundColor: info.cor, flexDirection: 'row', alignItems: 'center', gap: espaco.m, opacity: pressed ? 0.85 : 1,
      })}>
      <View>
        <Ionicons name={info.icone.replace('-outline', '') as never} size={44} color="#fff" />
        {contador ? (
          <View style={{ position: 'absolute', top: -10, right: -12, minWidth: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
            <Text style={{ color: info.cor, fontWeight: '800', fontSize: 16 }}>{contador}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        {/* Título com limite próprio de ampliação para "Desenvolvimento" caber inteiro */}
        <Text maxFontSizeMultiplier={1.15} style={{ color: '#fff', fontSize: Math.min(f('subtitulo') + 2, 28), fontWeight: '800' }}>{info.botao}</Text>
        <Text maxFontSizeMultiplier={1.5} style={{ color: '#fff', fontSize: f('pequeno'), lineHeight: Math.round(f('pequeno') * 1.3) }}>
          {info.descricao}
        </Text>
      </View>
    </Pressable>
  );
}

export default function Inicio() {
  const { c } = useTema();
  const { nome, membro, eGestor } = useSessao();
  const { dados, recarregar, carregando } = useResumo();

  const contadores: Partial<Record<Dimensao, number>> = {
    financeira: dados?.cobranca ? 1 : 0,
    comunidade: dados?.naoLidos ?? 0,
    operacional: (dados?.encomendas ?? 0) + (dados?.portaria.length ?? 0) + (eGestor ? (dados?.ocorrenciasAbertas ?? 0) + (dados?.paraAprovar ?? 0) + (dados?.manutencoesVencidas ?? 0) : 0),
  };
  const avisos = (dados?.avisos ?? []).slice(0, 3);
  const primeiroNome = nome.split(' ')[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.fundo }} edges={['top']}>
      <Tela aoAtualizar={recarregar} atualizando={carregando && !!dados}>
        <View>
          <Texto tamanho="grande" negrito>{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ''}!</Texto>
          <Texto suave>
            {membro?.condominios.nome}
            {membro?.unidades ? ` · ${nomeUnidade(membro.unidades)}` : ''}
          </Texto>
        </View>

        {/* Urgente: alguém na portaria esperando autorização */}
        {dados?.portaria.map((r) => <RespostaPortaria key={r.id} r={r} aoResponder={recarregar} />)}

        {/* As quatro dimensões do plano de gestão */}
        <View style={{ gap: espaco.s }}>
          {ORDEM.map((d) => <BotaoDimensao key={d} d={d} contador={contadores[d]} />)}
        </View>

        {/* Avisos */}
        <Cartao>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s }}>
            <Ionicons name="megaphone" size={28} color={c.primaria} />
            <Texto tamanho="subtitulo" negrito style={{ flex: 1 }}>Avisos</Texto>
            {dados?.naoLidos ? <Selo texto={`${dados.naoLidos} novo${dados.naoLidos > 1 ? 's' : ''}`} tipo="perigo" /> : null}
          </View>
          {dados && avisos.length === 0 ? <Texto suave>Nenhum aviso nos últimos 30 dias.</Texto> : null}
          {avisos.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => router.push(`/aviso/${a.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${a.lido ? '' : 'Não lido. '}${a.importante ? 'Importante. ' : ''}${a.titulo}`}
              style={({ pressed }) => ({
                minHeight: 56, paddingVertical: espaco.s, borderTopWidth: 1, borderColor: c.borda,
                flexDirection: 'row', alignItems: 'center', gap: espaco.s, opacity: pressed ? 0.7 : 1,
              })}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: a.lido ? 'transparent' : c.perigo }} />
              <View style={{ flex: 1 }}>
                <Texto negrito={!a.lido} cor={a.importante && !a.lido ? c.alerta : undefined}>
                  {a.importante ? '⚠️ ' : ''}{a.titulo}
                </Texto>
                <Texto tamanho="pequeno" suave>{quando(a.publicado_em)}</Texto>
              </View>
              <Ionicons name="chevron-forward" size={24} color={c.textoSuave} />
            </Pressable>
          ))}
          <Botao tipo="texto" titulo="Ver todos os avisos" aoTocar={() => router.push('/avisos')} />
        </Cartao>

        {/* Ocorrência: o atalho mais usado, sempre à mão */}
        <Botao icone="alert-circle-outline" titulo="Registrar ocorrência" dica="Conserto, limpeza, segurança ou barulho" aoTocar={() => router.push('/chamados/novo')} style={{ minHeight: 72 }} />

        {eGestor ? <Botao tipo="secundario" icone="briefcase-outline" titulo="Painel da gestão" aoTocar={() => router.push('/gestao')} /> : null}
      </Tela>
    </SafeAreaView>
  );
}
