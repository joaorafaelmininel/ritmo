import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, Marcar, Opcoes, Tela, Texto, useConfirmar } from '@/components/ui';
import { notificar } from '@/lib/notificacoes';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { CATEGORIAS_AVISO } from '@/lib/tipos';

export default function NovoAviso() {
  const { condominioId } = useSessao();
  const confirmar = useConfirmar();
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [categoria, setCategoria] = useState('geral');
  const [importante, setImportante] = useState(false);
  const [enviarPush, setEnviarPush] = useState(true);

  async function publicar() {
    if (titulo.trim().length < 3 || corpo.trim().length < 3) return avisar('Faltam informações', 'Preencha o título e o texto do aviso.');
    const { data, error } = await supabase.from('avisos')
      .insert({ condominio_id: condominioId, titulo: titulo.trim(), corpo: corpo.trim(), categoria, importante })
      .select('id').single();
    if (error) return avisar('Não foi possível publicar', mensagemErro(error));
    if (enviarPush) notificar('aviso', data.id);
    router.back();
  }

  return (
    <Tela rodape={<Botao titulo="Publicar aviso" icone="send-outline" aoTocar={() => confirmar('Publicar agora?', 'Todos os moradores poderão ver este aviso.', publicar, 'Sim, publicar')} />}>
      <Stack.Screen options={{ title: 'Novo aviso' }} />
      <Texto suave>Escreva de forma curta e direta. Frases simples ajudam quem lê com dificuldade.</Texto>
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} placeholder="Ex.: Falta de água na quinta-feira" maxLength={90} />
      <Campo rotulo="Texto do aviso" valor={corpo} aoMudar={setCorpo} multilinha placeholder="O quê, quando, onde e o que o morador precisa fazer." />
      <Opcoes rotulo="Assunto" valor={categoria} aoMudar={setCategoria} opcoes={Object.entries(CATEGORIAS_AVISO).map(([valor, nome]) => ({ valor, nome }))} />
      <Marcar rotulo="É importante" ajuda="Aparece em destaque no início do app." valor={importante} aoMudar={setImportante} />
      <Marcar rotulo="Avisar no celular dos moradores" ajuda="Envia notificação para quem ativou." valor={enviarPush} aoMudar={setEnviarPush} />
    </Tela>
  );
}
