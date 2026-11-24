import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';

import { Botao, Cartao, Tela, Texto } from '@/components/ui';
import { ANO_COPYRIGHT, APP_NOME, APP_SLOGAN, CONTATO_SUPORTE, TITULAR } from '@/lib/marca';

export default function Sobre() {
  return (
    <Tela>
      <Stack.Screen options={{ title: 'Sobre' }} />
      <Texto tamanho="grande" negrito>{APP_NOME}</Texto>
      <Texto suave>{APP_SLOGAN}</Texto>
      <Texto>Versão {Constants.expoConfig?.version ?? '1.0.0'}</Texto>
      <Cartao>
        <Texto>© {ANO_COPYRIGHT} {TITULAR}. Todos os direitos reservados.</Texto>
        <Texto tamanho="pequeno" suave>
          Programa de computador protegido pela Lei 9.609/1998. Marca e identidade visual protegidas pela Lei 9.279/1996.
          É proibida a reprodução, modificação ou distribuição sem autorização.
        </Texto>
      </Cartao>
      <Texto>Suporte: {CONTATO_SUPORTE}</Texto>
      <Botao tipo="secundario" titulo="Termos de Uso" aoTocar={() => router.push('/legal/termos')} />
      <Botao tipo="secundario" titulo="Política de Privacidade" aoTocar={() => router.push('/legal/privacidade')} />
      <Texto tamanho="pequeno" suave>
        Este app usa componentes de código aberto (React Native, Expo, Supabase e outros) sob licenças MIT/Apache 2.0.
        A lista completa está no arquivo TERCEIROS.md do projeto.
      </Texto>
    </Tela>
  );
}
