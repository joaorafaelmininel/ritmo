import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, Opcoes, Tela, Texto } from '@/components/ui';
import { lerValor } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';

const TIPOS: Record<string, string> = { oferta: 'Vendo', procura: 'Procuro', servico: 'Ofereço serviço', doacao: 'Doação' };

export default function NovoAnuncio() {
  const { condominioId } = useSessao();
  const [tipo, setTipo] = useState('oferta');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [preco, setPreco] = useState('');
  const [contato, setContato] = useState('');

  async function publicar() {
    if (titulo.trim().length < 3) return avisar('Escreva um título');
    const { error } = await supabase.from('classificados').insert({
      condominio_id: condominioId, tipo, titulo: titulo.trim(), descricao: descricao.trim() || null,
      preco: preco ? lerValor(preco) || null : null, contato: contato.trim() || null,
    });
    if (error) return avisar('Não foi possível publicar', mensagemErro(error));
    router.back();
  }

  return (
    <Tela rodape={<Botao titulo="Publicar anúncio" icone="send-outline" aoTocar={publicar} />}>
      <Stack.Screen options={{ title: 'Novo anúncio' }} />
      <Opcoes rotulo="Tipo" valor={tipo} aoMudar={setTipo} opcoes={Object.entries(TIPOS).map(([valor, nome]) => ({ valor, nome }))} />
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} placeholder="Ex.: Bicicleta aro 26" maxLength={80} />
      <Campo rotulo="Descrição" ajuda="Opcional" valor={descricao} aoMudar={setDescricao} multilinha />
      {tipo !== 'doacao' && tipo !== 'procura' ? <Campo rotulo="Preço (R$)" ajuda="Opcional" valor={preco} aoMudar={setPreco} keyboardType="decimal-pad" /> : null}
      <Campo rotulo="Contato" ajuda="Opcional. Se colocar telefone, os vizinhos poderão chamar no WhatsApp." valor={contato} aoMudar={setContato} keyboardType="phone-pad" />
      <Texto tamanho="pequeno" suave>Seu anúncio aparece com o seu nome para os moradores deste condomínio.</Texto>
    </Tela>
  );
}
