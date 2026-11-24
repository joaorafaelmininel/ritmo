import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { avisar, Botao, Campo, Carregando, Cartao, Linha, Opcoes, Selo, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { quando } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { espaco, useTema } from '@/lib/tema';
import { Equipamento, STATUS_EQUIP } from '@/lib/tipos';

// Situação dos equipamentos: portão, bomba, interfone… atualizada pela portaria e gestão.
export default function Equipamentos() {
  const { c } = useTema();
  const { condominioId, ePortaria, eGestor } = useSessao();
  const confirmar = useConfirmar();
  const [editando, setEditando] = useState<string | null>(null);
  const [status, setStatus] = useState<Equipamento['status']>('ok');
  const [obs, setObs] = useState('');
  const [previsao, setPrevisao] = useState('');
  const [novo, setNovo] = useState('');

  const { dados, recarregar } = useConsulta(
    () => supabase.from('equipamentos').select('*').eq('condominio_id', condominioId).order('ordem').returns<Equipamento[]>(),
    [condominioId],
  );

  async function salvar(id: string) {
    const { error } = await supabase.from('equipamentos').update({ status, observacao: obs.trim() || null, previsao: previsao.trim() || null }).eq('id', id);
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    setEditando(null);
    recarregar();
  }

  if (!dados) return <Carregando />;
  const problemas = dados.filter((e) => e.status !== 'ok');
  return (
    <Tela aoAtualizar={recarregar}>
      <Stack.Screen options={{ title: 'Equipamentos' }} />
      <Cartao destaque={problemas.length ? 'alerta' : 'sucesso'}>
        <Texto tamanho="subtitulo" negrito>{problemas.length ? `${problemas.length} com problema ou em manutenção` : 'Tudo funcionando ✅'}</Texto>
        {eGestor && dados.length === 0 ? (
          <Botao tipo="secundario" titulo="Criar lista padrão (portões, bomba, interfone…)" aoTocar={async () => {
            const { error } = await supabase.rpc('aplicar_melhorias_padrao', { p_condominio: condominioId });
            if (error) avisar('Erro', mensagemErro(error)); else recarregar();
          }} />
        ) : null}
      </Cartao>

      {[...problemas, ...dados.filter((e) => e.status === 'ok')].map((e) => {
        const st = STATUS_EQUIP[e.status];
        const cor = { sucesso: c.sucesso, alerta: c.alerta, perigo: c.perigo, primaria: c.primaria }[st.tipo];
        return (
          <Cartao key={e.id} destaque={e.status === 'ok' ? undefined : st.tipo === 'primaria' ? 'primaria' : st.tipo}>
            <Linha>
              <Ionicons name={st.icone as never} size={30} color={cor} />
              <View style={{ flex: 1 }}>
                <Texto tamanho="subtitulo" negrito>{e.nome}</Texto>
                {e.local ? <Texto tamanho="pequeno" suave>{e.local}</Texto> : null}
              </View>
              <Selo texto={st.nome} tipo={st.tipo} />
            </Linha>
            {e.observacao ? <Texto>{e.observacao}</Texto> : null}
            {e.previsao ? <Texto negrito>Previsão: {e.previsao}</Texto> : null}
            <Texto tamanho="pequeno" suave>Atualizado {quando(e.atualizado_em)}</Texto>
            {ePortaria && editando !== e.id ? (
              <Botao tipo="secundario" titulo="Atualizar situação" aoTocar={() => { setEditando(e.id); setStatus(e.status); setObs(e.observacao ?? ''); setPrevisao(e.previsao ?? ''); }} />
            ) : null}
            {editando === e.id ? (
              <View style={{ gap: espaco.s }}>
                <Opcoes valor={status} aoMudar={setStatus} opcoes={Object.entries(STATUS_EQUIP).map(([v, x]) => ({ valor: v as Equipamento['status'], nome: x.nome }))} />
                {status !== 'ok' ? (
                  <>
                    <Campo rotulo="O que aconteceu?" valor={obs} aoMudar={setObs} placeholder="Ex.: portão não fecha sozinho" />
                    <Campo rotulo="Previsão" ajuda="Opcional" valor={previsao} aoMudar={setPrevisao} placeholder="Ex.: técnico vem na sexta" />
                  </>
                ) : null}
                <Botao titulo="Salvar" aoTocar={() => salvar(e.id)} />
                {eGestor ? <Botao tipo="texto" titulo="Remover da lista" aoTocar={() => confirmar('Remover?', e.nome, async () => { await supabase.from('equipamentos').delete().eq('id', e.id); recarregar(); })} /> : null}
                <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setEditando(null)} />
              </View>
            ) : null}
          </Cartao>
        );
      })}

      {eGestor ? (
        <Cartao>
          <Campo rotulo="Adicionar equipamento" valor={novo} aoMudar={setNovo} placeholder="Ex.: Elevador, Academia" />
          <Botao tipo="secundario" icone="add" titulo="Adicionar" desativado={novo.trim().length < 3} aoTocar={async () => {
            const { error } = await supabase.from('equipamentos').insert({ condominio_id: condominioId, nome: novo.trim(), ordem: dados.length + 1 });
            if (error) return avisar('Erro', mensagemErro(error));
            setNovo(''); recarregar();
          }} />
        </Cartao>
      ) : null}
    </Tela>
  );
}
