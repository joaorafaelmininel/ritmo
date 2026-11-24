import { router } from 'expo-router';
import { View } from 'react-native';

import { ItemLista } from '@/components/lista';
import { Botao, Carregando, Cartao, Erro, Linha, Progresso, Subtitulo, Tela, Texto } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataLocal, isoData, moeda, nomeMes } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { useTema } from '@/lib/tema';
import { ContaBancaria, DOCS_FINANCEIROS, Saldo } from '@/lib/tipos';

type Mov = { tipo: 'receita' | 'despesa'; valor: number; data: string };

// Painel de transparência: a saúde financeira do condomínio em uma tela,
// e todos os documentos organizados por classificação logo abaixo.
export default function Financas() {
  const { c } = useTema();
  const { condominioId, eGestor } = useSessao();
  const hoje = new Date();
  const ano = hoje.getFullYear();

  const { dados, erro, carregando, recarregar } = useConsulta(async () => {
    const inicio12 = isoData(new Date(ano, hoje.getMonth() - 11, 1));
    const [contas, saldos, movs, inad, orc] = await Promise.all([
      supabase.from('contas_bancarias').select('*').eq('condominio_id', condominioId).eq('ativa', true).order('ordem').returns<ContaBancaria[]>(),
      supabase.from('saldos').select('*').eq('condominio_id', condominioId).order('competencia', { ascending: false }).limit(60).returns<Saldo[]>(),
      supabase.from('lancamentos').select('tipo, valor, data').eq('condominio_id', condominioId).gte('data', inicio12).returns<Mov[]>(),
      supabase.rpc('resumo_inadimplencia', { p_condominio: condominioId }),
      supabase.from('orcamento').select('valor_previsto').eq('condominio_id', condominioId).eq('ano', ano).eq('tipo', 'despesa'),
    ]);
    return {
      data: {
        contas: contas.data ?? [],
        saldos: saldos.data ?? [],
        movs: movs.data ?? [],
        inad: (inad.data as { unidades_total: number; unidades_em_atraso: number; valor_em_atraso: number }[] | null)?.[0] ?? null,
        previstoAno: (orc.data ?? []).reduce((s, o) => s + Number(o.valor_previsto), 0),
      },
      error: contas.error ?? movs.error,
    };
  }, [condominioId]);

  if (erro && !dados) return <Tela><Erro texto={erro} aoTentar={recarregar} /></Tela>;
  if (!dados) return <Carregando />;

  // Saldo mais recente de cada conta
  const ultimos = dados.contas.map((ct) => ({ conta: ct, saldo: dados.saldos.find((s) => s.conta_id === ct.id) }));
  const comSaldo = ultimos.filter((u) => u.saldo);
  const saldoTotal = comSaldo.reduce((s, u) => s + Number(u.saldo!.saldo_final), 0);
  const posicao = comSaldo.length ? comSaldo.map((u) => u.saldo!.competencia).sort().reverse()[0] : null;

  const doAno = dados.movs.filter((m) => m.data.startsWith(String(ano)));
  const soma = (l: Mov[], t: Mov['tipo']) => l.filter((m) => m.tipo === t).reduce((s, m) => s + Number(m.valor), 0);
  const receitasAno = soma(doAno, 'receita');
  const despesasAno = soma(doAno, 'despesa');

  const meses = Array.from({ length: 6 }, (_, i) => new Date(ano, hoje.getMonth() - i, 1)).map((d) => {
    const chave = isoData(d).slice(0, 7);
    const l = dados.movs.filter((m) => m.data.startsWith(chave));
    return { d, chave, resultado: soma(l, 'receita') - soma(l, 'despesa'), vazio: l.length === 0 };
  });

  const pctInad = dados.inad?.unidades_total ? Math.round((dados.inad.unidades_em_atraso / dados.inad.unidades_total) * 100) : 0;
  const pctOrc = dados.previstoAno ? Math.round((despesasAno / dados.previstoAno) * 100) : null;
  const esperadoAteAgora = Math.round(((hoje.getMonth() + 1) / 12) * 100);

  return (
    <Tela aoAtualizar={recarregar} atualizando={carregando}>
      <Texto suave>Tudo o que entra e sai do condomínio, aberto a todos os moradores.</Texto>

      {eGestor ? (
        <Cartao destaque="primaria">
          <Texto negrito>Gestão</Texto>
          <Botao icone="add-circle-outline" titulo="Lançar receita ou despesa" aoTocar={() => router.push('/financas/lancamento')} />
          <Linha>
            <Botao tipo="secundario" titulo="Saldo e extrato" aoTocar={() => router.push('/financas/extratos')} style={{ flexGrow: 1 }} />
            <Botao tipo="secundario" titulo="Enviar documento" aoTocar={() => router.push('/financas/documentos?cat=balancete')} style={{ flexGrow: 1 }} />
          </Linha>
        </Cartao>
      ) : null}

      <Subtitulo>Saúde financeira</Subtitulo>
      <Cartao>
        <Texto negrito>Dinheiro em caixa</Texto>
        {comSaldo.length ? (
          <>
            <Texto tamanho="grande" negrito cor={saldoTotal >= 0 ? c.sucesso : c.perigo}>{moeda(saldoTotal)}</Texto>
            {comSaldo.map((u) => (
              <Linha key={u.conta.id} style={{ justifyContent: 'space-between' }}>
                <Texto>{u.conta.nome}</Texto>
                <Texto negrito>{moeda(u.saldo!.saldo_final)}</Texto>
              </Linha>
            ))}
            {posicao ? <Texto tamanho="pequeno" suave>Saldos de fim de {nomeMes(dataLocal(posicao).getMonth())}/{dataLocal(posicao).getFullYear()}, conforme extratos.</Texto> : null}
          </>
        ) : (
          <Texto suave>A gestão ainda não registrou os saldos das contas.</Texto>
        )}
      </Cartao>

      <Cartao>
        <Texto negrito>Em {ano} até agora</Texto>
        <Linha style={{ justifyContent: 'space-between' }}><Texto>Entrou</Texto><Texto negrito cor={c.sucesso}>{moeda(receitasAno)}</Texto></Linha>
        <Linha style={{ justifyContent: 'space-between' }}><Texto>Saiu</Texto><Texto negrito cor={c.perigo}>{moeda(despesasAno)}</Texto></Linha>
        <View style={{ height: 1, backgroundColor: c.borda }} />
        <Linha style={{ justifyContent: 'space-between' }}>
          <Texto negrito>{receitasAno - despesasAno >= 0 ? 'Sobrou' : 'Faltou'}</Texto>
          <Texto tamanho="subtitulo" negrito cor={receitasAno - despesasAno >= 0 ? c.sucesso : c.perigo}>{moeda(Math.abs(receitasAno - despesasAno))}</Texto>
        </Linha>
      </Cartao>

      {pctOrc !== null ? (
        <Cartao destaque={pctOrc > esperadoAteAgora + 10 ? 'alerta' : undefined}>
          <Texto negrito>Orçamento do ano: {pctOrc}% já gasto</Texto>
          <Progresso valor={pctOrc} cor={pctOrc > 100 ? c.perigo : c.primaria} />
          <Texto tamanho="pequeno" suave>
            Até {nomeMes(hoje.getMonth())}, o esperado seria cerca de {esperadoAteAgora}%. Previsto para o ano: {moeda(dados.previstoAno)}.
          </Texto>
        </Cartao>
      ) : null}

      {dados.inad ? (
        <Cartao destaque={pctInad >= 10 ? 'alerta' : undefined}>
          <Texto negrito>Inadimplência: {pctInad}% das unidades</Texto>
          <Texto>{dados.inad.unidades_em_atraso} de {dados.inad.unidades_total} unidades com taxa atrasada, somando {moeda(dados.inad.valor_em_atraso)}.</Texto>
          <Texto tamanho="pequeno" suave>Por respeito à privacidade, não mostramos quais unidades.</Texto>
        </Cartao>
      ) : null}

      <Cartao>
        <Texto negrito>Resultado mês a mês</Texto>
        {meses.map((m) => (
          <Linha key={m.chave} style={{ justifyContent: 'space-between', minHeight: 44 }}>
            <Texto style={{ textTransform: 'capitalize' }}>{nomeMes(m.d.getMonth())}</Texto>
            {m.vazio ? <Texto suave>sem lançamentos</Texto> : (
              <Texto negrito cor={m.resultado >= 0 ? c.sucesso : c.perigo}>{m.resultado >= 0 ? '+' : '−'} {moeda(Math.abs(m.resultado))}</Texto>
            )}
          </Linha>
        ))}
      </Cartao>

      <Subtitulo>Movimentação</Subtitulo>
      <ItemLista item={{ titulo: 'Receitas e despesas do mês', detalhe: 'Cada lançamento, mês a mês', icone: 'swap-vertical-outline', rota: '/financas/mes' }} />
      <ItemLista item={{ titulo: 'Despesas por categoria', detalhe: 'Água, energia, portaria, manutenção…', icone: 'pie-chart-outline', rota: '/financas/categorias?tipo=despesa' }} />
      <ItemLista item={{ titulo: 'Receitas por categoria', detalhe: 'Taxas, multas, aluguel de espaços…', icone: 'trending-up-outline', rota: '/financas/categorias?tipo=receita' }} />
      <ItemLista item={{ titulo: 'Notas fiscais e comprovantes', detalhe: 'O documento de cada pagamento', icone: 'receipt-outline', rota: '/financas/notas' }} />

      <Subtitulo>Contas e planejamento</Subtitulo>
      <ItemLista item={{ titulo: 'Extratos e saldos bancários', detalhe: 'Conta corrente, fundo de reserva', icone: 'business-outline', rota: '/financas/extratos' }} />
      <ItemLista item={{ titulo: 'Orçamento: previsto × realizado', detalhe: 'Quanto foi planejado e quanto foi gasto', icone: 'calculator-outline', rota: '/financas/orcamento' }} />

      <Subtitulo>Documentos oficiais</Subtitulo>
      {Object.entries(DOCS_FINANCEIROS).map(([cat, d]) => (
        <ItemLista key={cat} item={{ titulo: d.nome, detalhe: d.explicacao, icone: d.icone as never, rota: `/financas/documentos?cat=${cat}` }} />
      ))}

      <Subtitulo>Minha unidade</Subtitulo>
      <ItemLista item={{ titulo: 'Meus boletos', detalhe: 'Taxa do condomínio e Pix', icone: 'wallet-outline', rota: '/cobrancas' }} />
      <ItemLista item={{ titulo: 'Projetos financeiros do plano de gestão', icone: 'map-outline', rota: '/plano?dimensao=financeira' }} />
    </Tela>
  );
}
