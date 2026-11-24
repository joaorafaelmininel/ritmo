import { router, Stack } from 'expo-router';
import { View } from 'react-native';

import { FotoPrivada } from '@/components/fotoPrivada';
import { Carregando, Cartao, Selo, Tela, Texto, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataCurta, moeda } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { espaco } from '@/lib/tema';
import { DIMENSOES, Projeto } from '@/lib/tipos';

type ProjetoFotos = Projeto & { foto_antes: string | null; foto_depois: string | null; concluido_em: string | null };

// Antes e depois: as melhorias já entregues pela gestão.
export default function Melhorias() {
  const { condominioId } = useSessao();
  const { dados } = useConsulta(
    () => supabase.from('projetos').select('*').eq('condominio_id', condominioId).eq('status', 'concluido')
      .order('concluido_em', { ascending: false, nullsFirst: false }).returns<ProjetoFotos[]>(),
    [condominioId],
  );
  if (!dados) return <Carregando />;
  return (
    <Tela>
      <Stack.Screen options={{ title: 'Antes e depois' }} />
      <Texto suave>Melhorias concluídas no condomínio. Toque para ver os detalhes.</Texto>
      {dados.length === 0 ? <Vazio icone="images-outline" texto="Nenhuma melhoria concluída ainda." /> : null}
      {dados.map((p) => (
        <Cartao key={p.id} aoTocar={() => router.push(`/plano/${p.id}`)} rotulo={p.titulo}>
          <Selo texto={DIMENSOES[p.dimensao].nome} />
          <Texto tamanho="subtitulo" negrito>{p.titulo}</Texto>
          <View style={{ flexDirection: 'row', gap: espaco.s }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Texto tamanho="pequeno" negrito>ANTES</Texto>
              <FotoPrivada caminho={p.foto_antes} emoji="📷" tamanho={140} style={{ width: '100%' }} rotulo="Foto de antes" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Texto tamanho="pequeno" negrito>DEPOIS</Texto>
              <FotoPrivada caminho={p.foto_depois} emoji="✨" tamanho={140} style={{ width: '100%' }} rotulo="Foto de depois" />
            </View>
          </View>
          <Texto tamanho="pequeno" suave>
            {p.concluido_em ? `Concluído em ${dataCurta(p.concluido_em)}` : 'Concluído'}{p.orcamento ? ` · ${moeda(p.orcamento)}` : ''}
          </Texto>
        </Cartao>
      ))}
    </Tela>
  );
}
