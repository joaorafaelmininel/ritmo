import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, CampoData, Opcoes, Tela, Texto } from '@/components/ui';
import { isoData } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { RegistroPortaria, TIPOS_PORTARIA } from '@/lib/tipos';

// O morador avisa antes: a portaria já sabe quem vai chegar e libera sem precisar interfonar.
export default function AvisarPortaria() {
  const { condominioId, membro } = useSessao();
  const [tipo, setTipo] = useState<RegistroPortaria['tipo']>('visita');
  const [nome, setNome] = useState('');
  const [data, setData] = useState<string | null>(isoData(new Date()));
  const [obs, setObs] = useState('');

  async function enviar() {
    if (!membro?.unidade_id) return avisar('Sem unidade', 'Seu cadastro não está ligado a uma unidade. Fale com a síndica.');
    if (nome.trim().length < 2) return avisar('Quem vai chegar?', tipo === 'entrega' ? 'Escreva a loja ou o aplicativo (ex.: iFood, Mercado Livre).' : 'Escreva o nome da pessoa ou da empresa.');
    if (!data) return avisar('Escolha o dia');
    const { error } = await supabase.from('portaria').insert({
      condominio_id: condominioId, unidade_id: membro.unidade_id, origem: 'morador', status: 'esperado',
      tipo, nome: nome.trim(), data, observacao: obs.trim() || null,
    });
    if (error) return avisar('Não foi possível avisar', mensagemErro(error));
    avisar('Portaria avisada!', 'Quando chegar, a portaria libera a entrada e você recebe um aviso.');
    router.back();
  }

  return (
    <Tela rodape={<Botao titulo="Avisar a portaria" icone="send-outline" aoTocar={enviar} />}>
      <Stack.Screen options={{ title: 'Avisar a portaria' }} />
      <Opcoes rotulo="Quem vai chegar?" valor={tipo} aoMudar={setTipo} opcoes={Object.entries(TIPOS_PORTARIA).map(([valor, n]) => ({ valor: valor as RegistroPortaria['tipo'], nome: n }))} />
      <Campo
        rotulo={tipo === 'entrega' ? 'Loja ou aplicativo' : tipo === 'prestador' ? 'Nome da pessoa ou empresa' : 'Nome da visita'}
        valor={nome}
        aoMudar={setNome}
        autoCapitalize="words"
        placeholder={tipo === 'entrega' ? 'Ex.: iFood, farmácia' : tipo === 'prestador' ? 'Ex.: José (eletricista)' : 'Ex.: minha filha Ana'}
      />
      <CampoData rotulo="Quando?" valor={data} aoMudar={setData} />
      <Campo rotulo="Recado para a portaria" ajuda="Opcional. Ex.: pode subir direto; vem de carro" valor={obs} aoMudar={setObs} />
      <Texto tamanho="pequeno" suave>Só o nome é guardado, por 30 dias. Não pedimos documento nem foto do visitante.</Texto>
    </Tela>
  );
}
