import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { avisar, Botao, Campo, Carregando, Cartao, Marcar, Opcoes, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { DIAS_SEMANA, nomeDias } from '@/lib/equipe';
import { agendarLembretesColeta, cancelarLembretesColeta, lembreteColetaAtivo } from '@/lib/lembretes';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { espaco, useTema } from '@/lib/tema';
import { Coleta, TIPOS_COLETA } from '@/lib/tipos';

export default function ColetaTela() {
  const { c } = useTema();
  const { condominioId, eGestor } = useSessao();
  const confirmar = useConfirmar();
  const [lembrete, setLembrete] = useState(false);
  const [nova, setNova] = useState(false);
  const [tipo, setTipo] = useState('comum');
  const [dias, setDias] = useState<number[]>([]);
  const [horario, setHorario] = useState('');
  const [local, setLocal] = useState('');
  const [orientacao, setOrientacao] = useState('');

  useEffect(() => { lembreteColetaAtivo().then(setLembrete); }, []);

  const { dados, recarregar } = useConsulta(
    () => supabase.from('coletas').select('*').eq('condominio_id', condominioId).returns<Coleta[]>(),
    [condominioId],
  );

  async function alternarLembrete(v: boolean) {
    if (v) {
      const ok = await agendarLembretesColeta(dados ?? []);
      if (!ok) return avisar('Não foi possível', 'Permita as notificações do app nas configurações do celular.');
      setLembrete(true);
    } else {
      await cancelarLembretesColeta();
      setLembrete(false);
    }
  }

  async function salvar() {
    if (!dias.length) return avisar('Escolha os dias da coleta');
    const { error } = await supabase.from('coletas').insert({ condominio_id: condominioId, tipo, dias, horario: horario.trim() || null, local: local.trim() || null, orientacao: orientacao.trim() || null });
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    setNova(false); setDias([]); setHorario(''); setLocal(''); setOrientacao('');
    recarregar();
  }

  if (!dados) return <Carregando />;
  const hoje = new Date().getDay();
  const amanha = (hoje + 1) % 7;
  const deHoje = dados.filter((x) => x.dias.includes(hoje));
  const deAmanha = dados.filter((x) => x.dias.includes(amanha));

  return (
    <Tela>
      <Stack.Screen options={{ title: 'Coleta de lixo' }} />
      <Cartao destaque={deHoje.length ? 'primaria' : undefined}>
        <Texto negrito>Hoje</Texto>
        <Texto tamanho="subtitulo">{deHoje.length ? deHoje.map((x) => `${TIPOS_COLETA[x.tipo]?.emoji} ${TIPOS_COLETA[x.tipo]?.nome}`).join(' · ') : 'Não tem coleta'}</Texto>
        {deHoje.map((x) => x.horario ? <Texto key={x.id} tamanho="pequeno">{TIPOS_COLETA[x.tipo]?.nome}: {x.horario}</Texto> : null)}
      </Cartao>
      <Cartao>
        <Texto negrito>Amanhã</Texto>
        <Texto>{deAmanha.length ? deAmanha.map((x) => `${TIPOS_COLETA[x.tipo]?.emoji} ${TIPOS_COLETA[x.tipo]?.nome}`).join(' · ') : 'Não tem coleta'}</Texto>
      </Cartao>

      <Marcar rotulo="Me lembrar na véspera (18h)" ajuda="Lembrete no seu celular, nos dias anteriores à coleta." valor={lembrete} aoMudar={alternarLembrete} />

      {dados.map((x) => (
        <Cartao key={x.id}>
          <Texto tamanho="subtitulo" negrito>{TIPOS_COLETA[x.tipo]?.emoji} {TIPOS_COLETA[x.tipo]?.nome}</Texto>
          <Texto negrito>{nomeDias(x.dias)}</Texto>
          {x.horario ? <Texto>⏰ {x.horario}</Texto> : null}
          {x.local ? <Texto>📍 {x.local}</Texto> : null}
          {x.orientacao ? <Texto suave>{x.orientacao}</Texto> : null}
          {eGestor ? <Botao tipo="texto" titulo="Remover" aoTocar={() => confirmar('Remover coleta?', TIPOS_COLETA[x.tipo]?.nome ?? '', async () => { await supabase.from('coletas').delete().eq('id', x.id); recarregar(); })} /> : null}
        </Cartao>
      ))}
      {dados.length === 0 ? <Texto suave>A gestão ainda não cadastrou os dias de coleta.</Texto> : null}

      {eGestor && !nova ? <Botao tipo="secundario" icone="add" titulo="Cadastrar coleta" aoTocar={() => setNova(true)} /> : null}
      {nova ? (
        <Cartao>
          <Opcoes rotulo="Tipo" valor={tipo} aoMudar={setTipo} opcoes={Object.entries(TIPOS_COLETA).map(([v, t]) => ({ valor: v, nome: `${t.emoji} ${t.nome}` }))} />
          <Texto negrito>Dias</Texto>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
            {DIAS_SEMANA.map((d, i) => {
              const sel = dias.includes(i);
              return (
                <Pressable key={d} onPress={() => setDias((x) => (sel ? x.filter((y) => y !== i) : [...x, i]))} accessibilityRole="checkbox" accessibilityState={{ checked: sel }} accessibilityLabel={d}
                  style={{ minWidth: 56, minHeight: 50, borderRadius: 12, borderWidth: 2, borderColor: sel ? c.primaria : c.borda, backgroundColor: sel ? c.primaria : c.superficie, alignItems: 'center', justifyContent: 'center' }}>
                  <Texto negrito cor={sel ? c.sobrePrimaria : c.texto}>{d}</Texto>
                </Pressable>
              );
            })}
          </View>
          <Campo rotulo="Horário" ajuda="Ex.: colocar até as 19h" valor={horario} aoMudar={setHorario} />
          <Campo rotulo="Onde colocar" valor={local} aoMudar={setLocal} />
          <Campo rotulo="Orientação" ajuda="Opcional" valor={orientacao} aoMudar={setOrientacao} />
          <Botao titulo="Salvar" aoTocar={salvar} />
          <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setNova(false)} />
        </Cartao>
      ) : null}
    </Tela>
  );
}
