import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, CampoData, Marcar, Opcoes, Tela } from '@/components/ui';
import { lerValor } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { Dimensao, DIMENSOES } from '@/lib/tipos';

export default function NovoProjeto() {
  const { condominioId } = useSessao();
  const [dimensao, setDimensao] = useState<Dimensao | null>(null);
  const [tipo, setTipo] = useState<'projeto' | 'processo'>('projeto');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [prazo, setPrazo] = useState<string | null>(null);
  const [orcamento, setOrcamento] = useState('');
  const [publico, setPublico] = useState(true);

  async function salvar() {
    if (!dimensao) return avisar('Escolha a dimensão');
    if (titulo.trim().length < 3) return avisar('Escreva o título');
    const { error } = await supabase.from('projetos').insert({
      condominio_id: condominioId, dimensao, tipo, titulo: titulo.trim(), descricao: descricao.trim() || null,
      responsavel: responsavel.trim() || null, prazo, orcamento: orcamento ? lerValor(orcamento) || null : null, publico, ordem: 100,
    });
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    router.back();
  }

  return (
    <Tela rodape={<Botao titulo="Salvar no plano" icone="save-outline" aoTocar={salvar} />}>
      <Stack.Screen options={{ title: 'Novo item do plano' }} />
      <Opcoes rotulo="Dimensão" valor={dimensao} aoMudar={setDimensao} opcoes={(Object.keys(DIMENSOES) as Dimensao[]).map((d) => ({ valor: d, nome: DIMENSOES[d].nome }))} />
      <Opcoes
        rotulo="Tipo"
        valor={tipo}
        aoMudar={setTipo}
        opcoes={[{ valor: 'projeto', nome: 'Projeto (tem fim)' }, { valor: 'processo', nome: 'Processo (rotina contínua)' }]}
      />
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} />
      <Campo rotulo="Descrição / objetivo" valor={descricao} aoMudar={setDescricao} multilinha />
      <Campo rotulo="Responsável" ajuda="Opcional" valor={responsavel} aoMudar={setResponsavel} />
      {tipo === 'projeto' ? <CampoData rotulo="Prazo" valor={prazo} aoMudar={setPrazo} atalhos={false} /> : null}
      {tipo === 'projeto' ? <Campo rotulo="Orçamento previsto (R$)" ajuda="Opcional" valor={orcamento} aoMudar={setOrcamento} keyboardType="decimal-pad" /> : null}
      <Marcar rotulo="Visível para todos os moradores" valor={publico} aoMudar={setPublico} />
    </Tela>
  );
}
