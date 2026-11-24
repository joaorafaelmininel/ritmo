import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Botao, Carregando, Cartao, Linha, Opcoes, Progresso, Selo, Tela, Texto } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataCurta } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { espaco } from '@/lib/tema';
import { Dimensao, DIMENSOES, Projeto, STATUS_PROJETO } from '@/lib/tipos';

const tipoStatus = (s: Projeto['status']) =>
  ({ planejado: 'neutro', em_andamento: 'primaria', concluido: 'sucesso', pausado: 'alerta' } as const)[s];

// O plano de gestão da síndica, aberto aos moradores, nas quatro dimensões.
export default function Plano() {
  const { condominioId, eGestor } = useSessao();
  const { dimensao } = useLocalSearchParams<{ dimensao?: Dimensao }>();
  const [dim, setDim] = useState<Dimensao | 'todas'>(dimensao && dimensao in DIMENSOES ? dimensao : 'todas');
  const { dados, carregando, recarregar } = useConsulta(
    () => supabase.from('projetos').select('*').eq('condominio_id', condominioId).order('ordem').order('criado_em').returns<Projeto[]>(),
    [condominioId],
  );

  if (!dados) return <Carregando />;
  const dims = (Object.keys(DIMENSOES) as Dimensao[]).filter((d) => dim === 'todas' || d === dim);

  return (
    <Tela aoAtualizar={recarregar} atualizando={carregando}>
      <Stack.Screen options={{ title: 'Plano de gestão' }} />
      <Texto suave>O que a gestão está fazendo pelo condomínio, e em que pé está cada coisa.</Texto>
      <Opcoes
        valor={dim}
        aoMudar={setDim}
        opcoes={[{ valor: 'todas', nome: 'Tudo' }, ...(Object.keys(DIMENSOES) as Dimensao[]).map((d) => ({ valor: d, nome: DIMENSOES[d].nome }))]}
      />
      {eGestor ? <Botao icone="add-circle-outline" titulo="Novo projeto ou processo" aoTocar={() => router.push('/plano/novo')} /> : null}

      {dims.map((d) => {
        const lista = dados.filter((p) => p.dimensao === d);
        const projetos = lista.filter((p) => p.tipo === 'projeto');
        const media = projetos.length ? Math.round(projetos.reduce((s, p) => s + p.progresso, 0) / projetos.length) : 0;
        const info = DIMENSOES[d];
        return (
          <View key={d} style={{ gap: espaco.s, marginTop: espaco.m }}>
            <Linha>
              <Ionicons name={info.icone as never} size={30} color={info.cor} />
              <View style={{ flex: 1 }}>
                <Texto tamanho="subtitulo" negrito cor={info.cor}>{info.nome}</Texto>
                <Texto tamanho="pequeno" suave>{info.apelido}{projetos.length ? ` · projetos ${media}% concluídos` : ''}</Texto>
              </View>
            </Linha>
            <Progresso valor={media} cor={info.cor} />
            {lista.length === 0 ? <Texto suave>Nada cadastrado nesta dimensão.</Texto> : null}
            {lista.map((p) => (
              <Cartao key={p.id} aoTocar={() => router.push(`/plano/${p.id}`)} rotulo={`${p.titulo}, ${STATUS_PROJETO[p.status]}, ${p.progresso} por cento`}>
                <Linha>
                  <Selo texto={STATUS_PROJETO[p.status]} tipo={tipoStatus(p.status)} />
                  <Selo texto={p.tipo === 'processo' ? 'Rotina' : 'Projeto'} />
                  {!p.publico ? <Selo texto="Interno" tipo="alerta" /> : null}
                </Linha>
                <Texto negrito>{p.titulo}</Texto>
                {p.tipo === 'projeto' ? <Progresso valor={p.progresso} cor={info.cor} /> : null}
                <Texto tamanho="pequeno" suave>
                  {p.tipo === 'projeto' ? `${p.progresso}%` : 'Processo contínuo'}
                  {p.prazo ? ` · prazo ${dataCurta(p.prazo)}` : ''}
                  {p.responsavel ? ` · ${p.responsavel}` : ''}
                </Texto>
              </Cartao>
            ))}
          </View>
        );
      })}
      <Botao tipo="secundario" icone="bulb-outline" titulo="Tenho uma ideia para o condomínio" aoTocar={() => router.push('/sugestoes')} style={{ marginTop: espaco.l }} />
    </Tela>
  );
}
