import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, CampoData, Marcar, Opcoes, Tela, Texto } from '@/components/ui';
import { dataLocal } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { Evento, TIPOS_EVENTO } from '@/lib/tipos';

export default function NovoEvento() {
  const { comissao, tipo: tipoInicial } = useLocalSearchParams<{ comissao?: string; tipo?: Evento['tipo'] }>();
  const { condominioId } = useSessao();
  const [tipo, setTipo] = useState<Evento['tipo']>(tipoInicial ?? (comissao ? 'reuniao' : 'festa'));
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState<string | null>(null);
  const [hora, setHora] = useState('19:00');
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [contribuicao, setContribuicao] = useState('');
  const [prato, setPrato] = useState(false);
  const [tarefas, setTarefas] = useState('');

  async function salvar() {
    if (titulo.trim().length < 3) return avisar('Dê um nome ao evento');
    if (!data) return avisar('Escolha a data');
    const m = hora.trim().match(/^(\d{1,2})[:h]?(\d{2})?$/);
    if (!m) return avisar('Horário inválido', 'Use o formato 19:00');
    const d = dataLocal(data);
    d.setHours(Number(m[1]), Number(m[2] ?? 0));
    const { data: ev, error } = await supabase.from('eventos').insert({
      condominio_id: condominioId, tipo, titulo: titulo.trim(), inicio: d.toISOString(), local: local.trim() || null,
      descricao: descricao.trim() || null, contribuicao: contribuicao.trim() || null, pede_prato: prato, comissao_id: comissao ?? null,
    }).select('id').single();
    if (error) return avisar('Não foi possível criar', mensagemErro(error));
    const lista = tarefas.split('\n').map((t) => t.trim()).filter(Boolean);
    if (lista.length) await supabase.from('eventos_tarefas').insert(lista.map((descricao) => ({ evento_id: ev.id, descricao })));
    router.replace(`/eventos/${ev.id}`);
  }

  return (
    <Tela rodape={<Botao titulo="Criar evento" icone="checkmark-circle-outline" aoTocar={salvar} />}>
      <Stack.Screen options={{ title: 'Organizar evento' }} />
      <Opcoes rotulo="Tipo" valor={tipo} aoMudar={setTipo} opcoes={Object.entries(TIPOS_EVENTO).map(([v, t]) => ({ valor: v as Evento['tipo'], nome: `${t.emoji} ${t.nome}` }))} />
      <Campo rotulo="Nome do evento" valor={titulo} aoMudar={setTitulo} placeholder="Ex.: Festa junina do Village" />
      <CampoData rotulo="Data" valor={data} aoMudar={setData} />
      <Campo rotulo="Horário" valor={hora} aoMudar={setHora} keyboardType="numbers-and-punctuation" />
      <Campo rotulo="Local" valor={local} aoMudar={setLocal} placeholder="Ex.: Área de lazer" />
      <Campo rotulo="Descrição" ajuda="Opcional" valor={descricao} aoMudar={setDescricao} multilinha />
      <Campo rotulo="Contribuição / rateio" ajuda="Opcional. Ex.: R$ 35 por adulto; crianças até 12 anos não pagam" valor={contribuicao} aoMudar={setContribuicao} />
      <Marcar rotulo="Cada família leva um prato" ajuda="Na confirmação, cada casa diz o que vai levar (evita 10 pães de queijo e nenhum refrigerante)." valor={prato} aoMudar={setPrato} />
      <Campo rotulo="Tarefas para voluntários" ajuda="Uma por linha. Ex.: Bandeirinhas · Som · Mesas e cadeiras" valor={tarefas} aoMudar={setTarefas} multilinha />
      <Texto tamanho="pequeno" suave>Na confirmação pedimos só a quantidade de adultos e crianças, sem nomes ou idades das crianças.</Texto>
    </Tela>
  );
}
