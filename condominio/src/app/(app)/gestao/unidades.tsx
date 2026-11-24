import * as Print from 'expo-print';
import { Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, Carregando, Cartao, Linha, Selo, Subtitulo, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { codigoUnidade, formatoUnidade, nomeUnidade } from '@/lib/formato';
import { APP_NOME } from '@/lib/marca';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';

type UnidadeCodigo = { id: string; bloco: string; numero: string; codigo_acesso: string; moradores: number };

// Ex.: "101-104, 201-204", "A: 1-36", "A-101" ou, em quadra/lote: "Q1: 1-8", "Q8L1"
function expandir(texto: string, quadra: boolean): string[] {
  const itens: string[] = [];
  for (const bruto of texto.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean)) {
    const parte = quadra ? bruto.replace(/^quadra\s*/i, 'Q') : bruto;
    const ql = parte.match(/^Q\s*(\d+)\s*L\s*(\d+)$/i);
    if (ql) { itens.push(`${ql[1]}-${ql[2]}`); continue; }
    const faixa = parte.match(/^(?:([A-Za-z0-9]+)\s*[:/]\s*)?(\d+)\s*(?:a|até|-)\s*(\d+)$/i);
    if (faixa && Number(faixa[3]) >= Number(faixa[2]) && Number(faixa[3]) - Number(faixa[2]) <= 500) {
      const grupo = faixa[1] ? (quadra ? faixa[1].replace(/^Q/i, '') : faixa[1].toUpperCase()) : '';
      for (let n = Number(faixa[2]); n <= Number(faixa[3]); n++) itens.push(grupo ? `${grupo}-${n}` : String(n));
    } else {
      itens.push(parte.toUpperCase());
    }
  }
  return itens;
}

const escapar = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

export default function Unidades() {
  const { condominioId, membro } = useSessao();
  const confirmar = useConfirmar();
  const [lista, setLista] = useState('');
  const { dados, recarregar } = useConsulta(
    async () => {
      const r = await supabase.rpc('unidades_com_codigo', { p_condominio: condominioId });
      return { data: (r.data ?? []) as UnidadeCodigo[], error: r.error };
    },
    [condominioId],
  );

  const quadra = formatoUnidade() === 'quadra_lote';
  const previa = expandir(lista, quadra);

  async function criar() {
    const { data, error } = await supabase.rpc('criar_unidades', { p_condominio: condominioId, p_lista: previa });
    if (error) return avisar('Não foi possível cadastrar', mensagemErro(error));
    avisar('Unidades cadastradas', `${data} nova(s) unidade(s).`);
    setLista('');
    recarregar();
  }

  // Gera um PDF com um cartão recortável por unidade, para entregar em mãos.
  async function imprimir() {
    if (!dados?.length) return;
    const cartoes = dados.map((u) => `
      <div class="c">
        <div class="t">${escapar(membro?.condominios.nome ?? '')}</div>
        <div class="u">${escapar(nomeUnidade(u))}</div><div>(${escapar(codigoUnidade(u))})</div>
        <div>Seu código de acesso ao app ${APP_NOME}:</div>
        <div class="k">${u.codigo_acesso}</div>
        <div class="p">1. Instale o app ${APP_NOME} (App Store ou Google Play).<br/>2. Entre com seu e-mail.<br/>3. Digite este código. Guarde este papel.</div>
      </div>`).join('');
    const html = `<html><head><meta charset="utf-8"/><style>
      body{font-family:Helvetica,Arial,sans-serif;margin:16px}
      .g{display:flex;flex-wrap:wrap;gap:10px}
      .c{width:46%;border:2px dashed #555;border-radius:10px;padding:12px;page-break-inside:avoid;font-size:14px}
      .t{font-size:12px;color:#444}.u{font-size:22px;font-weight:bold;margin:4px 0}
      .k{font-size:30px;font-weight:bold;letter-spacing:4px;margin:8px 0;font-family:monospace}
      .p{font-size:12px;color:#333}
    </style></head><body><div class="g">${cartoes}</div></body></html>`;
    try { await Print.printAsync({ html }); } catch (e) { avisar('Não foi possível imprimir', mensagemErro(e)); }
  }

  if (!dados) return <Carregando />;
  return (
    <Tela>
      <Stack.Screen options={{ title: 'Unidades' }} />
      <Texto suave>
        Cada unidade tem um código de 8 letras. Imprima os cartões e entregue em mãos: quem digitar o código entra como morador daquela unidade.
      </Texto>
      {dados.length ? <Botao icone="print-outline" titulo={`Imprimir cartões (${dados.length})`} aoTocar={imprimir} /> : null}

      <Subtitulo>Cadastrar unidades</Subtitulo>
      <Campo
        rotulo={quadra ? 'Quadras e lotes' : 'Números das unidades'}
        ajuda={quadra
          ? 'Uma quadra por linha, com a faixa de lotes. Ex.: "Q1: 1-8", "Q2: 1-10". Lote avulso: "Q8L1".'
          : 'Separe por vírgula. Use faixas: "101-108, 201-208". Com bloco: "A: 1-36, B: 1-36" ou "A-101".'}
        valor={lista}
        aoMudar={setLista}
        multilinha
        autoCapitalize="characters"
      />
      {previa.length ? <Texto>Serão cadastradas {previa.length}: {previa.slice(0, 12).map((x) => (quadra && x.includes('-') ? `Q${x.split('-')[0]}L${x.split('-')[1]}` : x)).join(', ')}{previa.length > 12 ? '…' : ''}</Texto> : null}
      <Botao tipo="secundario" icone="add" titulo="Cadastrar" aoTocar={criar} desativado={!previa.length} />

      <Subtitulo>{dados.length} unidades</Subtitulo>
      {dados.map((u) => (
        <Cartao key={u.id}>
          <Linha style={{ justifyContent: 'space-between' }}>
            <Texto tamanho="subtitulo" negrito>{nomeUnidade(u)}</Texto>
            <Selo texto={u.moradores ? `${u.moradores} no app` : 'Ninguém ainda'} tipo={u.moradores ? 'sucesso' : 'neutro'} />
          </Linha>
          <Texto>Código: <Texto negrito style={{ letterSpacing: 3 }}>{u.codigo_acesso}</Texto></Texto>
          <Botao tipo="texto" titulo="Gerar novo código" dica="Use se o código vazou ou a unidade foi vendida" aoTocar={() => confirmar('Gerar novo código?', 'O código antigo deixa de funcionar. Quem já entrou continua com acesso.', async () => {
            const { error } = await supabase.rpc('novo_codigo_unidade', { p_unidade: u.id });
            if (error) return avisar('Erro', mensagemErro(error));
            recarregar();
          })} />
        </Cartao>
      ))}
    </Tela>
  );
}
