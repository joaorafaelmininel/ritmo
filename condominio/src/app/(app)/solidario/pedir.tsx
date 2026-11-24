import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { avisar, Botao, Campo, Cartao, Tela, Texto } from '@/components/ui';
import { notificar } from '@/lib/notificacoes';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, espaco, useTema } from '@/lib/tema';
import { TIPOS_AJUDA } from '@/lib/tipos';

export default function PedirAjuda() {
  const { c } = useTema();
  const { condominioId, membro } = useSessao();
  const [tipo, setTipo] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [quandoTxt, setQuando] = useState('');

  async function pedir() {
    if (!membro?.unidade_id) return avisar('Sem unidade', 'Seu cadastro não está ligado a uma unidade.');
    if (!tipo) return avisar('Escolha com o que precisa de ajuda');
    const { data, error } = await supabase.from('ajuda_pedidos').insert({
      condominio_id: condominioId, unidade_id: membro.unidade_id, tipo, descricao: descricao.trim() || null, quando: quandoTxt.trim() || null,
    }).select('id').single();
    if (error) return avisar('Não foi possível pedir', mensagemErro(error));
    notificar('ajuda', data.id);
    avisar('Pedido enviado!', 'Os vizinhos voluntários foram avisados. Quando alguém aceitar, você verá aqui quem vai ajudar.');
    router.back();
  }

  return (
    <Tela rodape={<Botao titulo="Pedir ajuda" icone="send-outline" aoTocar={pedir} />}>
      <Stack.Screen options={{ title: 'Preciso de ajuda' }} />
      <Texto tamanho="subtitulo" negrito>Com o que você precisa de ajuda?</Texto>
      <View style={{ gap: espaco.s }}>
        {Object.entries(TIPOS_AJUDA).map(([k, t]) => {
          const sel = tipo === k;
          return (
            <Pressable key={k} onPress={() => setTipo(k)} accessibilityRole="radio" accessibilityState={{ checked: sel }} accessibilityLabel={t.nome}
              style={{ minHeight: ALVO_TOQUE + 8, borderRadius: 14, borderWidth: sel ? 3 : 2, borderColor: sel ? c.primaria : c.borda, backgroundColor: sel ? c.primariaSuave : c.superficie, flexDirection: 'row', alignItems: 'center', gap: espaco.m, paddingHorizontal: espaco.m }}>
              <Ionicons name={t.icone as never} size={30} color={c.primaria} />
              <Texto tamanho="subtitulo" negrito={sel} style={{ flex: 1 }}>{t.nome}</Texto>
              {sel ? <Ionicons name="checkmark-circle" size={30} color={c.primaria} /> : null}
            </Pressable>
          );
        })}
      </View>
      <Campo rotulo="Explique um pouco" ajuda="Opcional. Ex.: buscar receita na farmácia da praça" valor={descricao} aoMudar={setDescricao} multilinha />
      <Campo rotulo="Para quando?" ajuda="Opcional. Ex.: hoje à tarde, sábado de manhã" valor={quandoTxt} aoMudar={setQuando} />
      <Cartao>
        <Texto tamanho="pequeno">
          Sua unidade não aparece para todos: só o voluntário que aceitar o pedido (e a síndica) poderá vê-la. Evite escrever informações de saúde detalhadas.
        </Texto>
      </Cartao>
    </Tela>
  );
}
