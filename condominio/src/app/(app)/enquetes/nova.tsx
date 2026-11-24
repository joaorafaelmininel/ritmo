import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, CampoData, Tela, Texto } from '@/components/ui';
import { dataLocal } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';

export default function NovaEnquete() {
  const { condominioId } = useSessao();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [opcoes, setOpcoes] = useState(['Sim', 'Não', '']);
  const [fim, setFim] = useState<string | null>(null);

  async function criar() {
    const ops = opcoes.map((o) => o.trim()).filter(Boolean);
    if (titulo.trim().length < 5) return avisar('Escreva a pergunta');
    if (ops.length < 2) return avisar('Coloque pelo menos duas opções');
    const encerra = fim ? new Date(dataLocal(fim).getTime() + 86399000).toISOString() : null;
    const { data, error } = await supabase.from('enquetes')
      .insert({ condominio_id: condominioId, titulo: titulo.trim(), descricao: descricao.trim() || null, encerra_em: encerra })
      .select('id').single();
    if (error) return avisar('Não foi possível criar', mensagemErro(error));
    const r = await supabase.from('enquete_opcoes').insert(ops.map((texto, ordem) => ({ enquete_id: data.id, texto, ordem })));
    if (r.error) return avisar('Não foi possível salvar as opções', mensagemErro(r.error));
    router.replace(`/enquetes/${data.id}`);
  }

  return (
    <Tela rodape={<Botao titulo="Publicar enquete" icone="send-outline" aoTocar={criar} />}>
      <Stack.Screen options={{ title: 'Nova enquete' }} />
      <Campo rotulo="Pergunta" valor={titulo} aoMudar={setTitulo} placeholder="Ex.: Qual a melhor data para a festa junina?" />
      <Campo rotulo="Explicação" ajuda="Opcional" valor={descricao} aoMudar={setDescricao} multilinha />
      <Texto negrito>Opções de resposta</Texto>
      {opcoes.map((o, i) => (
        <Campo key={i} rotulo={`Opção ${i + 1}`} valor={o} aoMudar={(t) => setOpcoes((x) => x.map((y, j) => (j === i ? t : y)))} />
      ))}
      {opcoes.length < 8 ? <Botao tipo="secundario" icone="add" titulo="Mais uma opção" aoTocar={() => setOpcoes((x) => [...x, ''])} /> : null}
      <CampoData rotulo="Encerrar a votação em" valor={fim} aoMudar={setFim} />
      <Texto tamanho="pequeno" suave>Sem data, a enquete fica aberta até ser apagada.</Texto>
    </Tela>
  );
}
