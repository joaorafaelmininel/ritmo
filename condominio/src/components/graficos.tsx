import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { moeda, nomeMes } from '@/lib/formato';
import { espaco, useTema } from '@/lib/tema';
import { Linha, Progresso, Texto } from './ui';

// Cores do gráfico validadas para daltonismo (azul × laranja; vermelho × verde falha para deuteranopia).
export const COR_ENTROU = '#1F6FB5';
export const COR_SAIU = '#D0741A';

export type Mes = { d: Date; entrou: number; saiu: number };

/** Barras lado a lado (entrou × saiu) dos últimos meses. Tocar num mês mostra os valores. */
export function BarrasMensais({ meses }: { meses: Mes[] }) {
  const { c } = useTema();
  const [sel, setSel] = useState(meses.length - 1);
  const max = Math.max(1, ...meses.map((m) => Math.max(m.entrou, m.saiu)));
  const ALTURA = 140;
  const atual = meses[sel];
  return (
    <View style={{ gap: espaco.s }}>
      <Linha>
        <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: COR_ENTROU }} /><Texto tamanho="pequeno">Entrou</Texto>
        <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: COR_SAIU, marginLeft: espaco.s }} /><Texto tamanho="pequeno">Saiu</Texto>
      </Linha>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: ALTURA + 26, borderBottomWidth: 1, borderColor: c.borda }}>
        {meses.map((m, i) => (
          <Pressable
            key={i}
            onPress={() => setSel(i)}
            accessibilityRole="button"
            accessibilityLabel={`${nomeMes(m.d.getMonth())}: entrou ${moeda(m.entrou)}, saiu ${moeda(m.saiu)}`}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', backgroundColor: i === sel ? c.primariaSuave : 'transparent', borderRadius: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: ALTURA }}>
              <View style={{ width: 7, height: Math.max(2, (m.entrou / max) * ALTURA), backgroundColor: COR_ENTROU, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
              <View style={{ width: 7, height: Math.max(2, (m.saiu / max) * ALTURA), backgroundColor: COR_SAIU, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
            </View>
            <Text allowFontScaling={false} style={{ fontSize: 11, color: c.textoSuave, marginTop: 4 }}>{nomeMes(m.d.getMonth()).slice(0, 3)}</Text>
          </Pressable>
        ))}
      </View>
      {atual ? (
        <View style={{ gap: 2 }}>
          <Texto negrito>{nomeMes(atual.d.getMonth()).replace(/^./, (l) => l.toUpperCase())} de {atual.d.getFullYear()}</Texto>
          <Linha style={{ justifyContent: 'space-between' }}><Texto>Entrou</Texto><Texto negrito>{moeda(atual.entrou)}</Texto></Linha>
          <Linha style={{ justifyContent: 'space-between' }}><Texto>Saiu</Texto><Texto negrito>{moeda(atual.saiu)}</Texto></Linha>
          <Linha style={{ justifyContent: 'space-between' }}>
            <Texto>{atual.entrou - atual.saiu >= 0 ? 'Sobrou' : 'Faltou'}</Texto>
            <Texto negrito cor={atual.entrou - atual.saiu >= 0 ? c.sucesso : c.perigo}>{moeda(Math.abs(atual.entrou - atual.saiu))}</Texto>
          </Linha>
          <Texto tamanho="pequeno" suave>Toque em outro mês para ver os valores.</Texto>
        </View>
      ) : null}
    </View>
  );
}

/** "De cada R$ 100 da taxa…" — barras horizontais de uma só cor, com o valor escrito. */
export function ParaOndeVai({ categorias }: { categorias: { nome: string; valor: number }[] }) {
  const { c } = useTema();
  const total = categorias.reduce((s, x) => s + x.valor, 0);
  if (!total) return <Texto suave>Ainda não há despesas suficientes para calcular.</Texto>;
  const ordenadas = [...categorias].sort((a, b) => b.valor - a.valor);
  const principais = ordenadas.slice(0, 6);
  const resto = ordenadas.slice(6).reduce((s, x) => s + x.valor, 0);
  const linhas = resto ? [...principais, { nome: 'Outras despesas', valor: resto }] : principais;
  return (
    <View style={{ gap: espaco.s }}>
      {linhas.map((x) => {
        const de100 = (x.valor / total) * 100;
        return (
          <View key={x.nome} style={{ gap: 2 }} accessible accessibilityLabel={`${x.nome}: ${moeda(de100)} de cada 100 reais`}>
            <Linha style={{ justifyContent: 'space-between' }}>
              <Texto style={{ flex: 1 }}>{x.nome}</Texto>
              <Texto negrito>{moeda(de100)}</Texto>
            </Linha>
            <Progresso valor={de100} cor={c.primaria} />
          </View>
        );
      })}
    </View>
  );
}
