import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { Botao, Carregando, Cartao, Linha, Opcoes, Selo, Tela, Texto, useConfirmar, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { moeda, quando } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';

type Anuncio = { id: string; tipo: string; titulo: string; descricao: string | null; preco: number | null; contato: string | null; criado_em: string; autor_id: string; perfis: { nome: string } | null };
const TIPOS_ANUNCIO: Record<string, string> = { oferta: 'Vendo', procura: 'Procuro', servico: 'Ofereço serviço', doacao: 'Doação' };

export default function Classificados() {
  const { condominioId, sessao, eGestor } = useSessao();
  const confirmar = useConfirmar();
  const [tipo, setTipo] = useState<string>('todos');
  const { dados, carregando, recarregar } = useConsulta(() => {
    let q = supabase.from('classificados').select('*, perfis(nome)').eq('condominio_id', condominioId).eq('ativo', true).order('criado_em', { ascending: false });
    if (tipo !== 'todos') q = q.eq('tipo', tipo);
    return q.returns<Anuncio[]>();
  }, [condominioId, tipo]);

  return (
    <Tela aoAtualizar={recarregar} atualizando={carregando && !!dados}>
      <Stack.Screen options={{ title: 'Vizinhos anunciam' }} />
      <Texto suave>Compra, venda, doações e serviços entre vizinhos. Negocie com cuidado.</Texto>
      <Botao icone="add-circle-outline" titulo="Anunciar" aoTocar={() => router.push('/classificados/novo')} />
      <Opcoes valor={tipo} aoMudar={setTipo} opcoes={[{ valor: 'todos', nome: 'Todos' }, ...Object.entries(TIPOS_ANUNCIO).map(([valor, nome]) => ({ valor, nome }))]} />
      {!dados ? <Carregando /> : null}
      {dados?.length === 0 ? <Vazio icone="pricetags-outline" texto="Nenhum anúncio por aqui." /> : null}
      {dados?.map((a) => {
        const meu = a.autor_id === sessao?.user.id;
        const tel = a.contato?.replace(/\D/g, '');
        return (
          <Cartao key={a.id}>
            <Linha>
              <Selo texto={TIPOS_ANUNCIO[a.tipo]} tipo="primaria" />
              {a.preco ? <Selo texto={moeda(a.preco)} tipo="sucesso" /> : null}
            </Linha>
            <Texto tamanho="subtitulo" negrito>{a.titulo}</Texto>
            {a.descricao ? <Texto>{a.descricao}</Texto> : null}
            <Texto tamanho="pequeno" suave>{a.perfis?.nome ?? 'Vizinho(a)'} · {quando(a.criado_em)}</Texto>
            {a.contato ? <Texto>Contato: {a.contato}</Texto> : null}
            {tel && tel.length >= 10 ? (
              <Botao tipo="secundario" icone="logo-whatsapp" titulo="Conversar no WhatsApp" aoTocar={() => { Linking.openURL(`https://wa.me/55${tel.replace(/^55/, '')}`); }} />
            ) : null}
            {meu || eGestor ? (
              <Botao tipo="texto" titulo={meu ? 'Encerrar meu anúncio' : 'Remover anúncio (gestão)'} aoTocar={() => confirmar('Encerrar anúncio?', 'Ele deixará de aparecer para os vizinhos.', async () => {
                await supabase.from('classificados').update({ ativo: false }).eq('id', a.id);
                recarregar();
              })} />
            ) : null}
          </Cartao>
        );
      })}
    </Tela>
  );
}
