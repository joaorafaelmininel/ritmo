import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, CampoData, Carregando, Cartao, Linha, Selo, Subtitulo, Tela, Texto, useConfirmar, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataCurta, dataLocal, isoData, lerValor, moeda, nomeMes, nomeUnidade } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { Cobranca } from '@/lib/tipos';

function situacao(cb: Cobranca) {
  if (cb.status === 'paga') return { nome: 'Paga', tipo: 'sucesso' as const };
  if (cb.status === 'acordo') return { nome: 'Em acordo', tipo: 'primaria' as const };
  if (cb.vencimento < isoData(new Date())) return { nome: 'Em atraso', tipo: 'perigo' as const };
  return { nome: 'A pagar', tipo: 'alerta' as const };
}

const competencia = (iso: string) => {
  const d = dataLocal(iso);
  return `${nomeMes(d.getMonth())}/${d.getFullYear()}`;
};

export default function Cobrancas() {
  const { condominioId, membro, eGestor } = useSessao();
  const confirmar = useConfirmar();
  const hoje = new Date();
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState<string | null>(isoData(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 10)));

  const { dados, carregando, recarregar } = useConsulta(async () => {
    const [minhas, todas] = await Promise.all([
      membro?.unidade_id
        ? supabase.from('cobrancas').select('*').eq('unidade_id', membro.unidade_id).order('competencia', { ascending: false }).limit(24).returns<Cobranca[]>()
        : Promise.resolve({ data: [] as Cobranca[] }),
      eGestor
        ? supabase.from('cobrancas').select('*, unidades(bloco, numero)').eq('condominio_id', condominioId).neq('status', 'paga').order('vencimento').returns<Cobranca[]>()
        : Promise.resolve({ data: [] as Cobranca[] }),
    ]);
    return { data: { minhas: minhas.data ?? [], abertas: todas.data ?? [] }, error: null };
  }, [condominioId]);

  async function gerarMes() {
    const v = lerValor(valor);
    if (!(v > 0) || !vencimento) return avisar('Preencha valor e vencimento');
    const venc = dataLocal(vencimento);
    const comp = isoData(new Date(venc.getFullYear(), venc.getMonth(), 1));
    const { data: unidades } = await supabase.from('unidades').select('id').eq('condominio_id', condominioId);
    const linhas = (unidades ?? []).map((u) => ({ condominio_id: condominioId, unidade_id: u.id, competencia: comp, valor: v, vencimento }));
    const { error } = await supabase.from('cobrancas').upsert(linhas, { onConflict: 'unidade_id,competencia', ignoreDuplicates: true });
    if (error) return avisar('Não foi possível gerar', mensagemErro(error));
    avisar('Cobranças geradas', `${linhas.length} unidades — ${competencia(comp)}.`);
    recarregar();
  }

  async function marcarPaga(cb: Cobranca) {
    const { error } = await supabase.from('cobrancas').update({ status: 'paga', pago_em: isoData(new Date()) }).eq('id', cb.id);
    if (error) return avisar('Não foi possível', mensagemErro(error));
    recarregar();
  }

  if (!dados) return <Carregando />;
  return (
    <Tela aoAtualizar={recarregar} atualizando={carregando}>
      <Stack.Screen options={{ title: eGestor ? 'Cobranças' : 'Meus boletos' }} />

      {membro?.unidade_id ? (
        <>
          <Subtitulo>Minha unidade</Subtitulo>
          {dados.minhas.length === 0 ? <Vazio icone="receipt-outline" texto="Nenhuma cobrança registrada no app." /> : null}
          {dados.minhas.map((cb) => {
            const s = situacao(cb);
            return (
              <Cartao key={cb.id} destaque={s.tipo === 'perigo' ? 'perigo' : undefined}>
                <Linha style={{ justifyContent: 'space-between' }}>
                  <Texto tamanho="subtitulo" negrito>{competencia(cb.competencia)}</Texto>
                  <Selo texto={s.nome} tipo={s.tipo} />
                </Linha>
                <Texto>{moeda(cb.valor)} · vence {dataCurta(cb.vencimento)}</Texto>
                {cb.pago_em ? <Texto suave>Pago em {dataCurta(cb.pago_em)}</Texto> : null}
                {cb.status !== 'paga' && cb.pix_copia_cola ? (
                  <Botao tipo="secundario" icone="copy-outline" titulo="Copiar código Pix" aoTocar={async () => {
                    await Clipboard.setStringAsync(cb.pix_copia_cola!);
                    avisar('Código copiado!', 'Abra o app do seu banco, escolha Pix → "Pix copia e cola" e cole o código.');
                  }} />
                ) : null}
                {cb.status !== 'paga' && cb.link_boleto ? (
                  <Botao tipo="secundario" icone="open-outline" titulo="Abrir boleto" aoTocar={() => { Linking.openURL(cb.link_boleto!); }} />
                ) : null}
              </Cartao>
            );
          })}
        </>
      ) : null}

      {eGestor ? (
        <>
          <Subtitulo>Gerar cobrança do mês (todas as unidades)</Subtitulo>
          <Cartao>
            <Campo rotulo="Valor da taxa (R$)" valor={valor} aoMudar={setValor} keyboardType="decimal-pad" />
            <CampoData rotulo="Vencimento" valor={vencimento} aoMudar={setVencimento} atalhos={false} />
            <Botao titulo="Gerar para todas as unidades" aoTocar={() => confirmar('Gerar cobranças?', 'Unidades que já têm cobrança neste mês não serão alteradas.', gerarMes, 'Sim, gerar')} />
            <Texto tamanho="pequeno" suave>
              Se o condomínio usa banco ou administradora para emitir boletos, eles podem ser integrados depois (ver documentação).
            </Texto>
          </Cartao>

          <Subtitulo>Em aberto ({dados.abertas.length})</Subtitulo>
          {dados.abertas.map((cb) => {
            const s = situacao(cb);
            return (
              <Cartao key={cb.id}>
                <Linha style={{ justifyContent: 'space-between' }}>
                  <Texto negrito>{nomeUnidade(cb.unidades)}</Texto>
                  <Selo texto={s.nome} tipo={s.tipo} />
                </Linha>
                <Texto>{competencia(cb.competencia)} · {moeda(cb.valor)} · vence {dataCurta(cb.vencimento)}</Texto>
                <Botao tipo="secundario" icone="checkmark" titulo="Marcar como paga" aoTocar={() => confirmar('Confirmar pagamento?', `${nomeUnidade(cb.unidades)} — ${moeda(cb.valor)}`, () => marcarPaga(cb))} />
              </Cartao>
            );
          })}
        </>
      ) : null}
    </Tela>
  );
}
