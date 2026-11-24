import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { ItemLista } from '@/components/lista';
import { RespostaPortaria } from '@/components/respostaPortaria';
import { Botao, Cartao, Linha, Subtitulo, Tela, Texto } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { emServico, hora } from '@/lib/equipe';
import { isoData, quando } from '@/lib/formato';
import { useResumo } from '@/lib/resumo';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { espaco } from '@/lib/tema';
import { Equipe, FUNCOES_EQUIPE, RegistroPortaria } from '@/lib/tipos';

type Comunicado = { id: string; titulo: string; categoria: string; publicado_em: string; valido_ate: string | null };
const COR = '#0B4F8A';

// "Dia a dia": quem está trabalhando agora, comunicados de serviço e tudo da portaria.
export default function DiaADia() {
  const { condominioId, membro, eGestor, ePortaria } = useSessao();
  const { dados: resumo, recarregar: recarregarResumo } = useResumo();

  const { dados, recarregar } = useConsulta(async () => {
    const agora = new Date().toISOString();
    const tresDias = new Date(Date.now() - 3 * 86400000).toISOString();
    const [eq, av, pt] = await Promise.all([
      supabase.from('equipe').select('*').eq('condominio_id', condominioId).eq('ativo', true).returns<Equipe[]>(),
      supabase.from('avisos').select('id, titulo, categoria, publicado_em, valido_ate').eq('condominio_id', condominioId)
        .in('categoria', ['operacional', 'manutencao', 'seguranca'])
        .or(`valido_ate.gte.${agora},and(valido_ate.is.null,publicado_em.gte.${tresDias})`)
        .order('publicado_em', { ascending: false }).limit(10).returns<Comunicado[]>(),
      membro?.unidade_id
        ? supabase.from('portaria').select('*').eq('unidade_id', membro.unidade_id).eq('status', 'na_portaria').returns<RegistroPortaria[]>()
        : Promise.resolve({ data: [] as RegistroPortaria[] }),
    ]);
    return { data: { equipe: eq.data ?? [], comunicados: av.data ?? [], pendentes: pt.data ?? [] }, error: eq.error };
  }, [condominioId]);

  const agora = (dados?.equipe ?? []).filter((e) => emServico(e));

  return (
    <Tela aoAtualizar={() => { recarregar(); recarregarResumo(); }}>
      <Stack.Screen options={{ title: 'Dia a dia' }} />

      {dados?.pendentes.map((r) => <RespostaPortaria key={r.id} r={r} aoResponder={recarregar} />)}

      {/* Quem está trabalhando agora */}
      <Cartao>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s }}><Ionicons name="person-circle-outline" size={30} color={COR} /><Texto tamanho="subtitulo" negrito style={{ flex: 1 }}>Agora no condomínio</Texto></View>
        {dados && agora.length === 0 ? <Texto suave>{dados.equipe.length ? 'Ninguém da equipe em serviço neste horário.' : 'A gestão ainda não cadastrou a equipe.'}</Texto> : null}
        {agora.map((e) => (
          <Linha key={e.id} style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Texto negrito>{e.nome}</Texto>
              <Texto tamanho="pequeno" suave>{FUNCOES_EQUIPE[e.funcao]} · até {hora(e.hora_fim)}</Texto>
            </View>
            {e.ramal ? <Botao tipo="secundario" icone="call-outline" titulo="Ligar" aoTocar={() => { Linking.openURL(`tel:${e.ramal!.replace(/[^\d+]/g, '')}`); }} /> : null}
          </Linha>
        ))}
        <Botao tipo="texto" titulo="Ver equipe e horários" aoTocar={() => router.push('/equipe')} />
      </Cartao>

      {/* Comunicados de serviço */}
      <Cartao>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s }}><Ionicons name="information-circle-outline" size={30} color={COR} /><Texto tamanho="subtitulo" negrito style={{ flex: 1 }}>Comunicados do dia a dia</Texto></View>
        {dados && dados.comunicados.length === 0 ? <Texto suave>Tudo funcionando normalmente.</Texto> : null}
        {dados?.comunicados.map((a) => (
          <Cartao key={a.id} aoTocar={() => router.push(`/aviso/${a.id}`)} rotulo={a.titulo}>
            <Texto negrito>{a.titulo}</Texto>
            <Texto tamanho="pequeno" suave>{quando(a.publicado_em)}{a.valido_ate && a.valido_ate.slice(0, 10) !== isoData(new Date()) ? ` · até ${new Date(a.valido_ate).toLocaleDateString('pt-BR')}` : a.valido_ate ? ' · até hoje' : ''}</Texto>
          </Cartao>
        ))}
        {ePortaria ? <Botao tipo="secundario" icone="create-outline" titulo="Publicar comunicado" aoTocar={() => router.push('/aviso/novo?categoria=operacional')} /> : null}
      </Cartao>

      {ePortaria ? (
        <ItemLista cor={COR} item={{ titulo: 'Painel da portaria', detalhe: 'Visitantes, esperados e entregas', icone: 'shield-outline', rota: '/portaria', destaque: true }} />
      ) : null}

      <Subtitulo>Portaria</Subtitulo>
      <View style={{ gap: espaco.s }}>
        <ItemLista cor={COR} item={{ titulo: 'Avisar a portaria', detalhe: 'Vou receber visita, prestador ou entrega', icone: 'megaphone-outline', rota: '/portaria/avisar', destaque: !ePortaria }} />
        <ItemLista cor={COR} item={{ titulo: 'Minhas visitas e avisos', detalhe: 'O que a portaria já sabe', icone: 'people-outline', rota: '/portaria' }} />
        <ItemLista cor={COR} item={{ titulo: ePortaria ? 'Encomendas (registrar)' : 'Encomendas', detalhe: 'Pacotes na portaria', icone: 'cube-outline', rota: '/encomendas', contador: resumo?.encomendas }} />
      </View>

      <Subtitulo>Ocorrências e espaços</Subtitulo>
      <View style={{ gap: espaco.s }}>
        <ItemLista cor={COR} item={{ titulo: 'Registrar ocorrência', detalhe: 'Conserto, limpeza, segurança ou barulho', icone: 'alert-circle-outline', rota: '/chamados/novo' }} />
        <ItemLista cor={COR} item={{ titulo: eGestor ? 'Ocorrências dos moradores' : 'Minhas ocorrências', icone: 'list-outline', rota: '/chamados', contador: eGestor ? resumo?.ocorrenciasAbertas : 0 }} />
        <ItemLista cor={COR} item={{ titulo: 'Reservar espaço', detalhe: 'Salão de festas, churrasqueira', icone: 'calendar-outline', rota: '/reservas', contador: eGestor ? resumo?.paraAprovar : 0 }} />
      </View>

      <Subtitulo>Equipe e manutenção</Subtitulo>
      <View style={{ gap: espaco.s }}>
        <ItemLista cor={COR} item={{ titulo: 'Equipe e horários', detalhe: 'Porteiros, zelador, limpeza', icone: 'time-outline', rota: '/equipe' }} />
        <ItemLista cor={COR} item={{ titulo: 'Manutenções', detalhe: 'Calendário preventivo', icone: 'construct-outline', rota: '/manutencoes', contador: eGestor ? resumo?.manutencoesVencidas : 0 }} />
        <ItemLista cor={COR} item={{ titulo: 'Projetos do plano (operacional)', icone: 'map-outline', rota: '/plano?dimensao=operacional' }} />
      </View>
      <Texto tamanho="pequeno" suave style={{ marginTop: espaco.s }}>Em emergência, ligue 190 (Polícia), 192 (SAMU) ou 193 (Bombeiros).</Texto>
    </Tela>
  );
}
