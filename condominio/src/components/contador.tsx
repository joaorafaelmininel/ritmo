import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';

import { espaco, useTema } from '@/lib/tema';
import { Texto } from './ui';

/** "− 2 +" com botões grandes — mais fácil que digitar números. */
export function Contador({ rotulo, valor, aoMudar, min = 0, max = 20 }: { rotulo: string; valor: number; aoMudar: (n: number) => void; min?: number; max?: number }) {
  const { c } = useTema();
  const botao = (icone: 'remove' | 'add', delta: number, desativado: boolean) => (
    <Pressable
      onPress={() => aoMudar(valor + delta)}
      disabled={desativado}
      accessibilityRole="button"
      accessibilityLabel={`${delta > 0 ? 'Aumentar' : 'Diminuir'} ${rotulo}`}
      style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: c.primaria, alignItems: 'center', justifyContent: 'center', opacity: desativado ? 0.3 : 1 }}>
      <Ionicons name={icone} size={30} color={c.primaria} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.m }} accessibilityLabel={`${rotulo}: ${valor}`}>
      <Texto negrito style={{ flex: 1 }}>{rotulo}</Texto>
      {botao('remove', -1, valor <= min)}
      <Texto tamanho="titulo" negrito style={{ minWidth: 36, textAlign: 'center' }}>{valor}</Texto>
      {botao('add', 1, valor >= max)}
    </View>
  );
}
