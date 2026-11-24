import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, Carregando, Cartao, Linha, Opcoes, Selo, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { nomeUnidade } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { NOME_PAPEL, Papel, Unidade } from '@/lib/tipos';

type Linha_ = { id: string; perfil_id: string; papel: Papel; vinculo: string | null; telefone: string | null; ativo: boolean; perfis: { nome: string } | null; unidades: Unidade | null };

export default function Moradores() {
  const { condominioId, sessao } = useSessao();
  const confirmar = useConfirmar();
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const { dados, recarregar } = useConsulta(
    () => supabase.from('membros').select('id, perfil_id, papel, vinculo, telefone, ativo, perfis(nome), unidades(id, bloco, numero)')
      .eq('condominio_id', condominioId).order('papel').returns<Linha_[]>(),
    [condominioId],
  );

  async function mudar(id: string, campos: Partial<Linha_>) {
    const { error } = await supabase.from('membros').update(campos).eq('id', id);
    if (error) return avisar('Não foi possível', mensagemErro(error));
    recarregar();
  }

  if (!dados) return <Carregando />;
  const filtrados = dados.filter((m) => !busca || `${m.perfis?.nome} ${m.unidades?.bloco}${m.unidades?.numero}`.toLowerCase().includes(busca.toLowerCase()));
  return (
    <Tela>
      <Stack.Screen options={{ title: 'Moradores' }} />
      <Texto suave>Dados pessoais: use somente para a administração do condomínio (LGPD).</Texto>
      <Campo rotulo="Procurar por nome ou unidade" valor={busca} aoMudar={setBusca} />
      {filtrados.map((m) => (
        <Cartao key={m.id}>
          <Linha style={{ justifyContent: 'space-between' }}>
            <Texto tamanho="subtitulo" negrito>{m.perfis?.nome || '(sem nome)'}</Texto>
            <Selo texto={NOME_PAPEL[m.papel]} tipo={m.papel === 'morador' ? 'neutro' : 'primaria'} />
          </Linha>
          <Texto>{m.unidades ? nomeUnidade(m.unidades) : 'Sem unidade'}{m.vinculo ? ` · ${m.vinculo}` : ''}</Texto>
          {!m.ativo ? <Selo texto="Desativado" tipo="perigo" /> : null}
          {m.telefone ? <Botao tipo="texto" icone="call-outline" titulo={m.telefone} aoTocar={() => { Linking.openURL(`tel:${m.telefone!.replace(/[^\d+]/g, '')}`); }} /> : null}
          {m.perfil_id !== sessao?.user.id ? (
            editando === m.id ? (
              <>
                <Opcoes rotulo="Função" valor={m.papel} aoMudar={(p) => mudar(m.id, { papel: p })} opcoes={(Object.keys(NOME_PAPEL) as Papel[]).map((p) => ({ valor: p, nome: NOME_PAPEL[p] }))} />
                <Botao tipo="perigo" titulo={m.ativo ? 'Desativar acesso' : 'Reativar acesso'} aoTocar={() => confirmar(m.ativo ? 'Desativar acesso?' : 'Reativar?', 'Use quando a pessoa se mudar ou não morar mais aqui.', () => mudar(m.id, { ativo: !m.ativo }))} />
                <Botao tipo="texto" titulo="Fechar" aoTocar={() => setEditando(null)} />
              </>
            ) : (
              <Botao tipo="secundario" titulo="Alterar função ou acesso" aoTocar={() => setEditando(m.id)} />
            )
          ) : null}
        </Cartao>
      ))}
    </Tela>
  );
}
