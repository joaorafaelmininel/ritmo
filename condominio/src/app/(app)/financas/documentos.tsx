import * as DocumentPicker from 'expo-document-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { SeletorPeriodo } from '@/components/lista';
import { avisar, Botao, Campo, Carregando, Cartao, Marcar, Selo, Subtitulo, Tela, Texto, useConfirmar, Vazio } from '@/components/ui';
import { abrirArquivo, enviarArquivo } from '@/lib/arquivos';
import { useConsulta } from '@/lib/consulta';
import { dataCurta, dataLocal, isoData, nomeMes } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { Documento, DOCS_FINANCEIROS } from '@/lib/tipos';

// Documentos financeiros de uma classificação (balancetes, pareceres, contratos…)
export default function DocumentosFinanceiros() {
  const { cat = 'balancete' } = useLocalSearchParams<{ cat?: string }>();
  const info = DOCS_FINANCEIROS[cat] ?? DOCS_FINANCEIROS.balancete;
  const mensal = cat === 'balancete';
  const { condominioId, eGestor } = useSessao();
  const confirmar = useConfirmar();
  const h = new Date();
  const [novo, setNovo] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [mes, setMes] = useState(new Date(h.getFullYear(), h.getMonth() - 1, 1));
  const [publico, setPublico] = useState(cat !== 'contrato');
  const [arquivo, setArquivo] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const { dados, recarregar } = useConsulta(
    () => supabase.from('documentos').select('*').eq('condominio_id', condominioId).eq('categoria', cat)
      .order('competencia', { ascending: false, nullsFirst: false }).order('criado_em', { ascending: false }).returns<Documento[]>(),
    [condominioId, cat],
  );

  async function enviar() {
    if (!arquivo) return avisar('Escolha o arquivo');
    const t = titulo.trim() || (mensal ? `Balancete de ${nomeMes(mes.getMonth())}/${mes.getFullYear()}` : '');
    if (t.length < 3) return avisar('Escreva o título');
    try {
      const caminho = await enviarArquivo(condominioId, publico ? 'documentos' : 'restrito', arquivo.uri, arquivo.mimeType ?? 'application/pdf');
      const { error } = await supabase.from('documentos').insert({
        condominio_id: condominioId, titulo: t, categoria: cat, arquivo_path: caminho, publico, competencia: mensal ? isoData(mes) : null,
      });
      if (error) throw error;
      setNovo(false); setTitulo(''); setArquivo(null);
      recarregar();
    } catch (e) {
      avisar('Não foi possível enviar', mensagemErro(e));
    }
  }

  if (!dados) return <Carregando />;
  const porAno = dados.reduce<Record<string, Documento[]>>((acc, d) => {
    const a = (d.competencia ?? d.criado_em).slice(0, 4);
    (acc[a] ??= []).push(d);
    return acc;
  }, {});

  return (
    <Tela>
      <Stack.Screen options={{ title: info.nome }} />
      <Texto suave>{info.explicacao}.</Texto>
      {eGestor && !novo ? <Botao icone="cloud-upload-outline" titulo="Enviar documento" aoTocar={() => setNovo(true)} /> : null}
      {novo ? (
        <Cartao>
          {mensal ? (<><Texto negrito>Mês de referência</Texto><SeletorPeriodo data={mes} aoMudar={setMes} /></>) : null}
          <Campo rotulo={mensal ? 'Título (opcional)' : 'Título'} valor={titulo} aoMudar={setTitulo} />
          <Marcar rotulo="Visível para todos os moradores" ajuda="Desmarque se o documento tiver dados pessoais (ex.: contrato com autônomo, com CPF). Só gestão e conselho verão." valor={publico} aoMudar={setPublico} />
          <Botao tipo="secundario" icone="document-attach-outline" titulo={arquivo ? `📎 ${arquivo.name}` : 'Escolher arquivo (PDF ou imagem)'} aoTocar={async () => {
            const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
            if (!r.canceled) setArquivo(r.assets[0]);
          }} />
          <Botao titulo="Enviar" aoTocar={enviar} />
          <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setNovo(false)} />
        </Cartao>
      ) : null}
      {dados.length === 0 ? <Vazio icone="folder-open-outline" texto="Nenhum documento publicado ainda." /> : null}
      {Object.keys(porAno).sort().reverse().map((ano) => [
        <Subtitulo key={ano}>{ano}</Subtitulo>,
        ...porAno[ano].map((d) => (
          <Cartao key={d.id} aoTocar={() => abrirArquivo(d.arquivo_path)} rotulo={`Abrir ${d.titulo}`}>
            {!d.publico ? <Selo texto="Restrito à gestão e conselho" tipo="alerta" /> : null}
            <Texto negrito>{d.titulo}</Texto>
            <Texto tamanho="pequeno" suave>
              {d.competencia ? `Referente a ${nomeMes(dataLocal(d.competencia).getMonth())}/${dataLocal(d.competencia).getFullYear()} · ` : ''}publicado em {dataCurta(d.criado_em)}
            </Texto>
            {eGestor ? (
              <Botao tipo="texto" titulo="Apagar" aoTocar={() => confirmar('Apagar documento?', d.titulo, async () => {
                await supabase.storage.from('arquivos').remove([d.arquivo_path]);
                await supabase.from('documentos').delete().eq('id', d.id);
                recarregar();
              }, 'Sim, apagar')} />
            ) : null}
          </Cartao>
        )),
      ])}
    </Tela>
  );
}
