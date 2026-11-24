import { router, Stack } from 'expo-router';

import { Botao, Carregando, Cartao, Selo, Tela, Texto, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataCurta } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { Enquete } from '@/lib/tipos';

export default function Enquetes() {
  const { condominioId, eGestor } = useSessao();
  const { dados, carregando, recarregar } = useConsulta(
    () => supabase.from('enquetes').select('*').eq('condominio_id', condominioId).order('criado_em', { ascending: false }).returns<Enquete[]>(),
    [condominioId],
  );
  const agora = new Date().toISOString();
  return (
    <Tela aoAtualizar={recarregar} atualizando={carregando && !!dados}>
      <Stack.Screen options={{ title: 'Enquetes' }} />
      <Texto suave>Dê sua opinião. É um voto por unidade e ninguém fica sabendo em quem você votou.</Texto>
      {eGestor ? <Botao icone="add-circle-outline" titulo="Criar enquete" aoTocar={() => router.push('/enquetes/nova')} /> : null}
      {!dados ? <Carregando /> : null}
      {dados?.length === 0 ? <Vazio icone="checkbox-outline" texto="Nenhuma enquete ainda." /> : null}
      {dados?.map((e) => {
        const aberta = !e.encerra_em || e.encerra_em > agora;
        return (
          <Cartao key={e.id} aoTocar={() => router.push(`/enquetes/${e.id}`)} rotulo={`${e.titulo}, ${aberta ? 'aberta' : 'encerrada'}`}>
            <Selo texto={aberta ? 'Votação aberta' : 'Encerrada'} tipo={aberta ? 'sucesso' : 'neutro'} />
            <Texto tamanho="subtitulo" negrito>{e.titulo}</Texto>
            {e.encerra_em ? <Texto tamanho="pequeno" suave>{aberta ? 'Termina' : 'Terminou'} em {dataCurta(e.encerra_em)}</Texto> : null}
          </Cartao>
        );
      })}
    </Tela>
  );
}
