import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, Linha, Tela, Texto } from '@/components/ui';
import { enviarArquivo, escolherFoto } from '@/lib/arquivos';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';

export default function NovoAchado() {
  const { tipo = 'achado' } = useLocalSearchParams<{ tipo?: 'achado' | 'perdido' }>();
  const achado = tipo === 'achado';
  const { condominioId } = useSessao();
  const [titulo, setTitulo] = useState('');
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [retirar, setRetirar] = useState(achado ? 'Na portaria' : '');
  const [foto, setFoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  async function salvar() {
    if (titulo.trim().length < 3) return avisar('O que é o objeto?');
    try {
      const caminho = foto ? await enviarArquivo(condominioId, 'achados', foto.uri) : null;
      const { error } = await supabase.from('achados').insert({
        condominio_id: condominioId, tipo, titulo: titulo.trim(), local: local.trim() || null, descricao: descricao.trim() || null,
        onde_retirar: retirar.trim() || null, foto_path: caminho,
      });
      if (error) throw error;
      router.back();
    } catch (e) {
      avisar('Não foi possível salvar', mensagemErro(e));
    }
  }

  return (
    <Tela rodape={<Botao titulo="Publicar" icone="send-outline" aoTocar={salvar} />}>
      <Stack.Screen options={{ title: achado ? 'Encontrei um objeto' : 'Perdi um objeto' }} />
      <Campo rotulo="O que é?" valor={titulo} aoMudar={setTitulo} placeholder={achado ? 'Ex.: Óculos de grau, chave com chaveiro azul' : 'Ex.: Brinco dourado'} />
      <Campo rotulo={achado ? 'Onde encontrou?' : 'Onde acha que perdeu?'} valor={local} aoMudar={setLocal} placeholder="Ex.: perto da piscina" />
      <Campo rotulo="Detalhes" ajuda="Opcional" valor={descricao} aoMudar={setDescricao} multilinha />
      {achado ? <Campo rotulo="Onde o dono pode retirar?" valor={retirar} aoMudar={setRetirar} /> : null}
      <Texto negrito>Foto (opcional)</Texto>
      {achado ? <Texto tamanho="pequeno" suave>Dica: para documentos e cartões, não fotografe — escreva só “documento em nome de M.”.</Texto> : null}
      {foto ? <Image source={{ uri: foto.uri }} style={{ width: 140, height: 140, borderRadius: 16 }} /> : null}
      <Linha>
        <Botao tipo="secundario" icone="camera-outline" titulo="Tirar foto" aoTocar={async () => setFoto(await escolherFoto('camera'))} style={{ flexGrow: 1 }} />
        <Botao tipo="secundario" icone="images-outline" titulo="Galeria" aoTocar={async () => setFoto(await escolherFoto('galeria'))} style={{ flexGrow: 1 }} />
      </Linha>
    </Tela>
  );
}
