import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, Carregando, Cartao, Marcar, Opcoes, Selo, Subtitulo, Tela, Texto, useConfirmar, Vazio } from '@/components/ui';
import { enviarArquivo, linkArquivo } from '@/lib/arquivos';
import { useConsulta } from '@/lib/consulta';
import { dataCurta } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { DOCS_GERAIS } from '@/lib/tipos';

type Documento = { id: string; titulo: string; categoria: string; arquivo_path: string; publico: boolean; criado_em: string };
const CATEGORIAS = DOCS_GERAIS;

export default function Documentos() {
  const { condominioId, eGestor } = useSessao();
  const confirmar = useConfirmar();
  const [novo, setNovo] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('ata');
  const [publico, setPublico] = useState(true);
  const [arquivo, setArquivo] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const { dados, recarregar } = useConsulta(
    () => supabase.from('documentos').select('*').eq('condominio_id', condominioId).in('categoria', Object.keys(DOCS_GERAIS)).order('criado_em', { ascending: false }).returns<Documento[]>(),
    [condominioId],
  );

  async function abrir(d: Documento) {
    try { await Linking.openURL(await linkArquivo(d.arquivo_path)); } catch (e) { avisar('Não foi possível abrir', mensagemErro(e)); }
  }

  async function enviar() {
    if (!arquivo || titulo.trim().length < 3) return avisar('Escolha o arquivo e escreva o título');
    try {
      const pasta = publico ? 'documentos' : 'restrito';
      const caminho = await enviarArquivo(condominioId, pasta, arquivo.uri, arquivo.mimeType ?? 'application/pdf');
      const { error } = await supabase.from('documentos').insert({ condominio_id: condominioId, titulo: titulo.trim(), categoria, arquivo_path: caminho, publico });
      if (error) throw error;
      setNovo(false); setTitulo(''); setArquivo(null);
      recarregar();
    } catch (e) {
      avisar('Não foi possível enviar', mensagemErro(e));
    }
  }

  if (!dados) return <Carregando />;
  return (
    <Tela>
      <Stack.Screen options={{ title: 'Documentos' }} />
      <Texto suave>Convenção, regimento e atas. Balancetes, contratos e demais documentos financeiros ficam em Finanças.</Texto>
      {eGestor && !novo ? <Botao icone="cloud-upload-outline" titulo="Enviar documento" aoTocar={() => setNovo(true)} /> : null}
      {novo ? (
        <Cartao>
          <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} placeholder="Ex.: Ata da assembleia de novembro" />
          <Opcoes rotulo="Tipo" valor={categoria} aoMudar={setCategoria} opcoes={Object.entries(CATEGORIAS).map(([valor, nome]) => ({ valor, nome }))} />
          <Marcar rotulo="Visível para todos os moradores" ajuda="Desmarque para contratos ou documentos com dados pessoais (só gestão e conselho verão)." valor={publico} aoMudar={setPublico} />
          <Botao tipo="secundario" icone="document-attach-outline" titulo={arquivo ? `📎 ${arquivo.name}` : 'Escolher arquivo (PDF ou imagem)'} aoTocar={async () => {
            const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
            if (!r.canceled) setArquivo(r.assets[0]);
          }} />
          <Botao titulo="Enviar" aoTocar={enviar} />
          <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setNovo(false)} />
        </Cartao>
      ) : null}
      {dados.length === 0 ? <Vazio icone="folder-open-outline" texto="Nenhum documento publicado." /> : null}
      {Object.entries(CATEGORIAS).map(([cat, nome]) => {
        const lista = dados.filter((d) => d.categoria === cat);
        if (!lista.length) return null;
        return [
          <Subtitulo key={cat}>{nome}</Subtitulo>,
          ...lista.map((d) => (
            <Cartao key={d.id} aoTocar={() => abrir(d)} rotulo={`Abrir ${d.titulo}`}>
              {!d.publico ? <Selo texto="Restrito à gestão e conselho" tipo="alerta" /> : null}
              <Texto negrito>{d.titulo}</Texto>
              <Texto tamanho="pequeno" suave>Publicado em {dataCurta(d.criado_em)}</Texto>
              {eGestor ? (
                <Botao tipo="texto" titulo="Apagar" aoTocar={() => confirmar('Apagar documento?', d.titulo, async () => {
                  await supabase.storage.from('arquivos').remove([d.arquivo_path]);
                  await supabase.from('documentos').delete().eq('id', d.id);
                  recarregar();
                }, 'Sim, apagar')} />
              ) : null}
            </Cartao>
          )),
        ];
      })}
    </Tela>
  );
}
