import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, Marcar, Tela } from '@/components/ui';
import { lerValor } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';

export default function NovaArea() {
  const { condominioId } = useSessao();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [regras, setRegras] = useState('');
  const [capacidade, setCapacidade] = useState('');
  const [taxa, setTaxa] = useState('');
  const [aprovacao, setAprovacao] = useState(true);

  async function salvar() {
    if (nome.trim().length < 2) return avisar('Informe o nome do espaço');
    const { error } = await supabase.from('areas_comuns').insert({
      condominio_id: condominioId, nome: nome.trim(), descricao: descricao.trim() || null, regras: regras.trim() || null,
      capacidade: capacidade ? Number(capacidade) : null, taxa: taxa ? lerValor(taxa) || 0 : 0, exige_aprovacao: aprovacao,
    });
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    router.back();
  }

  return (
    <Tela rodape={<Botao titulo="Salvar espaço" icone="save-outline" aoTocar={salvar} />}>
      <Stack.Screen options={{ title: 'Novo espaço' }} />
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} placeholder="Ex.: Quiosque, Quadra" />
      <Campo rotulo="Descrição" valor={descricao} aoMudar={setDescricao} />
      <Campo rotulo="Regras de uso" valor={regras} aoMudar={setRegras} multilinha />
      <Campo rotulo="Capacidade (pessoas)" valor={capacidade} aoMudar={(t) => setCapacidade(t.replace(/\D/g, ''))} keyboardType="number-pad" />
      <Campo rotulo="Taxa de uso (R$)" ajuda="Deixe vazio se não houver" valor={taxa} aoMudar={setTaxa} keyboardType="decimal-pad" />
      <Marcar rotulo="Precisa da aprovação da gestão" valor={aprovacao} aoMudar={setAprovacao} />
    </Tela>
  );
}
