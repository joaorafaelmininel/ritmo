import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { BotaoOuvir, Botao, Carregando, Cartao, Linha, Selo, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataPorExtenso } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { Aviso, CATEGORIAS_AVISO } from '@/lib/tipos';

export default function VerAviso() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { eGestor } = useSessao();
  const confirmar = useConfirmar();
  const [leituras, setLeituras] = useState<number | null>(null);

  const { dados: aviso } = useConsulta(
    () => supabase.from('avisos').select('*, perfis(nome)').eq('id', id).single<Aviso>(),
    [id],
  );

  // Abrir o aviso já conta como lido (a gestão vê quantos leram).
  useEffect(() => {
    supabase.from('avisos_leituras').upsert({ aviso_id: id }, { onConflict: 'aviso_id,perfil_id', ignoreDuplicates: true }).then(() => {});
    if (eGestor) supabase.rpc('leituras_aviso', { p_aviso: id }).then(({ data }) => setLeituras(data as number));
  }, [id, eGestor]);

  if (!aviso) return <Carregando />;
  return (
    <Tela>
      <Stack.Screen options={{ title: 'Aviso' }} />
      <Linha>
        {aviso.importante ? <Selo texto="Importante" tipo="alerta" /> : null}
        <Selo texto={CATEGORIAS_AVISO[aviso.categoria] ?? aviso.categoria} />
      </Linha>
      <Texto tamanho="titulo" negrito>{aviso.titulo}</Texto>
      <Texto suave>
        Publicado {dataPorExtenso(aviso.publicado_em)}{aviso.perfis?.nome ? ` por ${aviso.perfis.nome}` : ''}
      </Texto>
      <BotaoOuvir texto={`${aviso.titulo}. ${aviso.corpo}`} />
      <Cartao>
        <Texto tamanho="subtitulo" style={{ lineHeight: 34 }}>{aviso.corpo}</Texto>
      </Cartao>
      {eGestor ? (
        <>
          <Cartao destaque="primaria">
            <Texto negrito>Confirmações de leitura</Texto>
            <Texto>{leituras === null ? '…' : `${leituras} pessoa${leituras === 1 ? '' : 's'} já abriram este aviso.`}</Texto>
            <Texto tamanho="pequeno" suave>Dica: para quem não usa celular, imprima e coloque no mural.</Texto>
          </Cartao>
          <Botao
            tipo="secundario"
            icone="pin-outline"
            titulo={aviso.fixado ? 'Desafixar do topo' : 'Fixar no topo da lista'}
            aoTocar={async () => { await supabase.from('avisos').update({ fixado: !aviso.fixado }).eq('id', id); router.back(); }}
          />
          <Botao
            tipo="perigo"
            icone="trash-outline"
            titulo="Apagar aviso"
            aoTocar={() => confirmar('Apagar aviso?', 'Ele sumirá para todos os moradores.', async () => {
              await supabase.from('avisos').delete().eq('id', id);
              router.back();
            }, 'Sim, apagar')}
          />
        </>
      ) : null}
    </Tela>
  );
}
