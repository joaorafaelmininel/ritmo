import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { nomeMes } from '@/lib/formato';
import { ALVO_TOQUE, espaco, useTema } from '@/lib/tema';
import { NomeIcone, Texto } from './ui';

export type Item = { titulo: string; detalhe?: string; icone: NomeIcone; rota: string; contador?: number; destaque?: boolean };

/** Item grande de lista: ícone, título e explicação; um toque abre. */
export function ItemLista({ item, cor }: { item: Item; cor?: string }) {
  const { c, borda } = useTema();
  const corIcone = cor ?? c.primaria;
  return (
    <Pressable
      onPress={() => router.push(item.rota as never)}
      accessibilityRole="button"
      accessibilityLabel={`${item.titulo}${item.detalhe ? `. ${item.detalhe}` : ''}${item.contador ? `. ${item.contador} pendente${item.contador > 1 ? 's' : ''}` : ''}`}
      style={({ pressed }) => ({
        minHeight: ALVO_TOQUE + 20, borderRadius: 16, padding: espaco.m, flexDirection: 'row', alignItems: 'center', gap: espaco.m,
        backgroundColor: item.destaque ? corIcone : c.superficie, borderWidth: item.destaque ? 0 : borda + 1, borderColor: c.borda, opacity: pressed ? 0.8 : 1,
      })}>
      <Ionicons name={item.icone} size={34} color={item.destaque ? '#fff' : corIcone} />
      <View style={{ flex: 1 }}>
        <Texto tamanho="subtitulo" negrito cor={item.destaque ? '#fff' : c.texto}>{item.titulo}</Texto>
        {item.detalhe ? <Texto tamanho="pequeno" cor={item.destaque ? '#fff' : c.textoSuave}>{item.detalhe}</Texto> : null}
      </View>
      {item.contador ? (
        <View style={{ minWidth: 32, height: 32, borderRadius: 16, backgroundColor: item.destaque ? '#fff' : c.perigo, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
          <Text style={{ color: item.destaque ? corIcone : '#fff', fontWeight: '800', fontSize: 17 }}>{item.contador}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={26} color={item.destaque ? '#fff' : c.textoSuave} />
    </Pressable>
  );
}

function Seta({ nome, rotulo, aoTocar, desativado }: { nome: 'chevron-back' | 'chevron-forward'; rotulo: string; aoTocar: () => void; desativado?: boolean }) {
  const { c } = useTema();
  return (
    <Pressable
      onPress={aoTocar}
      disabled={desativado}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: desativado }}
      style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: c.primaria, alignItems: 'center', justifyContent: 'center', opacity: desativado ? 0.3 : 1 }}>
      <Ionicons name={nome} size={30} color={c.primaria} />
    </Pressable>
  );
}

/** Escolha de mês (ou ano) com setas grandes. */
export function SeletorPeriodo({ data, aoMudar, modo = 'mes' }: { data: Date; aoMudar: (d: Date) => void; modo?: 'mes' | 'ano' }) {
  const hoje = new Date();
  const atual = modo === 'ano' ? data.getFullYear() >= hoje.getFullYear() : data.getFullYear() === hoje.getFullYear() && data.getMonth() >= hoje.getMonth();
  const mover = (d: number) => aoMudar(modo === 'ano' ? new Date(data.getFullYear() + d, 0, 1) : new Date(data.getFullYear(), data.getMonth() + d, 1));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s }}>
      <Seta nome="chevron-back" rotulo={modo === 'ano' ? 'Ano anterior' : 'Mês anterior'} aoTocar={() => mover(-1)} />
      <Texto tamanho="subtitulo" negrito centro style={{ flex: 1 }}>
        {modo === 'ano' ? String(data.getFullYear()) : `${nomeMes(data.getMonth())} de ${data.getFullYear()}`}
      </Texto>
      <Seta nome="chevron-forward" rotulo={modo === 'ano' ? 'Próximo ano' : 'Próximo mês'} aoTocar={() => mover(1)} desativado={atual} />
    </View>
  );
}
