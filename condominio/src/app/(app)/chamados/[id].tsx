import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { avisar, Botao, Campo, Carregando, Cartao, Linha, Selo, Subtitulo, Tela, Texto, useConfirmar } from '@/components/ui';
import { linkArquivo } from '@/lib/arquivos';
import { useConsulta } from '@/lib/consulta';
import { dataPorExtenso, nomeUnidade, quando } from '@/lib/formato';
import { notificar } from '@/lib/notificacoes';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { espaco } from '@/lib/tema';
import { CATEGORIAS_CHAMADO, Chamado, corStatus, STATUS_CHAMADO } from '@/lib/tipos';

type Atualizacao = { id: string; texto: string; status_novo: string | null; criado_em: string; perfis: { nome: string } | null };

export default function VerChamado() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { eGestor, sessao } = useSessao();
  const confirmar = useConfirmar();
  const [resposta, setResposta] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);

  const { dados, recarregar } = useConsulta(async () => {
    const [c, a] = await Promise.all([
      supabase.from('chamados').select('*, unidades(bloco, numero), perfis(nome)').eq('id', id).single<Chamado>(),
      supabase.from('chamados_atualizacoes').select('id, texto, status_novo, criado_em, perfis(nome)').eq('chamado_id', id).order('criado_em').returns<Atualizacao[]>(),
    ]);
    return { data: c.data ? { chamado: c.data, historico: a.data ?? [] } : null, error: c.error };
  }, [id]);

  useEffect(() => {
    if (dados?.chamado.fotos.length) Promise.all(dados.chamado.fotos.map(linkArquivo)).then(setFotos).catch(() => {});
  }, [dados?.chamado.fotos]);

  if (!dados) return <Carregando />;
  const { chamado, historico } = dados;
  const meu = chamado.autor_id === sessao?.user.id;
  const encerrado = chamado.status === 'resolvido' || chamado.status === 'cancelado';

  async function responder(status?: Chamado['status']) {
    if (!resposta.trim() && !status) return avisar('Escreva uma mensagem');
    const texto = resposta.trim() || `Situação alterada para: ${STATUS_CHAMADO[status!]}`;
    const { error } = await supabase.from('chamados_atualizacoes').insert({ chamado_id: id, texto, status_novo: status ?? null });
    if (error) return avisar('Não foi possível enviar', mensagemErro(error));
    if (eGestor) notificar('chamado', id);
    setResposta('');
    recarregar();
  }

  return (
    <Tela>
      <Stack.Screen options={{ title: 'Ocorrência' }} />
      <Linha>
        <Selo texto={STATUS_CHAMADO[chamado.status]} tipo={corStatus(chamado.status)} />
        <Selo texto={CATEGORIAS_CHAMADO[chamado.categoria] ?? chamado.categoria} />
      </Linha>
      <Texto tamanho="titulo" negrito>{chamado.titulo}</Texto>
      <Texto suave>
        Aberto {dataPorExtenso(chamado.criado_em)}
        {eGestor && chamado.perfis?.nome ? ` por ${chamado.perfis.nome}` : ''}
        {eGestor && chamado.unidades ? ` (${nomeUnidade(chamado.unidades)})` : ''}
      </Texto>
      {chamado.local ? <Texto>📍 {chamado.local}</Texto> : null}
      {chamado.descricao ? <Cartao><Texto>{chamado.descricao}</Texto></Cartao> : null}
      {fotos.length ? (
        <Linha>
          {fotos.map((u) => <Image key={u} source={{ uri: u }} style={{ width: 150, height: 150, borderRadius: 12 }} accessibilityLabel="Foto do pedido" />)}
        </Linha>
      ) : null}

      <Subtitulo>Andamento</Subtitulo>
      {historico.length === 0 ? <Texto suave>Ainda sem resposta. A gestão foi avisada.</Texto> : null}
      {historico.map((h) => (
        <Cartao key={h.id} destaque={h.status_novo === 'resolvido' ? 'sucesso' : undefined}>
          <Texto tamanho="pequeno" suave>{h.perfis?.nome ?? 'Alguém'} · {quando(h.criado_em)}</Texto>
          <Texto>{h.texto}</Texto>
          {h.status_novo ? <Selo texto={`→ ${STATUS_CHAMADO[h.status_novo as Chamado['status']]}`} tipo="primaria" /> : null}
        </Cartao>
      ))}

      {!encerrado || eGestor ? (
        <View style={{ gap: espaco.s }}>
          <Campo rotulo={eGestor ? 'Responder ao morador' : 'Enviar mensagem à gestão'} valor={resposta} aoMudar={setResposta} multilinha />
          <Botao icone="chatbubble-outline" titulo="Enviar mensagem" aoTocar={() => responder()} />
          {eGestor ? (
            <>
              {chamado.status !== 'em_andamento' ? <Botao tipo="secundario" icone="time-outline" titulo="Marcar: em andamento" aoTocar={() => responder('em_andamento')} /> : null}
              {chamado.status !== 'resolvido' ? <Botao tipo="secundario" icone="checkmark-done-outline" titulo="Marcar: resolvido" aoTocar={() => responder('resolvido')} /> : null}
            </>
          ) : null}
          {meu && chamado.status === 'aberto' ? (
            <Botao tipo="perigo" titulo="Cancelar esta ocorrência" aoTocar={() => confirmar('Cancelar ocorrência?', 'A gestão não vai mais tratar este assunto.', async () => {
              await supabase.from('chamados').update({ status: 'cancelado' }).eq('id', id);
              router.back();
            })} />
          ) : null}
        </View>
      ) : null}
    </Tela>
  );
}
