import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { avisar, Botao, Campo, Carregando, Cartao, Opcoes, Subtitulo, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { ALVO_TOQUE, espaco, useTema } from '@/lib/tema';

type Contato = { id: string; nome: string; descricao: string | null; telefone: string; categoria: string };
const GRUPOS: Record<string, string> = { emergencia: 'Emergência', condominio: 'Condomínio', servico: 'Serviços' };

// Um toque liga direto. Botões de emergência em vermelho e bem grandes.
export default function Contatos() {
  const { c, f } = useTema();
  const { condominioId, eGestor } = useSessao();
  const confirmar = useConfirmar();
  const [nome, setNome] = useState('');
  const [tel, setTel] = useState('');
  const [desc, setDesc] = useState('');
  const [cat, setCat] = useState('condominio');
  const [novo, setNovo] = useState(false);

  const { dados, recarregar } = useConsulta(
    () => supabase.from('contatos_uteis').select('*').eq('condominio_id', condominioId).order('ordem').order('nome').returns<Contato[]>(),
    [condominioId],
  );

  async function salvar() {
    if (!nome.trim() || !tel.trim()) return avisar('Preencha nome e telefone');
    const { error } = await supabase.from('contatos_uteis').insert({ condominio_id: condominioId, nome: nome.trim(), telefone: tel.trim(), descricao: desc.trim() || null, categoria: cat, ordem: 10 });
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    setNovo(false); setNome(''); setTel(''); setDesc('');
    recarregar();
  }

  if (!dados) return <Carregando />;
  return (
    <Tela>
      <Stack.Screen options={{ title: 'Telefones úteis' }} />
      {Object.entries(GRUPOS).map(([g, titulo]) => {
        const lista = dados.filter((x) => x.categoria === g);
        if (!lista.length) return null;
        const emergencia = g === 'emergencia';
        return (
          <View key={g} style={{ gap: espaco.s }}>
            <Subtitulo>{titulo}</Subtitulo>
            {lista.map((ct) => (
              <Pressable
                key={ct.id}
                onPress={() => Linking.openURL(`tel:${ct.telefone.replace(/[^\d+]/g, '')}`)}
                onLongPress={eGestor ? () => confirmar('Remover contato?', ct.nome, async () => { await supabase.from('contatos_uteis').delete().eq('id', ct.id); recarregar(); }, 'Remover') : undefined}
                accessibilityRole="button"
                accessibilityLabel={`Ligar para ${ct.nome}, ${ct.telefone}`}
                style={({ pressed }) => ({
                  minHeight: ALVO_TOQUE + 16, borderRadius: 16, padding: espaco.m, flexDirection: 'row', alignItems: 'center', gap: espaco.m,
                  backgroundColor: emergencia ? c.perigo : c.superficie, borderWidth: 2, borderColor: emergencia ? c.perigo : c.borda, opacity: pressed ? 0.8 : 1,
                })}>
                <Ionicons name="call" size={32} color={emergencia ? '#fff' : c.primaria} />
                <View style={{ flex: 1 }}>
                  <Texto tamanho="subtitulo" negrito cor={emergencia ? '#fff' : c.texto}>{ct.nome}</Texto>
                  {/* Números longos vão embaixo do nome para não espremer o texto */}
                  {ct.telefone.length > 5 ? <Texto negrito cor={emergencia ? '#fff' : c.primaria}>{ct.telefone}</Texto> : null}
                  {ct.descricao ? <Texto cor={emergencia ? '#fff' : c.textoSuave}>{ct.descricao}</Texto> : null}
                </View>
                {ct.telefone.length <= 5 ? <Texto negrito cor={emergencia ? '#fff' : c.primaria} style={{ fontSize: f('titulo') }}>{ct.telefone}</Texto> : null}
              </Pressable>
            ))}
          </View>
        );
      })}
      {eGestor ? (
        novo ? (
          <Cartao>
            <Campo rotulo="Nome" valor={nome} aoMudar={setNome} placeholder="Ex.: Portaria, Zelador, Eletricista" />
            <Campo rotulo="Telefone" valor={tel} aoMudar={setTel} keyboardType="phone-pad" />
            <Campo rotulo="Descrição" ajuda="Opcional" valor={desc} aoMudar={setDesc} />
            <Opcoes rotulo="Grupo" valor={cat} aoMudar={setCat} opcoes={Object.entries(GRUPOS).map(([valor, nome]) => ({ valor, nome }))} />
            <Botao titulo="Salvar contato" aoTocar={salvar} />
            <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setNovo(false)} />
          </Cartao>
        ) : (
          <>
            <Botao tipo="secundario" icone="add" titulo="Adicionar telefone" aoTocar={() => setNovo(true)} />
            <Texto tamanho="pequeno" suave>Para remover, toque e segure no contato.</Texto>
          </>
        )
      ) : null}
    </Tela>
  );
}
