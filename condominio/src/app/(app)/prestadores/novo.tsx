import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, Marcar, Opcoes, Tela, Texto } from '@/components/ui';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { TIPOS_PRESTADOR } from '@/lib/tipos';

export default function NovoPrestador() {
  const { origem = 'indicado' } = useLocalSearchParams<{ origem?: 'indicado' | 'morador' }>();
  const morador = origem === 'morador';
  const { condominioId } = useSessao();
  const [tipo, setTipo] = useState<string | null>(null);
  const [outro, setOutro] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [descricao, setDescricao] = useState('');
  const [autorizou, setAutorizou] = useState(morador);

  async function salvar() {
    const t = tipo === 'Outros' ? outro.trim() : tipo;
    if (!t) return avisar('Escolha o tipo de serviço');
    if (nome.trim().length < 2) return avisar('Escreva o nome');
    if (telefone.trim() && !autorizou) return avisar('Autorização', 'Confirme que a pessoa concordou em ter o telefone divulgado, ou deixe o telefone em branco.');
    const { error } = await supabase.from('prestadores').insert({
      condominio_id: condominioId, origem, tipo: t, nome: nome.trim(), telefone: telefone.trim() || null, descricao: descricao.trim() || null,
    });
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    router.back();
  }

  return (
    <Tela rodape={<Botao titulo={morador ? 'Divulgar' : 'Indicar'} icone="send-outline" aoTocar={salvar} />}>
      <Stack.Screen options={{ title: morador ? 'Divulgar meu negócio' : 'Indicar prestador' }} />
      <Opcoes rotulo="Tipo de serviço" valor={tipo} aoMudar={setTipo} opcoes={TIPOS_PRESTADOR.map((t) => ({ valor: t, nome: t }))} />
      {tipo === 'Outros' ? <Campo rotulo="Qual serviço?" valor={outro} aoMudar={setOutro} /> : null}
      <Campo rotulo={morador ? 'Nome do negócio' : 'Nome do profissional ou empresa'} valor={nome} aoMudar={setNome} autoCapitalize="words" />
      <Campo rotulo="Telefone / WhatsApp" ajuda="Opcional" valor={telefone} aoMudar={setTelefone} keyboardType="phone-pad" />
      <Campo rotulo={morador ? 'O que você oferece' : 'Por que você recomenda?'} valor={descricao} aoMudar={setDescricao} multilinha />
      {!morador ? (
        <Marcar rotulo="O profissional concordou em ter o contato divulgado aqui" ajuda="Necessário para mostrar o telefone (LGPD)." valor={autorizou} aoMudar={setAutorizou} />
      ) : (
        <Texto tamanho="pequeno" suave>Seu anúncio aparece com o seu nome para os moradores deste condomínio.</Texto>
      )}
    </Tela>
  );
}
