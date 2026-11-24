import { Stack } from 'expo-router';

import { BotaoOuvir, Cartao, Marcar, Opcoes, Subtitulo, Tela, Texto } from '@/components/ui';
import { ESCALAS, usePreferencias } from '@/lib/preferencias';

export default function Acessibilidade() {
  const { escala, contraste, confirmarAcoes, definir } = usePreferencias();
  return (
    <Tela>
      <Stack.Screen options={{ title: 'Letra e leitura' }} />
      <Subtitulo>Tamanho da letra</Subtitulo>
      <Opcoes
        valor={String(escala)}
        aoMudar={(v) => definir({ escala: Number(v) })}
        opcoes={ESCALAS.map((e) => ({ valor: String(e.valor), nome: e.nome }))}
      />
      <Cartao>
        <Texto negrito>Exemplo de texto</Texto>
        <Texto>Amanhã, das 8h às 12h, haverá limpeza da caixa d&apos;água. Guarde água para esse período.</Texto>
      </Cartao>
      <Texto tamanho="pequeno" suave>O app também respeita o tamanho de letra escolhido nas configurações do celular.</Texto>

      <Subtitulo>Cores</Subtitulo>
      <Marcar rotulo="Alto contraste" ajuda="Texto preto puro e bordas mais grossas." valor={contraste} aoMudar={(v) => definir({ contraste: v })} />

      <Subtitulo>Segurança contra toques sem querer</Subtitulo>
      <Marcar
        rotulo="Perguntar antes de ações importantes"
        ajuda="Ex.: antes de cancelar uma reserva ou votar."
        valor={confirmarAcoes}
        aoMudar={(v) => definir({ confirmarAcoes: v })}
      />

      <Subtitulo>Ouvir textos</Subtitulo>
      <Texto>Avisos, enquetes e regras têm o botão “Ouvir em voz alta”. Experimente:</Texto>
      <BotaoOuvir texto="Olá! Este é um teste. O aplicativo pode ler os avisos do condomínio para você." />
      <Texto tamanho="pequeno" suave>Se não ouvir nada, aumente o volume de mídia do celular.</Texto>
    </Tela>
  );
}
