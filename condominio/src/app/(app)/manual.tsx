import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { avisar, BotaoOuvir, Botao, Campo, Carregando, Cartao, Opcoes, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { quando } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';

type Secao = { id: string; categoria: string; titulo: string; conteudo: string; ordem: number; atualizado_em: string };
const CATEGORIAS: Record<string, string> = {
  boas_vindas: 'Boas-vindas', regras: 'Regras', animais: 'Animais', obras: 'Obras', lixo: 'Lixo', areas_comuns: 'Áreas comuns',
  servicos: 'Serviços', seguranca: 'Segurança', emergencia: 'Emergência', outro: 'Outros',
};

// Manual do morador: regras e informações em linguagem simples, com leitura em voz alta.
export default function Manual() {
  const { categoria: filtroInicial } = useLocalSearchParams<{ categoria?: string }>();
  const { condominioId, eGestor } = useSessao();
  const confirmar = useConfirmar();
  const [filtro, setFiltro] = useState(filtroInicial ?? 'todos');
  const [editando, setEditando] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [categoria, setCategoria] = useState('regras');

  const { dados, recarregar } = useConsulta(
    () => supabase.from('manual_secoes').select('*').eq('condominio_id', condominioId).order('ordem').returns<Secao[]>(),
    [condominioId],
  );

  async function salvar() {
    if (titulo.trim().length < 3 || conteudo.trim().length < 3) return avisar('Preencha título e texto');
    const dadosSecao = { titulo: titulo.trim(), conteudo: conteudo.trim(), categoria, atualizado_em: new Date().toISOString() };
    const { error } = editando === 'nova'
      ? await supabase.from('manual_secoes').insert({ ...dadosSecao, condominio_id: condominioId, ordem: (dados?.length ?? 0) + 1 })
      : await supabase.from('manual_secoes').update(dadosSecao).eq('id', editando!);
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    setEditando(null);
    recarregar();
  }

  if (!dados) return <Carregando />;
  const usadas = [...new Set(dados.map((s) => s.categoria))];
  const lista = dados.filter((s) => filtro === 'todos' || s.categoria === filtro);
  const formulario = (
    <Cartao destaque="primaria">
      <Opcoes rotulo="Assunto" valor={categoria} aoMudar={setCategoria} opcoes={Object.entries(CATEGORIAS).map(([v, n]) => ({ valor: v, nome: n }))} />
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} />
      <Campo rotulo="Texto" ajuda="Frases curtas e diretas. Tire do texto os trechos entre colchetes depois de revisar." valor={conteudo} aoMudar={setConteudo} multilinha />
      <Botao titulo="Salvar" aoTocar={salvar} />
      <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setEditando(null)} />
    </Cartao>
  );

  return (
    <Tela>
      <Stack.Screen options={{ title: 'Manual do morador' }} />
      <Texto suave>Tudo o que é bom saber para viver bem aqui. Toque em “Ouvir” para escutar.</Texto>
      {eGestor && dados.length === 0 ? (
        <Botao titulo="Criar manual a partir do modelo" aoTocar={async () => {
          const { error } = await supabase.rpc('aplicar_manual_padrao', { p_condominio: condominioId });
          if (error) avisar('Erro', mensagemErro(error)); else recarregar();
        }} />
      ) : null}
      {usadas.length > 1 ? <Opcoes valor={filtro} aoMudar={setFiltro} opcoes={[{ valor: 'todos', nome: 'Tudo' }, ...usadas.map((v) => ({ valor: v, nome: CATEGORIAS[v] ?? v }))]} /> : null}
      {editando === 'nova' ? formulario : null}
      {lista.map((s) => (editando === s.id ? <Cartao key={s.id}>{formulario}</Cartao> : (
        <Cartao key={s.id} destaque={s.categoria === 'emergencia' ? 'perigo' : undefined}>
          <Texto tamanho="subtitulo" negrito>{s.titulo}</Texto>
          <Texto>{s.conteudo}</Texto>
          {s.conteudo.includes('[') && eGestor ? <Texto tamanho="pequeno" cor="#7A4300">⚠️ Este texto ainda tem trechos para revisar (entre colchetes).</Texto> : null}
          <BotaoOuvir texto={`${s.titulo}. ${s.conteudo.replace(/\[[^\]]*\]/g, '')}`} />
          <Texto tamanho="pequeno" suave>Atualizado {quando(s.atualizado_em)}</Texto>
          {eGestor ? (
            <>
              <Botao tipo="texto" titulo="Editar" aoTocar={() => { setEditando(s.id); setTitulo(s.titulo); setConteudo(s.conteudo); setCategoria(s.categoria); }} />
              <Botao tipo="texto" titulo="Apagar" aoTocar={() => confirmar('Apagar seção?', s.titulo, async () => { await supabase.from('manual_secoes').delete().eq('id', s.id); recarregar(); })} />
            </>
          ) : null}
        </Cartao>
      )))}
      {eGestor && editando === null ? <Botao tipo="secundario" icone="add" titulo="Nova seção" aoTocar={() => { setEditando('nova'); setTitulo(''); setConteudo(''); setCategoria('regras'); }} /> : null}
    </Tela>
  );
}
