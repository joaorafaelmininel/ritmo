import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { FotoPrivada } from '@/components/fotoPrivada';
import { Botao, Carregando, Cartao, Opcoes, Selo, Tela, Texto, useConfirmar, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { quando } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { espaco } from '@/lib/tema';

type Achado = { id: string; autor_id: string | null; tipo: 'achado' | 'perdido'; titulo: string; descricao: string | null; local: string | null; onde_retirar: string | null; foto_path: string | null; status: string; criado_em: string; perfis: { nome: string } | null };

export default function Achados() {
  const { condominioId, sessao, ePortaria } = useSessao();
  const confirmar = useConfirmar();
  const [filtro, setFiltro] = useState<'achado' | 'perdido'>('achado');
  const { dados, recarregar } = useConsulta(
    () => supabase.from('achados').select('*, perfis(nome)').eq('condominio_id', condominioId).eq('status', 'aberto').eq('tipo', filtro).order('criado_em', { ascending: false }).returns<Achado[]>(),
    [condominioId, filtro],
  );
  return (
    <Tela aoAtualizar={recarregar}>
      <Stack.Screen options={{ title: 'Achados e perdidos' }} />
      <Opcoes valor={filtro} aoMudar={setFiltro} opcoes={[{ valor: 'achado', nome: 'Encontrados' }, { valor: 'perdido', nome: 'Procura-se' }]} />
      <View style={{ gap: espaco.s }}>
        <Botao icone="search-outline" titulo="Encontrei um objeto" aoTocar={() => router.push('/achados/novo?tipo=achado')} />
        <Botao tipo="secundario" icone="help-buoy-outline" titulo="Perdi um objeto" aoTocar={() => router.push('/achados/novo?tipo=perdido')} />
      </View>
      {!dados ? <Carregando /> : null}
      {dados?.length === 0 ? <Vazio icone="search-outline" texto={filtro === 'achado' ? 'Nenhum objeto encontrado aguardando dono.' : 'Ninguém procurando nada agora.'} /> : null}
      {dados?.map((a) => (
        <Cartao key={a.id}>
          <View style={{ flexDirection: 'row', gap: espaco.m }}>
            <FotoPrivada caminho={a.foto_path} emoji={a.tipo === 'achado' ? '🔑' : '❓'} tamanho={88} />
            <View style={{ flex: 1, gap: 2 }}>
              <Selo texto={a.tipo === 'achado' ? 'Encontrado' : 'Procura-se'} tipo={a.tipo === 'achado' ? 'primaria' : 'alerta'} />
              <Texto tamanho="subtitulo" negrito>{a.titulo}</Texto>
              {a.local ? <Texto>📍 {a.local}</Texto> : null}
            </View>
          </View>
          {a.descricao ? <Texto>{a.descricao}</Texto> : null}
          {a.onde_retirar ? <Texto negrito>Retirar: {a.onde_retirar}</Texto> : null}
          <Texto tamanho="pequeno" suave>{a.perfis?.nome ?? 'Vizinho'} · {quando(a.criado_em)}</Texto>
          {a.autor_id === sessao?.user.id || ePortaria ? (
            <Botao tipo="secundario" icone="checkmark" titulo={a.tipo === 'achado' ? 'Já foi devolvido' : 'Já encontrei'} aoTocar={() => confirmar('Resolvido?', a.titulo, async () => {
              await supabase.from('achados').update({ status: 'resolvido' }).eq('id', a.id);
              recarregar();
            })} />
          ) : null}
        </Cartao>
      ))}
    </Tela>
  );
}
