import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, Cartao, Linha, Opcoes, Tela, Texto } from '@/components/ui';
import { enviarArquivo, escolherFoto } from '@/lib/arquivos';
import { nomeUnidade } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { ESPECIES, Pet } from '@/lib/tipos';

export default function NovoPet() {
  const { condominioId, membro } = useSessao();
  const [especie, setEspecie] = useState<Pet['especie']>('cachorro');
  const [nome, setNome] = useState('');
  const [raca, setRaca] = useState('');
  const [descricao, setDescricao] = useState('');
  const [cuidados, setCuidados] = useState('');
  const [foto, setFoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  async function salvar() {
    if (!membro?.unidade_id) return avisar('Sem unidade', 'Seu cadastro não está ligado a uma unidade.');
    if (nome.trim().length < 2) return avisar('Qual é o nome do pet?');
    try {
      const caminho = foto ? await enviarArquivo(condominioId, 'pets', foto.uri) : null;
      const { error } = await supabase.from('pets').insert({
        condominio_id: condominioId, unidade_id: membro.unidade_id, nome: nome.trim(), especie, raca: raca.trim() || null,
        descricao: descricao.trim() || null, cuidados: cuidados.trim() || null, foto_path: caminho,
      });
      if (error) throw error;
      router.back();
    } catch (e) {
      avisar('Não foi possível salvar', mensagemErro(e));
    }
  }

  return (
    <Tela rodape={<Botao titulo="Cadastrar pet" icone="paw-outline" aoTocar={salvar} />}>
      <Stack.Screen options={{ title: 'Cadastrar pet' }} />
      <Opcoes rotulo="É um…" valor={especie} aoMudar={setEspecie} opcoes={Object.entries(ESPECIES).map(([valor, e]) => ({ valor: valor as Pet['especie'], nome: `${e.emoji} ${e.nome}` }))} />
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} autoCapitalize="words" />
      <Campo rotulo="Raça" ajuda="Opcional. Ex.: vira-lata, poodle" valor={raca} aoMudar={setRaca} />
      <Campo rotulo="Como reconhecer" ajuda="Cor, tamanho, coleira, manchas" valor={descricao} aoMudar={setDescricao} multilinha />
      <Campo rotulo="Cuidados ao encontrar" ajuda="Opcional. Ex.: tem medo de barulho; não dar comida" valor={cuidados} aoMudar={setCuidados} />
      <Texto negrito>Foto (ajuda muito a reconhecer)</Texto>
      {foto ? <Image source={{ uri: foto.uri }} style={{ width: 140, height: 140, borderRadius: 16 }} accessibilityLabel="Foto do pet" /> : null}
      <Linha>
        <Botao tipo="secundario" icone="camera-outline" titulo="Tirar foto" aoTocar={async () => setFoto(await escolherFoto('camera'))} style={{ flexGrow: 1 }} />
        <Botao tipo="secundario" icone="images-outline" titulo="Galeria" aoTocar={async () => setFoto(await escolherFoto('galeria'))} style={{ flexGrow: 1 }} />
      </Linha>
      <Cartao destaque="alerta">
        <Texto negrito>Os vizinhos verão a sua unidade</Texto>
        <Texto>O pet aparece com a sua unidade ({nomeUnidade(membro?.unidades)}) para que, se ele escapar, saibam onde devolver. Seu nome e telefone não aparecem.</Texto>
      </Cartao>
    </Tela>
  );
}
