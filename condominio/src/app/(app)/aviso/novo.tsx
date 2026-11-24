import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, CampoData, Marcar, Opcoes, Tela, Texto, useConfirmar } from '@/components/ui';
import { dataLocal } from '@/lib/formato';
import { notificar } from '@/lib/notificacoes';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { CATEGORIAS_AVISO } from '@/lib/tipos';

export default function NovoAviso() {
  const { condominioId, eGestor } = useSessao();
  const { categoria: catInicial } = useLocalSearchParams<{ categoria?: string }>();
  const [validoAte, setValidoAte] = useState<string | null>(null);
  const confirmar = useConfirmar();
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [categoria, setCategoria] = useState(catInicial ?? 'geral');
  const [importante, setImportante] = useState(false);
  const [enviarPush, setEnviarPush] = useState(true);

  async function publicar() {
    if (titulo.trim().length < 3 || corpo.trim().length < 3) return avisar('Faltam informações', 'Preencha o título e o texto do aviso.');
    const { data, error } = await supabase.from('avisos')
      .insert({
        condominio_id: condominioId, titulo: titulo.trim(), corpo: corpo.trim(), categoria, importante: eGestor && importante,
        valido_ate: validoAte ? new Date(dataLocal(validoAte).getTime() + 86399000).toISOString() : null,
      })
      .select('id').single();
    if (error) return avisar('Não foi possível publicar', mensagemErro(error));
    if (enviarPush) notificar('aviso', data.id);
    router.back();
  }

  return (
    <Tela rodape={<Botao titulo="Publicar aviso" icone="send-outline" aoTocar={() => confirmar('Publicar agora?', 'Todos os moradores poderão ver este aviso.', publicar, 'Sim, publicar')} />}>
      <Stack.Screen options={{ title: categoria === 'operacional' ? 'Comunicado do dia a dia' : 'Novo aviso' }} />
      <Texto suave>Escreva de forma curta e direta. Frases simples ajudam quem lê com dificuldade.</Texto>
      <Campo rotulo="Título" valor={titulo} aoMudar={setTitulo} placeholder="Ex.: Falta de água na quinta-feira" maxLength={90} />
      <Campo rotulo="Texto do aviso" valor={corpo} aoMudar={setCorpo} multilinha placeholder="O quê, quando, onde e o que o morador precisa fazer." />
      <Opcoes
        rotulo="Assunto"
        valor={categoria}
        aoMudar={setCategoria}
        opcoes={Object.entries(CATEGORIAS_AVISO)
          .filter(([v]) => eGestor || ['operacional', 'manutencao', 'seguranca'].includes(v))
          .map(([valor, nome]) => ({ valor, nome }))}
      />
      {['operacional', 'manutencao', 'seguranca'].includes(categoria) ? (
        <>
          <CampoData rotulo="Vale até (opcional)" valor={validoAte} aoMudar={setValidoAte} />
          <Texto tamanho="pequeno" suave>Ex.: “Portão B com defeito” até sexta. Depois dessa data, sai do quadro “Dia a dia”.</Texto>
        </>
      ) : null}
      {eGestor ? <Marcar rotulo="É importante" ajuda="Aparece em destaque no início do app." valor={importante} aoMudar={setImportante} /> : null}
      <Marcar rotulo="Avisar no celular dos moradores" ajuda="Envia notificação para quem ativou." valor={enviarPush} aoMudar={setEnviarPush} />
    </Tela>
  );
}
