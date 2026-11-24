import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';

import { avisar, BotaoOuvir, Botao, Campo, Carregando, Cartao, Linha, Selo, Subtitulo, Tela, Texto } from '@/components/ui';
import { abrirArquivo, enviarArquivo } from '@/lib/arquivos';
import { useConsulta } from '@/lib/consulta';
import { dataPorExtenso, horaDe, quando } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { espaco } from '@/lib/tema';
import type { Assembleia } from './index';

type Item = {
  id: string; ordem: number; titulo: string; descricao: string | null; documento_path: string | null; resultado: string | null;
  assembleia_perguntas: { id: string; texto: string; resposta: string | null; criado_em: string; perfis: { nome: string } | null }[];
};

async function escolherPdf() {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
  return r.canceled ? null : r.assets[0];
}

export default function VerAssembleia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { condominioId, membro, eGestor } = useSessao();
  const [pergunta, setPergunta] = useState<Record<string, string>>({});
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [resultados, setResultados] = useState<Record<string, string>>({});
  const [novoItem, setNovoItem] = useState('');
  const [novoDesc, setNovoDesc] = useState('');

  const { dados, recarregar } = useConsulta(async () => {
    const [a, p, pr, tot] = await Promise.all([
      supabase.from('assembleias').select('*').eq('id', id).single<Assembleia>(),
      supabase.from('assembleia_pauta').select('*, assembleia_perguntas(id, texto, resposta, criado_em, perfis(nome))').eq('assembleia_id', id).order('ordem').returns<Item[]>(),
      supabase.from('assembleia_presencas').select('unidade_id, modo').eq('assembleia_id', id),
      supabase.from('unidades').select('id', { count: 'exact', head: true }).eq('condominio_id', condominioId),
    ]);
    return { data: a.data ? { a: a.data, pauta: p.data ?? [], presencas: pr.data ?? [], unidades: tot.count ?? 0 } : null, error: a.error };
  }, [id]);

  if (!dados) return <Carregando />;
  const { a, pauta, presencas } = dados;
  const minha = presencas.find((p) => p.unidade_id === membro?.unidade_id);
  const futura = new Date(a.data) > new Date() && a.status === 'convocada';

  async function presenca(modo: 'presencial' | 'online' | null) {
    if (!membro?.unidade_id) return avisar('Sem unidade');
    const r = modo
      ? await supabase.from('assembleia_presencas').upsert({ assembleia_id: id, unidade_id: membro.unidade_id, modo }, { onConflict: 'assembleia_id,unidade_id' })
      : await supabase.from('assembleia_presencas').delete().eq('assembleia_id', id).eq('unidade_id', membro.unidade_id);
    if (r.error) return avisar('Não foi possível', mensagemErro(r.error));
    recarregar();
  }

  async function anexar(campo: 'edital_path' | 'ata_path') {
    const f = await escolherPdf();
    if (!f) return;
    try {
      const caminho = await enviarArquivo(condominioId, 'assembleias', f.uri, f.mimeType ?? 'application/pdf');
      const { error } = await supabase.from('assembleias').update({ [campo]: caminho, ...(campo === 'ata_path' ? { status: 'realizada' } : {}) }).eq('id', id);
      if (error) throw error;
      recarregar();
    } catch (e) { avisar('Não foi possível enviar', mensagemErro(e)); }
  }

  async function addItem() {
    if (novoItem.trim().length < 3) return;
    const f = await escolherPdf().catch(() => null);
    let caminho: string | null = null;
    try { if (f) caminho = await enviarArquivo(condominioId, 'assembleias', f.uri, f.mimeType ?? 'application/pdf'); } catch { /* segue sem anexo */ }
    const { error } = await supabase.from('assembleia_pauta').insert({ assembleia_id: id, ordem: pauta.length + 1, titulo: novoItem.trim(), descricao: novoDesc.trim() || null, documento_path: caminho });
    if (error) return avisar('Não foi possível', mensagemErro(error));
    setNovoItem(''); setNovoDesc('');
    recarregar();
  }

  function compartilhar() {
    const texto = `📢 *${a.titulo}*\n📅 ${dataPorExtenso(a.data)}, ${horaDe(a.data)}${a.local ? `\n📍 ${a.local}` : ''}${a.link_online ? '\n💻 Também on-line (link no app)' : ''}\n\n*Pauta:*\n${pauta.map((p) => `${p.ordem}. ${p.titulo}`).join('\n')}\n\nDocumentos de cada item e espaço para dúvidas no app Vizinhar → Desenvolvimento → Assembleias.`;
    Share.share({ message: texto });
  }

  return (
    <Tela aoAtualizar={recarregar}>
      <Stack.Screen options={{ title: 'Assembleia' }} />
      <Linha>
        <Selo texto={a.tipo === 'ordinaria' ? 'Ordinária' : 'Extraordinária'} />
        {a.status === 'realizada' ? <Selo texto="Realizada" tipo="sucesso" /> : a.status === 'cancelada' ? <Selo texto="Cancelada" tipo="perigo" /> : null}
      </Linha>
      <Texto tamanho="titulo" negrito>{a.titulo}</Texto>
      <Texto tamanho="subtitulo">{dataPorExtenso(a.data)} · {horaDe(a.data)}</Texto>
      {a.local ? <Texto>📍 {a.local}</Texto> : null}
      <BotaoOuvir texto={`${a.titulo}. ${dataPorExtenso(a.data)}, às ${horaDe(a.data)}. Pauta: ${pauta.map((p) => `${p.ordem}, ${p.titulo}`).join('. ')}`} />

      <Linha>
        {a.edital_path ? <Botao tipo="secundario" icone="document-text-outline" titulo="Edital de convocação" aoTocar={() => abrirArquivo(a.edital_path!)} style={{ flexGrow: 1 }} /> : null}
        {a.ata_path ? <Botao icone="document-text-outline" titulo="Ata" aoTocar={() => abrirArquivo(a.ata_path!)} style={{ flexGrow: 1 }} /> : null}
      </Linha>
      {a.link_online && futura ? <Botao icone="videocam-outline" titulo="Entrar na reunião on-line" aoTocar={() => { Linking.openURL(a.link_online!); }} /> : null}

      {futura ? (
        <Cartao destaque={minha ? 'sucesso' : 'primaria'}>
          <Texto negrito>{presencas.length} de {dados.unidades} unidades confirmaram presença</Texto>
          {minha ? (
            <>
              <Texto>✓ Sua unidade vai participar ({minha.modo === 'online' ? 'on-line' : 'presencialmente'}).</Texto>
              <Botao tipo="texto" titulo="Não vou mais" aoTocar={() => presenca(null)} />
            </>
          ) : (
            <Linha>
              <Botao titulo="Vou presencialmente" aoTocar={() => presenca('presencial')} style={{ flexGrow: 1 }} />
              {a.link_online ? <Botao tipo="secundario" titulo="Vou on-line" aoTocar={() => presenca('online')} style={{ flexGrow: 1 }} /> : null}
            </Linha>
          )}
        </Cartao>
      ) : null}

      <Subtitulo>Pauta</Subtitulo>
      {pauta.length === 0 ? <Texto suave>A pauta ainda não foi publicada.</Texto> : null}
      {pauta.map((p) => (
        <Cartao key={p.id}>
          <Texto tamanho="subtitulo" negrito>{p.ordem}. {p.titulo}</Texto>
          {p.descricao ? <Texto>{p.descricao}</Texto> : null}
          {p.documento_path ? <Botao tipo="secundario" icone="attach-outline" titulo="Ver documento deste item" aoTocar={() => abrirArquivo(p.documento_path!)} /> : null}
          {p.resultado ? <Cartao destaque="sucesso"><Texto negrito>Resultado</Texto><Texto>{p.resultado}</Texto></Cartao> : null}
          {p.assembleia_perguntas.length ? <Texto negrito>Dúvidas dos moradores</Texto> : null}
          {p.assembleia_perguntas.map((q) => (
            <View key={q.id} style={{ gap: 2, paddingLeft: espaco.s }}>
              <Texto>❓ {q.texto}</Texto>
              <Texto tamanho="pequeno" suave>{q.perfis?.nome ?? 'Morador(a)'} · {quando(q.criado_em)}</Texto>
              {q.resposta ? <Texto>💬 <Texto negrito>Gestão:</Texto> {q.resposta}</Texto> : <Texto tamanho="pequeno" suave>Aguardando resposta</Texto>}
              {eGestor && !q.resposta ? (
                <>
                  <Campo rotulo="Responder" valor={respostas[q.id] ?? ''} aoMudar={(t) => setRespostas((r) => ({ ...r, [q.id]: t }))} />
                  <Botao tipo="secundario" titulo="Enviar resposta" aoTocar={async () => {
                    await supabase.from('assembleia_perguntas').update({ resposta: respostas[q.id]?.trim() }).eq('id', q.id);
                    recarregar();
                  }} />
                </>
              ) : null}
            </View>
          ))}
          {a.status === 'convocada' ? (
            <>
              <Campo rotulo="Tenho uma dúvida sobre este item" ajuda="A pergunta e a resposta ficam visíveis para todos." valor={pergunta[p.id] ?? ''} aoMudar={(t) => setPergunta((x) => ({ ...x, [p.id]: t }))} />
              <Botao tipo="texto" titulo="Enviar dúvida" aoTocar={async () => {
                if ((pergunta[p.id] ?? '').trim().length < 5) return;
                const { error } = await supabase.from('assembleia_perguntas').insert({ pauta_id: p.id, texto: pergunta[p.id].trim() });
                if (error) return avisar('Erro', mensagemErro(error));
                setPergunta((x) => ({ ...x, [p.id]: '' }));
                recarregar();
              }} />
            </>
          ) : null}
          {eGestor && !futura && !p.resultado ? (
            <>
              <Campo rotulo="Resultado da votação" valor={resultados[p.id] ?? ''} aoMudar={(t) => setResultados((r) => ({ ...r, [p.id]: t }))} placeholder="Ex.: Aprovado por maioria (32 a 5)" />
              <Botao tipo="secundario" titulo="Registrar resultado" aoTocar={async () => { await supabase.from('assembleia_pauta').update({ resultado: resultados[p.id]?.trim() }).eq('id', p.id); recarregar(); }} />
            </>
          ) : null}
        </Cartao>
      ))}

      {eGestor ? (
        <Cartao destaque="primaria">
          <Texto negrito>Gestão</Texto>
          <Campo rotulo="Novo item da pauta" valor={novoItem} aoMudar={setNovoItem} placeholder="Ex.: Previsão orçamentária 2027" />
          <Campo rotulo="Explicação" ajuda="Opcional" valor={novoDesc} aoMudar={setNovoDesc} multilinha />
          <Botao tipo="secundario" icone="add" titulo="Adicionar item (com documento, se quiser)" desativado={novoItem.trim().length < 3} aoTocar={addItem} />
          <Botao tipo="secundario" icone="document-attach-outline" titulo={a.edital_path ? 'Trocar edital' : 'Anexar edital de convocação'} aoTocar={() => anexar('edital_path')} />
          <Botao tipo="secundario" icone="document-attach-outline" titulo={a.ata_path ? 'Trocar ata' : 'Anexar ata (marca como realizada)'} aoTocar={() => anexar('ata_path')} />
          <Botao tipo="secundario" icone="share-social-outline" titulo="Divulgar no WhatsApp" aoTocar={compartilhar} />
        </Cartao>
      ) : (
        <Botao tipo="secundario" icone="share-social-outline" titulo="Compartilhar" aoTocar={compartilhar} />
      )}
      <Texto tamanho="pequeno" suave>A votação oficial acontece na assembleia. Participação on-line vale conforme a convenção (Código Civil, art. 1.354-A).</Texto>
    </Tela>
  );
}
