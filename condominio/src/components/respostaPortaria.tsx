import { avisar, Botao, Cartao, Linha, Texto } from './ui';
import { quando } from '@/lib/formato';
import { responderPortaria } from '@/lib/portaria';
import { RegistroPortaria, TIPOS_PORTARIA } from '@/lib/tipos';

/** Cartão urgente: alguém chegou na portaria sem aviso e espera a autorização do morador. */
export function RespostaPortaria({ r, aoResponder }: { r: RegistroPortaria; aoResponder: () => void }) {
  async function responder(status: 'autorizado' | 'negado') {
    const erro = await responderPortaria(r.id, status);
    if (erro) return avisar('Não foi possível responder', erro);
    aoResponder();
  }
  return (
    <Cartao destaque="alerta">
      <Texto negrito>🔔 ALGUÉM NA PORTARIA PARA VOCÊ</Texto>
      <Texto tamanho="subtitulo" negrito>{r.nome}</Texto>
      <Texto>{TIPOS_PORTARIA[r.tipo]} · chegou {quando(r.criado_em)}{r.observacao ? ` · ${r.observacao}` : ''}</Texto>
      <Linha>
        <Botao titulo="Pode entrar" icone="checkmark" aoTocar={() => responder('autorizado')} style={{ flexGrow: 1 }} />
        <Botao titulo="Não autorizo" tipo="perigo" aoTocar={() => responder('negado')} style={{ flexGrow: 1 }} />
      </Linha>
    </Cartao>
  );
}
