import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { avisar, Botao, Campo, Linha, Opcoes, Tela, Texto } from '@/components/ui';
import { enviarArquivo, escolherFoto } from '@/lib/arquivos';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { espaco } from '@/lib/tema';
import { CATEGORIAS_CHAMADO } from '@/lib/tipos';

export default function NovoChamado() {
  const { condominioId, membro } = useSessao();
  const [categoria, setCategoria] = useState('manutencao');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [local, setLocal] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);

  async function adicionarFoto(origem: 'camera' | 'galeria') {
    const f = await escolherFoto(origem);
    if (f) setFotos((x) => [...x, f.uri].slice(0, 3));
  }

  async function enviar() {
    if (titulo.trim().length < 3) return avisar('Conte o que aconteceu', 'Escreva pelo menos um título curto, por exemplo: "Lâmpada queimada na garagem".');
    try {
      const caminhos = [];
      for (const uri of fotos) caminhos.push(await enviarArquivo(condominioId, 'chamados', uri));
      const { error } = await supabase.from('chamados').insert({
        condominio_id: condominioId,
        unidade_id: membro?.unidade_id ?? null,
        categoria,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        local: local.trim() || null,
        fotos: caminhos,
      });
      if (error) throw error;
      avisar('Pedido enviado!', 'A gestão vai analisar. Você pode acompanhar a resposta aqui no app.');
      router.back();
    } catch (e) {
      avisar('Não foi possível enviar', mensagemErro(e));
    }
  }

  return (
    <Tela rodape={<Botao titulo="Enviar pedido" icone="send-outline" aoTocar={enviar} />}>
      <Stack.Screen options={{ title: 'Novo pedido' }} />
      <Opcoes rotulo="Qual é o assunto?" valor={categoria} aoMudar={setCategoria} opcoes={Object.entries(CATEGORIAS_CHAMADO).map(([valor, nome]) => ({ valor, nome }))} />
      <Campo rotulo="O que aconteceu?" valor={titulo} aoMudar={setTitulo} placeholder="Ex.: Lâmpada queimada na escada" maxLength={90} />
      <Campo rotulo="Onde?" ajuda="Opcional" valor={local} aoMudar={setLocal} placeholder="Ex.: Bloco B, 2º andar" />
      <Campo rotulo="Quer contar mais detalhes?" ajuda="Opcional" valor={descricao} aoMudar={setDescricao} multilinha />
      <Texto negrito>Fotos (opcional, até 3)</Texto>
      <Texto tamanho="pequeno" suave>Evite fotografar pessoas. A localização da foto não é enviada.</Texto>
      <Linha>
        {fotos.map((uri) => (
          <View key={uri}>
            <Image source={{ uri }} style={{ width: 96, height: 96, borderRadius: 12 }} accessibilityLabel="Foto anexada" />
          </View>
        ))}
      </Linha>
      {fotos.length < 3 ? (
        <View style={{ gap: espaco.s }}>
          <Botao tipo="secundario" icone="camera-outline" titulo="Tirar foto" aoTocar={() => adicionarFoto('camera')} />
          <Botao tipo="secundario" icone="images-outline" titulo="Escolher da galeria" aoTocar={() => adicionarFoto('galeria')} />
        </View>
      ) : null}
      {fotos.length ? <Botao tipo="texto" titulo="Remover fotos" aoTocar={() => setFotos([])} /> : null}
    </Tela>
  );
}
