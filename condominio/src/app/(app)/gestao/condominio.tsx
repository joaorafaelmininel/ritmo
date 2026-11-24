import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, Tela, Texto } from '@/components/ui';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';

export default function DadosCondominio() {
  const { membro, recarregar } = useSessao();
  const cd = membro!.condominios;
  const [nome, setNome] = useState(cd.nome);
  const [cidade, setCidade] = useState(cd.cidade ?? '');
  const [uf, setUf] = useState(cd.uf ?? '');
  const [contato, setContato] = useState(cd.contato_privacidade ?? '');

  async function salvar() {
    const { error } = await supabase.from('condominios').update({
      nome: nome.trim(), cidade: cidade.trim() || null, uf: uf.trim().toUpperCase() || null, contato_privacidade: contato.trim() || null,
    }).eq('id', cd.id);
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    await recarregar();
    router.back();
  }

  return (
    <Tela rodape={<Botao titulo="Salvar" icone="save-outline" aoTocar={salvar} />}>
      <Stack.Screen options={{ title: 'Dados do condomínio' }} />
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} />
      <Campo rotulo="Cidade" valor={cidade} aoMudar={setCidade} />
      <Campo rotulo="Estado (sigla)" valor={uf} aoMudar={(t) => setUf(t.toUpperCase().slice(0, 2))} maxLength={2} />
      <Campo
        rotulo="Contato de privacidade (LGPD)"
        ajuda="E-mail ou telefone para os moradores tratarem de seus dados. O condomínio é o controlador dos dados; a síndica responde por ele."
        valor={contato}
        aoMudar={setContato}
        autoCapitalize="none"
      />
      <Texto tamanho="pequeno" suave>
        Condomínios de pequeno porte podem dispensar a nomeação formal de encarregado (Resolução CD/ANPD nº 2/2022), mas
        precisam manter um canal de comunicação com os titulares — é este contato.
      </Texto>
    </Tela>
  );
}
