import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { FotoPrivada } from '@/components/fotoPrivada';
import { Botao, Carregando, Cartao, Linha, Opcoes, Selo, Subtitulo, Tela, Texto, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { nomeUnidade, quando } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { espaco, useTema } from '@/lib/tema';
import { ESPECIES, Pet } from '@/lib/tipos';

// Pets do condomínio: quando um bichinho aparece no seu quintal, você descobre de quem é.
export default function Pets() {
  const { c } = useTema();
  const { condominioId, membro } = useSessao();
  const [especie, setEspecie] = useState<string>('todos');

  const { dados, recarregar } = useConsulta(
    () => supabase.from('pets').select('*, unidades(bloco, numero)').eq('condominio_id', condominioId).eq('ativo', true)
      .order('perdido', { ascending: false }).order('nome').returns<Pet[]>(),
    [condominioId],
  );

  if (!dados) return <Carregando />;
  const perdidos = dados.filter((p) => p.perdido);
  const meus = dados.filter((p) => p.unidade_id === membro?.unidade_id);
  const lista = dados.filter((p) => !p.perdido && (especie === 'todos' || p.especie === especie));

  const cartao = (p: Pet) => (
    <Cartao key={p.id} destaque={p.perdido ? 'perigo' : undefined} aoTocar={() => router.push(`/pets/${p.id}`)}
      rotulo={`${p.nome}, ${ESPECIES[p.especie].nome}${p.unidades ? `, ${nomeUnidade(p.unidades)}` : ''}${p.perdido ? ', PERDIDO' : ''}`}>
      <View style={{ flexDirection: 'row', gap: espaco.m, alignItems: 'center' }}>
        <FotoPrivada caminho={p.foto_path} emoji={ESPECIES[p.especie].emoji} tamanho={84} rotulo={`Foto de ${p.nome}`} />
        <View style={{ flex: 1, gap: 2 }}>
          {p.perdido ? <Selo texto={`PERDIDO ${p.perdido_desde ? quando(p.perdido_desde) : ''}`} tipo="perigo" /> : null}
          <Texto tamanho="subtitulo" negrito>{p.nome}</Texto>
          <Texto suave>{ESPECIES[p.especie].nome}{p.raca ? ` · ${p.raca}` : ''}</Texto>
          {p.unidades ? <Texto negrito cor={c.primaria}>🏠 {nomeUnidade(p.unidades)}</Texto> : null}
        </View>
      </View>
    </Cartao>
  );

  return (
    <Tela aoAtualizar={recarregar}>
      <Stack.Screen options={{ title: 'Pets do condomínio' }} />
      <Texto suave>Achou um bichinho no seu quintal? Procure aqui e toque em “Encontrei este pet” para avisar o dono.</Texto>

      {perdidos.length ? (
        <>
          <Subtitulo>🚨 Procurando o dono agora</Subtitulo>
          {perdidos.map(cartao)}
        </>
      ) : null}

      {membro?.unidade_id ? (
        <Cartao destaque="primaria">
          <Texto negrito>Meus pets</Texto>
          {meus.length === 0 ? <Texto suave>Cadastre seu pet: se ele escapar, os vizinhos sabem onde devolver.</Texto> : null}
          {meus.map((p) => (
            <Linha key={p.id}>
              <Texto style={{ flex: 1 }}>{ESPECIES[p.especie].emoji} {p.nome}</Texto>
              <Botao tipo={p.perdido ? 'secundario' : 'perigo'} titulo={p.perdido ? 'Já voltou' : 'Fugiu!'} aoTocar={() => router.push(`/pets/${p.id}`)} />
            </Linha>
          ))}
          <Botao icone="add-circle-outline" titulo="Cadastrar meu pet" aoTocar={() => router.push('/pets/novo')} />
        </Cartao>
      ) : null}

      <Subtitulo>Todos os pets ({dados.length - perdidos.length})</Subtitulo>
      <Opcoes valor={especie} aoMudar={setEspecie} opcoes={[{ valor: 'todos', nome: 'Todos' }, ...Object.entries(ESPECIES).map(([valor, e]) => ({ valor, nome: `${e.emoji} ${e.nome}` }))]} />
      {lista.length === 0 ? <Vazio icone="paw-outline" texto="Nenhum pet cadastrado ainda." /> : null}
      {lista.map(cartao)}
    </Tela>
  );
}
