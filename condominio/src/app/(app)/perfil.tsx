import { Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, Cartao, Opcoes, Subtitulo, Tela, Texto } from '@/components/ui';
import { nomeUnidade } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { NOME_PAPEL } from '@/lib/tipos';

export default function Perfil() {
  const { sessao, nome: nomeAtual, membro, vinculos, recarregar, escolherCondominio } = useSessao();
  const [nome, setNome] = useState(nomeAtual);
  const [telefone, setTelefone] = useState(membro?.telefone ?? '');
  const [codigo, setCodigo] = useState('');

  async function salvar() {
    if (nome.trim().length < 2) return avisar('Digite seu nome');
    const r1 = await supabase.from('perfis').update({ nome: nome.trim() }).eq('id', sessao!.user.id);
    const r2 = membro ? await supabase.from('membros').update({ telefone: telefone.trim() || null }).eq('id', membro.id) : { error: null };
    const erro = r1.error ?? r2.error;
    if (erro) return avisar('Não foi possível salvar', mensagemErro(erro));
    await recarregar();
    avisar('Pronto!', 'Seus dados foram atualizados.');
  }

  async function entrarOutro() {
    const { data, error } = await supabase.rpc('entrar_com_codigo', { p_codigo: codigo, p_vinculo: 'proprietario' });
    if (error) return avisar('Não deu certo', mensagemErro(error));
    setCodigo('');
    escolherCondominio(data as string);
    await recarregar();
    avisar('Pronto!', 'Vínculo atualizado.');
  }

  return (
    <Tela>
      <Stack.Screen options={{ title: 'Meu perfil' }} />
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} autoCapitalize="words" />
      <Campo
        rotulo="Telefone (opcional)"
        ajuda="Só a gestão do condomínio vê. Útil em emergências (ex.: vazamento no seu apartamento)."
        valor={telefone}
        aoMudar={setTelefone}
        keyboardType="phone-pad"
      />
      <Texto suave>E-mail: {sessao?.user.email}</Texto>
      <Botao icone="save-outline" titulo="Salvar" aoTocar={salvar} />

      <Subtitulo>Meus condomínios</Subtitulo>
      {vinculos.length > 1 ? (
        <Opcoes
          valor={membro?.condominio_id ?? null}
          aoMudar={escolherCondominio}
          opcoes={vinculos.map((v) => ({ valor: v.condominio_id, nome: v.condominios.nome }))}
        />
      ) : null}
      {membro ? (
        <Cartao>
          <Texto negrito>{membro.condominios.nome}</Texto>
          <Texto>{NOME_PAPEL[membro.papel]}{membro.unidades ? ` · ${nomeUnidade(membro.unidades)}` : ''}</Texto>
        </Cartao>
      ) : null}
      <Campo rotulo="Mudou de unidade ou tem outro imóvel?" ajuda="Digite o código de acesso da unidade." valor={codigo} aoMudar={(t) => setCodigo(t.toUpperCase())} autoCapitalize="characters" />
      <Botao tipo="secundario" titulo="Usar este código" aoTocar={entrarOutro} desativado={codigo.length < 6} />
    </Tela>
  );
}
