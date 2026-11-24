import { Stack, useLocalSearchParams } from 'expo-router';

import { BotaoOuvir, Cartao, Subtitulo, Tela, Texto } from '@/components/ui';
import { DATA_VIGENCIA, POLITICA_PRIVACIDADE, TERMOS_DE_USO, VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '@/legal/textos';

export default function DocumentoLegal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const privacidade = doc === 'privacidade';
  const secoes = privacidade ? POLITICA_PRIVACIDADE : TERMOS_DE_USO;
  const titulo = privacidade ? 'Política de Privacidade' : 'Termos de Uso';
  return (
    <Tela>
      <Stack.Screen options={{ title: titulo }} />
      <Texto suave>Versão {privacidade ? VERSAO_PRIVACIDADE : VERSAO_TERMOS} · vigente desde {DATA_VIGENCIA}</Texto>
      <BotaoOuvir texto={secoes.map((s) => `${s.titulo}. ${s.texto}`).join(' ')} />
      {secoes.map((s) => (
        <Cartao key={s.titulo}>
          <Subtitulo>{s.titulo}</Subtitulo>
          <Texto>{s.texto}</Texto>
        </Cartao>
      ))}
    </Tela>
  );
}
