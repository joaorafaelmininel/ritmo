import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { avisar, Botao, Campo, Carregando, Cartao, Linha, Opcoes, Progresso, Selo, Subtitulo, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataLocal, isoData, lerValor, nomeMes } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { espaco, useTema } from '@/lib/tema';
import { Dimensao, DIMENSOES, Indicadores, INDICADORES_AUTO, Meta } from '@/lib/tipos';

const fmt = (v: number | null | undefined, u: string) => (v === null || v === undefined ? '—' : `${String(Number(v).toFixed(1)).replace('.0', '').replace('.', ',')}${u === '%' ? '%' : ` ${u}`}`);

function avaliar(m: Meta, valor: number | null) {
  if (valor === null) return { nome: 'Sem dados', tipo: 'neutro' as const, pct: 0 };
  const ok = m.sentido === 'menor' ? valor <= m.valor_meta : valor >= m.valor_meta;
  const perto = m.sentido === 'menor' ? valor <= m.valor_meta * 1.5 : valor >= m.valor_meta * 0.75;
  const pct = m.sentido === 'menor' ? Math.min(100, (m.valor_meta / Math.max(valor, 0.0001)) * 100) : Math.min(100, (valor / m.valor_meta) * 100);
  return ok ? { nome: 'Meta atingida', tipo: 'sucesso' as const, pct: 100 } : perto ? { nome: 'No caminho', tipo: 'alerta' as const, pct } : { nome: 'Precisa de atenção', tipo: 'perigo' as const, pct };
}

// Metas do plano de gestão com números — e a evolução mês a mês.
export default function Metas() {
  const { c } = useTema();
  const { condominioId, eGestor } = useSessao();
  const confirmar = useConfirmar();
  const [nova, setNova] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [dimensao, setDimensao] = useState<Dimensao>('operacional');
  const [unidade, setUnidade] = useState('%');
  const [alvo, setAlvo] = useState('');
  const [sentido, setSentido] = useState<'menor' | 'maior'>('maior');
  const [indicador, setIndicador] = useState('manual');
  const [medindo, setMedindo] = useState<string | null>(null);
  const [valor, setValor] = useState('');

  const { dados, recarregar } = useConsulta(async () => {
    const [m, i] = await Promise.all([
      supabase.from('metas').select('*, metas_medicoes(competencia, valor)').eq('condominio_id', condominioId).eq('ativo', true).returns<Meta[]>(),
      supabase.rpc('indicadores', { p_condominio: condominioId }),
    ]);
    return { data: { metas: m.data ?? [], ind: (i.data ?? {}) as Indicadores }, error: m.error ?? i.error };
  }, [condominioId]);

  const competencia = isoData(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  // A gestão "fotografa" os indicadores automáticos do mês para formar o histórico.
  async function registrarMes() {
    const linhas = (dados?.metas ?? []).filter((m) => m.indicador && dados!.ind[m.indicador as keyof Indicadores] !== null)
      .map((m) => ({ meta_id: m.id, competencia, valor: Number(dados!.ind[m.indicador as keyof Indicadores]) }));
    if (!linhas.length) return avisar('Nada para registrar', 'Não há indicadores automáticos com valor neste mês.');
    const { error } = await supabase.from('metas_medicoes').upsert(linhas, { onConflict: 'meta_id,competencia' });
    if (error) return avisar('Não foi possível registrar', mensagemErro(error));
    avisar('Registrado!', `Valores de ${nomeMes(new Date().getMonth())} salvos no histórico.`);
    recarregar();
  }

  async function medir(id: string) {
    const v = lerValor(valor);
    if (!Number.isFinite(v)) return avisar('Digite o valor medido');
    const { error } = await supabase.from('metas_medicoes').upsert({ meta_id: id, competencia, valor: v }, { onConflict: 'meta_id,competencia' });
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    setMedindo(null); setValor('');
    recarregar();
  }

  async function criar() {
    const v = lerValor(alvo);
    if (titulo.trim().length < 3 || !Number.isFinite(v)) return avisar('Preencha o nome e o valor da meta');
    const { error } = await supabase.from('metas').insert({
      condominio_id: condominioId, titulo: titulo.trim(), dimensao, valor_meta: v, sentido,
      indicador: indicador === 'manual' ? null : indicador, unidade_medida: indicador === 'manual' ? unidade : INDICADORES_AUTO[indicador].unidade,
    });
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    setNova(false); setTitulo(''); setAlvo('');
    recarregar();
  }

  if (!dados) return <Carregando />;
  return (
    <Tela aoAtualizar={recarregar}>
      <Stack.Screen options={{ title: 'Metas e indicadores' }} />
      <Texto suave>Os compromissos da gestão em números, e como estão evoluindo.</Texto>

      <Cartao>
        <Texto negrito>Agora</Texto>
        {Object.entries(INDICADORES_AUTO).map(([k, info]) => (
          <Linha key={k} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <Texto style={{ flex: 1 }}>{info.nome.replace(/ \(.*\)/, '')}</Texto>
            <Texto negrito>{fmt(dados.ind[k as keyof Indicadores] as number | null, info.unidade)}</Texto>
          </Linha>
        ))}
        <Linha style={{ justifyContent: 'space-between' }}><Texto>Ocorrências abertas</Texto><Texto negrito>{dados.ind.ocorrencias_abertas ?? 0}</Texto></Linha>
        <Linha style={{ justifyContent: 'space-between' }}><Texto>Resolvidas nos últimos 90 dias</Texto><Texto negrito>{dados.ind.ocorrencias_resolvidas_90d ?? 0}</Texto></Linha>
      </Cartao>
      {eGestor ? <Botao tipo="secundario" icone="camera-outline" titulo={`Registrar valores de ${nomeMes(new Date().getMonth())} no histórico`} aoTocar={registrarMes} /> : null}

      <Subtitulo>Metas</Subtitulo>
      {dados.metas.length === 0 ? <Texto suave>Nenhuma meta cadastrada.</Texto> : null}
      {dados.metas.map((m) => {
        const historico = [...(m.metas_medicoes ?? [])].sort((a, b) => a.competencia.localeCompare(b.competencia)).slice(-6);
        const atual = m.indicador ? (dados.ind[m.indicador as keyof Indicadores] as number | null) : historico.at(-1)?.valor ?? null;
        const av = avaliar(m, atual === null ? null : Number(atual));
        const max = Math.max(m.valor_meta, ...historico.map((h) => Number(h.valor)), 1);
        const info = DIMENSOES[m.dimensao];
        return (
          <Cartao key={m.id} destaque={av.tipo === 'perigo' ? 'perigo' : undefined}>
            <Linha>
              <Ionicons name={info.icone as never} size={24} color={info.cor} />
              <Selo texto={info.nome} />
              <Selo texto={av.nome} tipo={av.tipo} />
            </Linha>
            <Texto tamanho="subtitulo" negrito>{m.titulo}</Texto>
            <Linha style={{ justifyContent: 'space-between' }}>
              <Texto>Hoje: <Texto negrito>{fmt(atual, m.unidade_medida)}</Texto></Texto>
              <Texto suave>Meta: {m.sentido === 'menor' ? 'até' : 'pelo menos'} {fmt(m.valor_meta, m.unidade_medida)}</Texto>
            </Linha>
            <Progresso valor={av.pct} cor={av.tipo === 'sucesso' ? c.sucesso : av.tipo === 'perigo' ? c.perigo : c.primaria} />
            {historico.length >= 2 ? (
              <View style={{ gap: 4, marginTop: espaco.xs }}>
                <Texto tamanho="pequeno" suave>Evolução</Texto>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 6 }} accessible
                  accessibilityLabel={`Evolução: ${historico.map((h) => `${nomeMes(dataLocal(h.competencia).getMonth())} ${fmt(h.valor, m.unidade_medida)}`).join(', ')}`}>
                  {historico.map((h) => (
                    <View key={h.competencia} style={{ flex: 1, alignItems: 'center' }}>
                      <View style={{ width: '70%', height: Math.max(3, (Number(h.valor) / max) * 50), backgroundColor: c.primaria, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {historico.map((h) => (
                    <Texto key={h.competencia} tamanho="pequeno" suave centro style={{ flex: 1, fontSize: 12 }}>{nomeMes(dataLocal(h.competencia).getMonth()).slice(0, 3)}</Texto>
                  ))}
                </View>
              </View>
            ) : null}
            {m.indicador ? <Texto tamanho="pequeno" suave>Calculado automaticamente pelo app.</Texto> : null}
            {eGestor && !m.indicador ? (
              medindo === m.id ? (
                <>
                  <Campo rotulo={`Valor de ${nomeMes(new Date().getMonth())} (${m.unidade_medida})`} valor={valor} aoMudar={setValor} keyboardType="decimal-pad" />
                  <Botao titulo="Salvar medição" aoTocar={() => medir(m.id)} />
                </>
              ) : <Botao tipo="secundario" titulo="Registrar valor do mês" aoTocar={() => { setMedindo(m.id); setValor(''); }} />
            ) : null}
            {eGestor ? <Botao tipo="texto" titulo="Remover meta" aoTocar={() => confirmar('Remover meta?', m.titulo, async () => { await supabase.from('metas').update({ ativo: false }).eq('id', m.id); recarregar(); })} /> : null}
          </Cartao>
        );
      })}

      {eGestor && !nova ? <Botao icone="add-circle-outline" titulo="Nova meta" aoTocar={() => setNova(true)} /> : null}
      {eGestor && dados.metas.length === 0 ? <Botao tipo="secundario" titulo="Usar metas sugeridas" aoTocar={async () => { await supabase.rpc('aplicar_melhorias_padrao', { p_condominio: condominioId }); recarregar(); }} /> : null}
      {nova ? (
        <Cartao>
          <Campo rotulo="Meta" valor={titulo} aoMudar={setTitulo} placeholder="Ex.: Reduzir a conta de água em 10%" />
          <Opcoes rotulo="Dimensão" valor={dimensao} aoMudar={setDimensao} opcoes={(Object.keys(DIMENSOES) as Dimensao[]).map((d) => ({ valor: d, nome: DIMENSOES[d].nome }))} />
          <Opcoes rotulo="Como medir" valor={indicador} aoMudar={setIndicador} opcoes={[{ valor: 'manual', nome: 'A gestão informa todo mês' }, ...Object.entries(INDICADORES_AUTO).map(([v, x]) => ({ valor: v, nome: `Automático: ${x.nome.replace(/ \(.*\)/, '')}` }))]} />
          {indicador === 'manual' ? <Opcoes rotulo="Medida em" valor={unidade} aoMudar={setUnidade} opcoes={['%', 'dias', 'R$', 'unidades', 'm³', 'kWh'].map((u) => ({ valor: u, nome: u }))} /> : null}
          <Campo rotulo="Valor da meta" valor={alvo} aoMudar={setAlvo} keyboardType="decimal-pad" />
          <Opcoes rotulo="O bom é ficar…" valor={sentido} aoMudar={setSentido} opcoes={[{ valor: 'maior', nome: 'Acima da meta' }, { valor: 'menor', nome: 'Abaixo da meta' }]} />
          <Botao titulo="Salvar meta" aoTocar={criar} />
          <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setNova(false)} />
        </Cartao>
      ) : null}
    </Tela>
  );
}
