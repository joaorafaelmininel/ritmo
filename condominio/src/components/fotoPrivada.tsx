import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';

import { linkArquivo } from '@/lib/arquivos';
import { useTema } from '@/lib/tema';

/** Mostra uma foto do armazenamento privado (link temporário). Sem foto, mostra um emoji. */
export function FotoPrivada({ caminho, emoji = '🐾', tamanho = 96, style, rotulo }: { caminho: string | null; emoji?: string; tamanho?: number; style?: StyleProp<ViewStyle>; rotulo?: string }) {
  const { c } = useTema();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    if (caminho) linkArquivo(caminho).then((u) => { if (ativo) setUrl(u); }).catch(() => {});
    return () => { ativo = false; };
  }, [caminho]);
  return (
    <View style={[{ width: tamanho, height: tamanho, borderRadius: 16, backgroundColor: c.fundo, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.borda }, style]}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel={rotulo} />
      ) : (
        <Text style={{ fontSize: tamanho * 0.45 }}>{emoji}</Text>
      )}
    </View>
  );
}
