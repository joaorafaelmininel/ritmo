import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { SeletorPeriodo } from '@/components/lista';
import { avisar, Botao, Campo, Carregando, Cartao, Linha, Marcar, Opcoes, Selo, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataLocal, isoData, lerValor, moeda, nomeMes } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, espaco, useTema } from '@/lib/tema';
import { Acao, CATEGORIAS_ACAO, Execucao, Manutencao } from '@/lib/tipos';

type ProjetoPrazo = { id: string; titulo: string; prazo: string; status: string };
type Linha_ =
  | { tipo: 'acao'; acao: Acao; exec?: Execucao }
  | { tipo: 'manutencao'; m: Manutencao; data: Date; feita: boolean }
  | { tipo: 'projeto'; p: ProjetoPrazo };

const somarMeses = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());

/** Datas previstas de uma manutenção dentro do ano, a partir da próxima data e da periodicidade. */
function datasNoAno(m: Manutencao, ano: number): Date[] {
  if (!m.proxima) return [];
  const p = m.periodicidade_meses;
  let d = dataLocal(m.proxima);
  for (let i = 0; i < 200 && d.getFullYear() >= ano; i++) d = somarMeses(d, -p);
  const out: Date[] = [];
  for (let i = 0; i < 200 && d.getFullYear() <= ano; i++) {
    if (d.getFullYear() === ano) out.push(d);
    d = somarMeses(d, p);
  }
  return out;
}

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Calendário anual: o que o condomínio planejou fazer em cada mês do ano.
export default function Calendario() {
  const { c } = useTema();
  const { condominioId, eGestor } = useSessao();
  const confirmar = useConfirmar();
  const hoje = new Date();
  const [data, setData] = useState(new Date(hoje.getFullYear(), 0, 1));
  const ano = data.getFullYear();
  const [aberta, setAberta] = useState<string | null>(null);
  const [nova, setNova] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('manutencao');
  const [mes, setMes] = useState(String(hoje.getMonth() + 1));
  const [anual, setAnual] = useState(true);
  const [custo, setCusto] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [descricao, setDescricao] = useState('');

  const { dados, recarregar } = useConsulta(async () => {
    const [a, e, m, p] = await Promise.all([
      supabase.from('acoes_planejadas').select('*').eq('condominio_id', condominioId).or(`repete_anualmente.eq.true,ano.eq.${ano}`).order('mes').returns<Acao[]>(),
      supabase.from('acoes_execucoes').select('*').eq('ano', ano).returns<Execucao[]>(),
      supabase.from('manutencoes').select('*').eq('condominio_id', condominioId).returns<Manutencao[]>(),
      supabase.from('projetos').select('id, titulo, prazo, status').eq('condominio_id', condominioId).gte('prazo', `${ano}-01-01`).lte('prazo', `${ano}-12-31`).returns<ProjetoPrazo[]>(),
    ]);
    return { data: { acoes: a.data ?? [], execs: e.data ?? [], manut: m.data ?? [], projetos: p.data ?? [] }, error: a.error };
  }, [condominioId, ano]);

  async function registrar(acao: Acao, status: Execucao['status']) {
    const { error } = await supabase.from('acoes_execucoes').upsert({ acao_id: acao.id, ano, status, data: status === 'concluida' ? isoData(new Date()) : null }, { onConflict: 'acao_id,ano' });
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    setAberta(null);
    recarregar();
  }

  async function criar() {
    if (titulo.trim().length < 3) return avisar('Escreva o que será feito');
    const { error } = await supabase.from('acoes_planejadas').insert({
      condominio_id: condominioId, titulo: titulo.trim(), descricao: descricao.trim() || null, categoria, mes: Number(mes),
      repete_anualmente: anual, ano: anual ? null : ano, custo_estimado: custo ? lerValor(custo) || null : null, responsavel: responsavel.trim() || null,
    });
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    setNova(false); setTitulo(''); setCusto(''); setResponsavel(''); setDescricao('');
    recarregar();
  }

  if (!dados) return <Carregando />;

  const porMes: Linha_[][] = Array.from({ length: 12 }, () => []);
  for (const a of dados.acoes) porMes[a.mes - 1].push({ tipo: 'acao', acao: a, exec: dados.execs.find((x) => x.acao_id === a.id) });
  for (const m of dados.manut) {
    for (const d of datasNoAno(m, ano)) {
      const feita = !!m.ultima_realizacao && dataLocal(m.ultima_realizacao).getFullYear() === ano && dataLocal(m.ultima_realizacao).getMonth() === d.getMonth();
      porMes[d.getMonth()].push({ tipo: 'manutencao', m, data: d, feita });
    }
  }
  for (const p of dados.projetos) if (p.prazo) porMes[dataLocal(p.prazo).getMonth()].push({ tipo: 'projeto', p });

  const custoAno = dados.acoes.reduce((s, a) => s + Number(a.custo_estimado ?? 0), 0);
  const total = dados.acoes.length;
  const concluidas = dados.execs.filter((e) => e.status === 'concluida').length;
  const mesAtual = ano === hoje.getFullYear() ? hoje.getMonth() : -1;

  return (
    <Tela aoAtualizar={recarregar}>
      <Stack.Screen options={{ title: 'Calendário do ano' }} />
      <Texto suave>Tudo o que está planejado para o condomínio, mês a mês: ações da gestão, manutenções preventivas e prazos de projetos.</Texto>
      <SeletorPeriodo data={data} aoMudar={setData} modo="ano" anosFuturos={1} />

      <Cartao>
        <Linha style={{ justifyContent: 'space-between' }}><Texto>Ações planejadas</Texto><Texto negrito>{total}</Texto></Linha>
        <Linha style={{ justifyContent: 'space-between' }}><Texto>Concluídas</Texto><Texto negrito cor={c.sucesso}>{concluidas}</Texto></Linha>
        {custoAno ? <Linha style={{ justifyContent: 'space-between' }}><Texto>Custo estimado</Texto><Texto negrito>{moeda(custoAno)}</Texto></Linha> : null}
      </Cartao>

      {eGestor && total === 0 ? (
        <Botao tipo="secundario" titulo="Usar sugestões (poda, calhas, seguro…)" aoTocar={async () => {
          const { error } = await supabase.rpc('aplicar_acoes_padrao', { p_condominio: condominioId });
          if (error) avisar('Erro', mensagemErro(error)); else recarregar();
        }} />
      ) : null}
      {eGestor && !nova ? <Botao icone="add-circle-outline" titulo="Planejar nova ação" aoTocar={() => setNova(true)} /> : null}
      {nova ? (
        <Cartao>
          <Campo rotulo="O que será feito?" valor={titulo} aoMudar={setTitulo} placeholder="Ex.: Poda das árvores da entrada" />
          <Opcoes rotulo="Tipo" valor={categoria} aoMudar={setCategoria} opcoes={Object.entries(CATEGORIAS_ACAO).map(([valor, x]) => ({ valor, nome: x.nome }))} />
          <Opcoes rotulo="Mês" valor={mes} aoMudar={setMes} opcoes={MESES_CURTOS.map((n, i) => ({ valor: String(i + 1), nome: n }))} />
          <Marcar rotulo="Repetir todo ano" ajuda={`Desmarcado, vale só para ${ano}.`} valor={anual} aoMudar={setAnual} />
          <Campo rotulo="Custo estimado (R$)" ajuda="Opcional" valor={custo} aoMudar={setCusto} keyboardType="decimal-pad" />
          <Campo rotulo="Responsável / empresa" ajuda="Opcional" valor={responsavel} aoMudar={setResponsavel} />
          <Campo rotulo="Detalhes" ajuda="Opcional" valor={descricao} aoMudar={setDescricao} multilinha />
          <Botao titulo="Salvar no calendário" aoTocar={criar} />
          <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setNova(false)} />
        </Cartao>
      ) : null}

      {porMes.map((itens, i) => (
        <Cartao key={i} destaque={i === mesAtual ? 'primaria' : undefined}>
          <Linha style={{ justifyContent: 'space-between' }}>
            <Texto tamanho="subtitulo" negrito style={{ textTransform: 'capitalize' }}>{nomeMes(i)}</Texto>
            {i === mesAtual ? <Selo texto="Este mês" tipo="primaria" /> : null}
          </Linha>
          {itens.length === 0 ? <Texto suave>Nada planejado.</Texto> : null}
          {itens.map((it, k) => {
            if (it.tipo === 'acao') {
              const a = it.acao;
              const st = it.exec?.status;
              const atrasada = !st && (ano < hoje.getFullYear() || (ano === hoje.getFullYear() && i < hoje.getMonth()));
              const cat = CATEGORIAS_ACAO[a.categoria] ?? CATEGORIAS_ACAO.outro;
              const chave = `${a.id}`;
              return (
                <View key={`a${a.id}`} style={{ borderTopWidth: 1, borderColor: c.borda, paddingTop: espaco.s, gap: 4 }}>
                  <Pressable onPress={() => setAberta(aberta === chave ? null : chave)} accessibilityRole="button"
                    accessibilityLabel={`${a.titulo}. ${st === 'concluida' ? 'Concluída' : atrasada ? 'Atrasada' : 'Planejada'}`}
                    style={{ flexDirection: 'row', gap: espaco.s, alignItems: 'center', minHeight: ALVO_TOQUE }}>
                    <Ionicons name={st === 'concluida' ? 'checkmark-circle' : (cat.icone as never)} size={28} color={st === 'concluida' ? c.sucesso : atrasada ? c.alerta : c.primaria} />
                    <View style={{ flex: 1 }}>
                      <Texto negrito>{a.titulo}</Texto>
                      <Texto tamanho="pequeno" suave>
                        {cat.nome}{a.custo_estimado ? ` · ${moeda(a.custo_estimado)}` : ''}{a.responsavel ? ` · ${a.responsavel}` : ''}
                      </Texto>
                    </View>
                    {st === 'concluida' ? <Selo texto="Feito" tipo="sucesso" /> : st === 'adiada' ? <Selo texto="Adiado" tipo="alerta" /> : st === 'cancelada' ? <Selo texto="Cancelado" /> : atrasada ? <Selo texto="Pendente" tipo="alerta" /> : null}
                  </Pressable>
                  {aberta === chave ? (
                    <View style={{ gap: espaco.s }}>
                      {a.descricao ? <Texto>{a.descricao}</Texto> : null}
                      <Texto tamanho="pequeno" suave>{a.repete_anualmente ? 'Repete todo ano' : `Somente em ${ano}`}</Texto>
                      {eGestor ? (
                        <>
                          <Botao icone="checkmark" titulo={`Marcar como feito em ${ano}`} aoTocar={() => registrar(a, 'concluida')} />
                          <Linha>
                            <Botao tipo="secundario" titulo="Adiar" aoTocar={() => registrar(a, 'adiada')} style={{ flexGrow: 1 }} />
                            <Botao tipo="secundario" titulo="Agendado" aoTocar={() => registrar(a, 'agendada')} style={{ flexGrow: 1 }} />
                          </Linha>
                          <Botao tipo="texto" titulo="Excluir do calendário" aoTocar={() => confirmar('Excluir ação?', a.titulo, async () => {
                            await supabase.from('acoes_planejadas').delete().eq('id', a.id);
                            recarregar();
                          }, 'Sim, excluir')} />
                        </>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            }
            if (it.tipo === 'manutencao') {
              return (
                <Pressable key={`m${it.m.id}${k}`} onPress={() => router.push('/manutencoes')} accessibilityRole="button"
                  style={{ flexDirection: 'row', gap: espaco.s, alignItems: 'center', minHeight: ALVO_TOQUE, borderTopWidth: 1, borderColor: c.borda, paddingTop: espaco.s }}>
                  <Ionicons name={it.feita ? 'checkmark-circle' : 'construct-outline'} size={28} color={it.feita ? c.sucesso : c.textoSuave} />
                  <View style={{ flex: 1 }}>
                    <Texto>{it.m.item}</Texto>
                    <Texto tamanho="pequeno" suave>Manutenção preventiva · a cada {it.m.periodicidade_meses} meses{it.m.obrigacao_legal ? ' · obrigatória' : ''}</Texto>
                  </View>
                  {it.feita ? <Selo texto="Feito" tipo="sucesso" /> : null}
                </Pressable>
              );
            }
            return (
              <Pressable key={`p${it.p.id}`} onPress={() => router.push(`/plano/${it.p.id}`)} accessibilityRole="button"
                style={{ flexDirection: 'row', gap: espaco.s, alignItems: 'center', minHeight: ALVO_TOQUE, borderTopWidth: 1, borderColor: c.borda, paddingTop: espaco.s }}>
                <Ionicons name="flag-outline" size={28} color={c.textoSuave} />
                <View style={{ flex: 1 }}>
                  <Texto>{it.p.titulo}</Texto>
                  <Texto tamanho="pequeno" suave>Prazo de projeto do plano de gestão</Texto>
                </View>
              </Pressable>
            );
          })}
        </Cartao>
      ))}
    </Tela>
  );
}
