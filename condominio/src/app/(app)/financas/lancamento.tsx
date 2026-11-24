import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, CampoData, Opcoes, Tela, Texto } from '@/components/ui';
import { enviarArquivo, escolherFoto } from '@/lib/arquivos';
import { isoData, lerValor, moeda } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from '@/lib/tipos';

export default function NovoLancamento() {
  const { condominioId } = useSessao();
  const [tipo, setTipo] = useState<'despesa' | 'receita'>('despesa');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState<string | null>(isoData(new Date()));
  const [fornecedor, setFornecedor] = useState('');
  const [comprovante, setComprovante] = useState<ImagePicker.ImagePickerAsset | null>(null);

  async function salvar() {
    const v = lerValor(valor);
    if (!categoria) return avisar('Escolha a categoria');
    if (!(v > 0)) return avisar('Valor inválido', 'Digite o valor, por exemplo 1.250,00');
    if (!data) return avisar('Data inválida');
    try {
      const caminho = comprovante ? await enviarArquivo(condominioId, 'comprovantes', comprovante.uri, comprovante.mimeType ?? 'image/jpeg') : null;
      const { error } = await supabase.from('lancamentos').insert({
        condominio_id: condominioId, tipo, categoria, descricao: descricao.trim() || categoria, valor: v, data,
        fornecedor: fornecedor.trim() || null, comprovante_path: caminho,
      });
      if (error) throw error;
      router.back();
    } catch (e) {
      avisar('Não foi possível salvar', mensagemErro(e));
    }
  }

  const v = lerValor(valor);
  return (
    <Tela rodape={<Botao titulo={`Salvar ${tipo}${v > 0 ? ` de ${moeda(v)}` : ''}`} icone="save-outline" aoTocar={salvar} />}>
      <Stack.Screen options={{ title: 'Novo lançamento' }} />
      <Opcoes valor={tipo} aoMudar={(t) => { setTipo(t); setCategoria(null); }} opcoes={[{ valor: 'despesa', nome: 'Despesa (saiu)' }, { valor: 'receita', nome: 'Receita (entrou)' }]} />
      <Opcoes rotulo="Categoria" valor={categoria} aoMudar={setCategoria} opcoes={(tipo === 'despesa' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA).map((x) => ({ valor: x, nome: x }))} />
      <Campo rotulo="Valor (R$)" valor={valor} aoMudar={setValor} keyboardType="decimal-pad" placeholder="0,00" />
      <Campo rotulo="Descrição" valor={descricao} aoMudar={setDescricao} placeholder="Ex.: Conta de água de outubro" />
      <CampoData rotulo="Data" valor={data} aoMudar={setData} atalhos={false} />
      {tipo === 'despesa' ? <Campo rotulo="Fornecedor" ajuda="Opcional" valor={fornecedor} aoMudar={setFornecedor} /> : null}
      <Texto negrito>Comprovante (nota fiscal ou recibo)</Texto>
      <Texto tamanho="pequeno" suave>Fica visível para os moradores, como prestação de contas. Não fotografe documentos com dados pessoais.</Texto>
      {comprovante ? <Texto>📎 Comprovante anexado</Texto> : null}
      <Botao tipo="secundario" icone="camera-outline" titulo={comprovante ? 'Trocar foto do comprovante' : 'Fotografar comprovante'} aoTocar={async () => setComprovante(await escolherFoto('camera'))} />
      <Botao tipo="secundario" icone="images-outline" titulo="Escolher da galeria" aoTocar={async () => setComprovante(await escolherFoto('galeria'))} />
    </Tela>
  );
}
