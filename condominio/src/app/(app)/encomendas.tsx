import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { avisar, Botao, Campo, Carregando, Cartao, Subtitulo, Tela, Texto, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { codigoUnidade, formatoUnidade, nomeUnidade, quando, unidadeCombina } from '@/lib/formato';
import { notificar } from '@/lib/notificacoes';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { espaco, useTema } from '@/lib/tema';
import { Unidade } from '@/lib/tipos';

type Encomenda = { id: string; descricao: string; recebida_em: string; retirada_em: string | null; retirada_por: string | null; unidades: Unidade | null };

export default function Encomendas() {
  const { c } = useTema();
  const { condominioId, membro, ePortaria, nome } = useSessao();
  const [busca, setBusca] = useState('');
  const [unidadeSel, setUnidadeSel] = useState<Unidade | null>(null);
  const [descricao, setDescricao] = useState('');

  const { dados, carregando, recarregar } = useConsulta(async () => {
    let q = supabase.from('encomendas').select('id, descricao, recebida_em, retirada_em, retirada_por, unidades(id, bloco, numero)')
      .eq('condominio_id', condominioId).order('recebida_em', { ascending: false }).limit(100);
    if (!ePortaria && membro?.unidade_id) q = q.eq('unidade_id', membro.unidade_id);
    const [e, u] = await Promise.all([
      q.returns<Encomenda[]>(),
      ePortaria ? supabase.from('unidades').select('id, bloco, numero').eq('condominio_id', condominioId).order('bloco').order('numero').returns<Unidade[]>() : Promise.resolve({ data: [] as Unidade[] }),
    ]);
    return { data: { encomendas: e.data ?? [], unidades: u.data ?? [] }, error: e.error };
  }, [condominioId]);

  async function registrar() {
    if (!unidadeSel) return avisar('Escolha a unidade');
    const { data, error } = await supabase.from('encomendas')
      .insert({ condominio_id: condominioId, unidade_id: unidadeSel.id, descricao: descricao.trim() || 'Pacote' })
      .select('id').single();
    if (error) return avisar('Não foi possível registrar', mensagemErro(error));
    notificar('encomenda', data.id);
    setUnidadeSel(null); setDescricao(''); setBusca('');
    recarregar();
  }

  async function retirar(e: Encomenda) {
    const quem = ePortaria ? (e.unidades ? `Morador(a) ${nomeUnidade(e.unidades)}` : 'Morador(a)') : nome;
    const { error } = await supabase.from('encomendas').update({ retirada_em: new Date().toISOString(), retirada_por: quem }).eq('id', e.id);
    if (error) return avisar('Não foi possível', mensagemErro(error));
    recarregar();
  }

  if (!dados) return <Carregando />;
  const aguardando = dados.encomendas.filter((e) => !e.retirada_em);
  const retiradas = dados.encomendas.filter((e) => e.retirada_em).slice(0, 15);
  const filtradas = busca ? dados.unidades.filter((u) => unidadeCombina(u, busca)).slice(0, 12) : [];

  return (
    <Tela aoAtualizar={recarregar} atualizando={carregando}>
      <Stack.Screen options={{ title: 'Encomendas' }} />
      {ePortaria ? (
        <Cartao>
          <Texto tamanho="subtitulo" negrito>Registrar chegada</Texto>
          {unidadeSel ? (
            <>
              <Texto>Unidade: <Texto negrito>{nomeUnidade(unidadeSel)}</Texto></Texto>
              <Campo rotulo="O que chegou?" valor={descricao} aoMudar={setDescricao} placeholder="Ex.: Caixa média, Correios" />
              <Botao titulo="Registrar e avisar morador" icone="notifications-outline" aoTocar={registrar} />
              <Botao tipo="texto" titulo="Trocar unidade" aoTocar={() => setUnidadeSel(null)} />
            </>
          ) : (
            <>
              <Campo rotulo="Número da unidade" valor={busca} aoMudar={setBusca} placeholder={formatoUnidade() === 'quadra_lote' ? 'Ex.: Q8L1' : 'Ex.: 101'} keyboardType="default" autoCapitalize="characters" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
                {filtradas.map((u) => (
                  <Pressable key={u.id} onPress={() => setUnidadeSel(u)} accessibilityRole="button"
                    style={{ minHeight: 52, minWidth: 90, paddingHorizontal: espaco.m, borderRadius: 12, borderWidth: 2, borderColor: c.primaria, alignItems: 'center', justifyContent: 'center' }}>
                    <Texto negrito cor={c.primaria}>{codigoUnidade(u)}</Texto>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </Cartao>
      ) : null}

      <Subtitulo>Aguardando retirada</Subtitulo>
      {aguardando.length === 0 ? <Vazio icone="cube-outline" texto="Nenhuma encomenda esperando." /> : null}
      {aguardando.map((e) => (
        <Cartao key={e.id} destaque="primaria">
          <Texto tamanho="subtitulo" negrito>📦 {e.descricao}</Texto>
          <Texto suave>Chegou {quando(e.recebida_em)}{ePortaria && e.unidades ? ` · ${nomeUnidade(e.unidades)}` : ''}</Texto>
          <Botao tipo="secundario" icone="checkmark" titulo={ePortaria ? 'Entregue ao morador' : 'Já retirei'} aoTocar={() => retirar(e)} />
        </Cartao>
      ))}

      {retiradas.length ? <Subtitulo>Retiradas recentemente</Subtitulo> : null}
      {retiradas.map((e) => (
        <Cartao key={e.id}>
          <Texto>{e.descricao}{ePortaria && e.unidades ? ` · ${nomeUnidade(e.unidades)}` : ''}</Texto>
          <Texto tamanho="pequeno" suave>Retirada {quando(e.retirada_em!)}{e.retirada_por ? ` por ${e.retirada_por}` : ''}</Texto>
        </Cartao>
      ))}
    </Tela>
  );
}
