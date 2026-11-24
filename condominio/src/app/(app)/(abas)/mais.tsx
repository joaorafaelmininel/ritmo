import { router } from 'expo-router';

import { Botao, Cartao, Tela, Texto, useConfirmar } from '@/components/ui';
import { nomeUnidade } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { NOME_PAPEL } from '@/lib/tipos';

export default function Mais() {
  const { nome, membro, papel, eGestor, sair, sessao } = useSessao();
  const confirmar = useConfirmar();
  const ir = (r: string) => () => router.push(r as never);
  return (
    <Tela>
      <Cartao aoTocar={ir('/perfil')} rotulo="Meu perfil">
        <Texto tamanho="subtitulo" negrito>{nome || 'Meu perfil'}</Texto>
        <Texto suave>{sessao?.user.email}</Texto>
        <Texto suave>
          {papel ? NOME_PAPEL[papel] : ''}{membro?.unidades ? ` · ${nomeUnidade(membro.unidades)}` : ''}
        </Texto>
      </Cartao>
      {eGestor ? <Botao icone="briefcase-outline" titulo="Painel da gestão" aoTocar={ir('/gestao')} /> : null}
      <Botao tipo="secundario" icone="text-outline" titulo="Tamanho da letra e leitura" aoTocar={ir('/acessibilidade')} />
      <Botao tipo="secundario" icone="shield-checkmark-outline" titulo="Privacidade e meus dados" aoTocar={ir('/privacidade')} />
      <Botao tipo="secundario" icone="call-outline" titulo="Telefones úteis" aoTocar={ir('/contatos')} />
      <Botao tipo="secundario" icone="folder-open-outline" titulo="Documentos do condomínio" aoTocar={ir('/documentos')} />
      <Botao tipo="secundario" icone="information-circle-outline" titulo="Sobre o aplicativo" aoTocar={ir('/sobre')} />
      <Botao tipo="perigo" icone="log-out-outline" titulo="Sair do aplicativo" aoTocar={() => confirmar('Sair?', 'Para entrar de novo, você vai receber um novo código no e-mail.', sair, 'Sim, sair')} />
    </Tela>
  );
}
