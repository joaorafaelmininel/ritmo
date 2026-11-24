import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { FotoPrivada } from '@/components/fotoPrivada';
import { avisar, Botao, Campo, Carregando, Cartao, Selo, Subtitulo, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { nomeUnidade, quando } from '@/lib/formato';
import { notificar } from '@/lib/notificacoes';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { espaco, useTema } from '@/lib/tema';
import { ESPECIES, Pet } from '@/lib/tipos';

type Fuga = { id: string; inicio: string; fim: string | null; onde_encontrado: string | null };
type Avistamento = { id: string; local: string | null; criado_em: string; perfis: { nome: string } | null };

export default function VerPet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTema();
  const { membro, eGestor } = useSessao();
  const confirmar = useConfirmar();
  const [local, setLocal] = useState('');
  const [encontrando, setEncontrando] = useState(false);
  const [voltou, setVoltou] = useState(false);
  const [ondeAchado, setOndeAchado] = useState('');

  const { dados, recarregar } = useConsulta(async () => {
    const [p, a, f] = await Promise.all([
      supabase.from('pets').select('*, unidades(bloco, numero)').eq('id', id).single<Pet>(),
      supabase.from('pets_avistamentos').select('id, local, criado_em, perfis(nome)').eq('pet_id', id).order('criado_em', { ascending: false }).limit(10).returns<Avistamento[]>(),
      supabase.from('pets_fugas').select('*').eq('pet_id', id).order('inicio', { ascending: false }).returns<Fuga[]>(),
    ]);
    return { data: p.data ? { pet: p.data, vistos: a.data ?? [], fugas: f.data ?? [] } : null, error: p.error };
  }, [id]);

  if (!dados) return <Carregando />;
  const { pet, vistos, fugas } = dados;
  const meu = pet.unidade_id === membro?.unidade_id;

  async function marcarPerdido(perdido: boolean) {
    const { error } = await supabase.from('pets').update({ perdido }).eq('id', id);
    if (error) return avisar('Não foi possível', mensagemErro(error));
    if (perdido) notificar('pet_perdido', id);
    else if (ondeAchado.trim() && fugas[0]) await supabase.from('pets_fugas').update({ onde_encontrado: ondeAchado.trim() }).eq('id', fugas[0].id);
    setVoltou(false); setOndeAchado('');
    recarregar();
  }

  async function encontrei() {
    const { data, error } = await supabase.from('pets_avistamentos').insert({ pet_id: id, local: local.trim() || null }).select('id').single();
    if (error) return avisar('Não foi possível avisar', mensagemErro(error));
    notificar('pet_visto', data.id);
    setEncontrando(false); setLocal('');
    avisar('Dono avisado!', `A unidade ${nomeUnidade(pet.unidades)} recebeu o aviso. Obrigado por ajudar!`);
    recarregar();
  }

  return (
    <Tela>
      <Stack.Screen options={{ title: pet.nome }} />
      <View style={{ alignItems: 'center', gap: espaco.s }}>
        <FotoPrivada caminho={pet.foto_path} emoji={ESPECIES[pet.especie].emoji} tamanho={220} rotulo={`Foto de ${pet.nome}`} />
        {pet.perdido ? <Selo texto={`PERDIDO ${pet.perdido_desde ? quando(pet.perdido_desde) : ''}`} tipo="perigo" /> : null}
        <Texto tamanho="grande" negrito>{pet.nome}</Texto>
        <Texto suave>{ESPECIES[pet.especie].nome}{pet.raca ? ` · ${pet.raca}` : ''}</Texto>
      </View>

      <Cartao destaque="primaria">
        <Texto>Mora na</Texto>
        <Texto tamanho="titulo" negrito cor={c.primaria}>🏠 {nomeUnidade(pet.unidades)}</Texto>
      </Cartao>
      {pet.descricao ? <Cartao><Texto negrito>Como reconhecer</Texto><Texto>{pet.descricao}</Texto></Cartao> : null}
      {pet.cuidados ? <Cartao destaque="alerta"><Texto negrito>Cuidados</Texto><Texto>{pet.cuidados}</Texto></Cartao> : null}

      {!meu ? (
        encontrando ? (
          <Cartao>
            <Campo rotulo="Onde ele está?" ajuda="Opcional. Ex.: no meu quintal, casa 210" valor={local} aoMudar={setLocal} />
            <Botao icone="notifications-outline" titulo="Avisar o dono agora" aoTocar={encontrei} />
            <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setEncontrando(false)} />
          </Cartao>
        ) : (
          <Botao icone="paw-outline" titulo="Encontrei este pet" aoTocar={() => setEncontrando(true)} style={{ minHeight: 72 }} />
        )
      ) : null}

      {meu ? (
        pet.perdido ? (
          voltou ? (
            <Cartao>
              <Campo rotulo="Onde ele foi encontrado?" ajuda="Opcional. Ajuda a saber por onde ele costuma escapar." valor={ondeAchado} aoMudar={setOndeAchado} />
              <Botao icone="happy-outline" titulo="Confirmar: voltou para casa" aoTocar={() => marcarPerdido(false)} />
            </Cartao>
          ) : (
            <Botao icone="happy-outline" titulo={`${pet.nome} voltou para casa`} aoTocar={() => setVoltou(true)} />
          )
        ) : (
          <Botao tipo="perigo" icone="alert-circle-outline" titulo={`${pet.nome} fugiu — avisar os vizinhos`} aoTocar={() => confirmar('Avisar o condomínio?', `Todos os moradores receberão um aviso de que ${pet.nome} fugiu.`, () => marcarPerdido(true), 'Sim, avisar')} />
        )
      ) : null}

      {(meu || eGestor) && vistos.length ? (
        <>
          <Subtitulo>Vizinhos que viram {pet.nome}</Subtitulo>
          {vistos.map((v) => (
            <Cartao key={v.id}>
              <Texto negrito>{v.perfis?.nome ?? 'Um vizinho'} · {quando(v.criado_em)}</Texto>
              {v.local ? <Texto>📍 {v.local}</Texto> : null}
            </Cartao>
          ))}
        </>
      ) : null}

      {fugas.length ? (
        <>
          <Subtitulo>Histórico de fugas ({fugas.length})</Subtitulo>
          {fugas.slice(0, 8).map((f) => {
            const horas = f.fim ? Math.max(1, Math.round((new Date(f.fim).getTime() - new Date(f.inicio).getTime()) / 3600000)) : null;
            return (
              <Texto key={f.id}>
                • {new Date(f.inicio).toLocaleDateString('pt-BR')}{horas ? ` — voltou em ${horas < 24 ? `${horas}h` : `${Math.round(horas / 24)} dia(s)`}` : ' — ainda sumido'}
                {f.onde_encontrado ? ` · achado em: ${f.onde_encontrado}` : ''}
              </Texto>
            );
          })}
          {meu && fugas.length >= 2 ? (
            <Texto tamanho="pequeno" suave>Dica: veja se há um ponto do muro ou portão por onde ele costuma escapar.</Texto>
          ) : null}
        </>
      ) : null}

      {meu || eGestor ? (
        <Botao tipo="texto" titulo="Remover cadastro" aoTocar={() => confirmar('Remover cadastro?', pet.nome, async () => {
          if (pet.foto_path) await supabase.storage.from('arquivos').remove([pet.foto_path]);
          await supabase.from('pets').delete().eq('id', id);
          router.back();
        }, 'Sim, remover')} />
      ) : null}
    </Tela>
  );
}
