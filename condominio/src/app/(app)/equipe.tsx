import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { avisar, Botao, Campo, Carregando, Cartao, Linha, Opcoes, Selo, Subtitulo, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { DIAS_SEMANA, emServico, hora, nomeDias } from '@/lib/equipe';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { espaco, useTema } from '@/lib/tema';
import { Equipe, FUNCOES_EQUIPE } from '@/lib/tipos';

const horaValida = (h: string) => /^([01]?\d|2[0-3])[:h]?([0-5]\d)?$/.test(h.trim());
const normalizar = (h: string) => {
  const m = h.trim().match(/^(\d{1,2})[:h]?(\d{2})?$/)!;
  return `${m[1].padStart(2, '0')}:${m[2] ?? '00'}`;
};

export default function EquipeTela() {
  const { c } = useTema();
  const { condominioId, eGestor } = useSessao();
  const confirmar = useConfirmar();
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState('');
  const [funcao, setFuncao] = useState('portaria');
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [ini, setIni] = useState('07:00');
  const [fim, setFim] = useState('19:00');
  const [ramal, setRamal] = useState('');

  const { dados, recarregar } = useConsulta(
    () => supabase.from('equipe').select('*').eq('condominio_id', condominioId).eq('ativo', true).order('funcao').order('hora_inicio').returns<Equipe[]>(),
    [condominioId],
  );

  async function salvar() {
    if (nome.trim().length < 2) return avisar('Escreva o nome');
    if (!dias.length) return avisar('Escolha os dias de trabalho');
    if (!horaValida(ini) || !horaValida(fim)) return avisar('Horário inválido', 'Use o formato 07:00 ou 19:00.');
    const { error } = await supabase.from('equipe').insert({
      condominio_id: condominioId, nome: nome.trim(), funcao, dias, hora_inicio: normalizar(ini), hora_fim: normalizar(fim), ramal: ramal.trim() || null,
    });
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    setNovo(false); setNome(''); setRamal('');
    recarregar();
  }

  if (!dados) return <Carregando />;
  const porFuncao = Object.keys(FUNCOES_EQUIPE).map((f) => ({ f, lista: dados.filter((e) => e.funcao === f) })).filter((g) => g.lista.length);

  return (
    <Tela>
      <Stack.Screen options={{ title: 'Equipe e horários' }} />
      {dados.length === 0 ? <Texto suave>A gestão ainda não cadastrou a equipe.</Texto> : null}
      {porFuncao.map((g) => (
        <View key={g.f} style={{ gap: espaco.s }}>
          <Subtitulo>{FUNCOES_EQUIPE[g.f]}</Subtitulo>
          {g.lista.map((e) => {
            const agora = emServico(e);
            return (
              <Cartao key={e.id} destaque={agora ? 'sucesso' : undefined}>
                <Linha style={{ justifyContent: 'space-between' }}>
                  <Texto tamanho="subtitulo" negrito>{e.nome}</Texto>
                  {agora ? <Selo texto="Em serviço agora" tipo="sucesso" /> : null}
                </Linha>
                <Texto>{nomeDias(e.dias)} · {hora(e.hora_inicio)} às {hora(e.hora_fim)}</Texto>
                {e.ramal ? <Botao tipo="texto" icone="call-outline" titulo={`Ligar: ${e.ramal}`} aoTocar={() => { Linking.openURL(`tel:${e.ramal!.replace(/[^\d+]/g, '')}`); }} /> : null}
                {eGestor ? (
                  <Botao tipo="texto" titulo="Remover da escala" aoTocar={() => confirmar('Remover?', e.nome, async () => {
                    await supabase.from('equipe').update({ ativo: false }).eq('id', e.id);
                    recarregar();
                  })} />
                ) : null}
              </Cartao>
            );
          })}
        </View>
      ))}

      {eGestor && !novo ? <Botao icone="person-add-outline" titulo="Adicionar à escala" aoTocar={() => setNovo(true)} /> : null}
      {novo ? (
        <Cartao>
          <Campo rotulo="Nome" ajuda="Basta o primeiro nome." valor={nome} aoMudar={setNome} autoCapitalize="words" />
          <Opcoes rotulo="Função" valor={funcao} aoMudar={setFuncao} opcoes={Object.entries(FUNCOES_EQUIPE).map(([valor, n]) => ({ valor, nome: n }))} />
          <Texto negrito>Dias de trabalho</Texto>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
            {DIAS_SEMANA.map((d, i) => {
              const sel = dias.includes(i);
              return (
                <Pressable key={d} onPress={() => setDias((x) => (sel ? x.filter((y) => y !== i) : [...x, i]))}
                  accessibilityRole="checkbox" accessibilityState={{ checked: sel }} accessibilityLabel={d}
                  style={{ minWidth: 56, minHeight: 50, borderRadius: 12, borderWidth: 2, borderColor: sel ? c.primaria : c.borda, backgroundColor: sel ? c.primaria : c.superficie, alignItems: 'center', justifyContent: 'center' }}>
                  <Texto negrito cor={sel ? c.sobrePrimaria : c.texto}>{d}</Texto>
                </Pressable>
              );
            })}
          </View>
          <Linha>
            <View style={{ flex: 1 }}><Campo rotulo="Entra às" valor={ini} aoMudar={setIni} keyboardType="numbers-and-punctuation" /></View>
            <View style={{ flex: 1 }}><Campo rotulo="Sai às" valor={fim} aoMudar={setFim} keyboardType="numbers-and-punctuation" /></View>
          </Linha>
          <Texto tamanho="pequeno" suave>Turno da noite: entra 19:00 e sai 07:00 — o app entende que vira o dia.</Texto>
          <Campo rotulo="Telefone ou ramal do posto" ajuda="Opcional. Use o telefone da portaria, não o celular pessoal do funcionário." valor={ramal} aoMudar={setRamal} keyboardType="phone-pad" />
          <Botao titulo="Salvar" aoTocar={salvar} />
          <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setNovo(false)} />
        </Cartao>
      ) : null}
    </Tela>
  );
}
