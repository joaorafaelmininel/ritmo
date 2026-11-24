import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, CampoData, Carregando, Cartao, Linha, Opcoes, Selo, Tela, Texto, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataLocal, dataPorExtenso, horaDe } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';

export type Assembleia = {
  id: string; titulo: string; tipo: 'ordinaria' | 'extraordinaria'; data: string; local: string | null; link_online: string | null;
  status: 'convocada' | 'realizada' | 'cancelada'; edital_path: string | null; ata_path: string | null;
};

export default function Assembleias() {
  const { condominioId, eGestor } = useSessao();
  const [nova, setNova] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'ordinaria' | 'extraordinaria'>('ordinaria');
  const [data, setData] = useState<string | null>(null);
  const [hora, setHora] = useState('19:30');
  const [local, setLocal] = useState('Salão de festas');
  const [link, setLink] = useState('');

  const { dados, recarregar } = useConsulta(
    () => supabase.from('assembleias').select('*').eq('condominio_id', condominioId).order('data', { ascending: false }).returns<Assembleia[]>(),
    [condominioId],
  );

  async function criar() {
    if (titulo.trim().length < 3 || !data) return avisar('Preencha título e data');
    const m = hora.match(/^(\d{1,2})[:h]?(\d{2})?$/);
    if (!m) return avisar('Horário inválido');
    const d = dataLocal(data); d.setHours(Number(m[1]), Number(m[2] ?? 0));
    const { data: a, error } = await supabase.from('assembleias').insert({
      condominio_id: condominioId, titulo: titulo.trim(), tipo, data: d.toISOString(), local: local.trim() || null, link_online: link.trim() || null,
    }).select('id').single();
    if (error) return avisar('Não foi possível criar', mensagemErro(error));
    router.push(`/assembleias/${a.id}`);
  }

  if (!dados) return <Carregando />;
  return (
    <Tela aoAtualizar={recarregar}>
      <Stack.Screen options={{ title: 'Assembleias' }} />
      <Texto suave>Pauta, documentos de cada item e espaço para tirar dúvidas antes da votação. Depois, a ata fica aqui.</Texto>
      {dados.length === 0 ? <Vazio icone="people-circle-outline" texto="Nenhuma assembleia cadastrada." /> : null}
      {dados.map((a) => (
        <Cartao key={a.id} aoTocar={() => router.push(`/assembleias/${a.id}`)} destaque={a.status === 'convocada' && new Date(a.data) > new Date() ? 'primaria' : undefined} rotulo={a.titulo}>
          <Linha>
            <Selo texto={a.tipo === 'ordinaria' ? 'Ordinária' : 'Extraordinária'} />
            <Selo texto={a.status === 'convocada' ? (new Date(a.data) > new Date() ? 'Convocada' : 'Aguardando ata') : a.status === 'realizada' ? 'Realizada' : 'Cancelada'} tipo={a.status === 'realizada' ? 'sucesso' : a.status === 'cancelada' ? 'perigo' : 'alerta'} />
          </Linha>
          <Texto tamanho="subtitulo" negrito>{a.titulo}</Texto>
          <Texto>{dataPorExtenso(a.data)} · {horaDe(a.data)}{a.link_online ? ' · presencial e on-line' : ''}</Texto>
        </Cartao>
      ))}
      {eGestor && !nova ? <Botao icone="add-circle-outline" titulo="Cadastrar assembleia" aoTocar={() => setNova(true)} /> : null}
      {nova ? (
        <Cartao>
          <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} placeholder="Ex.: Assembleia geral ordinária 2026" />
          <Opcoes valor={tipo} aoMudar={setTipo} opcoes={[{ valor: 'ordinaria', nome: 'Ordinária' }, { valor: 'extraordinaria', nome: 'Extraordinária' }]} />
          <CampoData rotulo="Data" valor={data} aoMudar={setData} atalhos={false} />
          <Campo rotulo="Horário" valor={hora} aoMudar={setHora} keyboardType="numbers-and-punctuation" />
          <Campo rotulo="Local" valor={local} aoMudar={setLocal} />
          <Campo rotulo="Link para participar on-line" ajuda="Opcional (Meet, Zoom…). Participação on-line depende do que a convenção permite." valor={link} aoMudar={setLink} autoCapitalize="none" keyboardType="url" />
          <Botao titulo="Criar e montar a pauta" aoTocar={criar} />
          <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setNova(false)} />
        </Cartao>
      ) : null}
    </Tela>
  );
}
