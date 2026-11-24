import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { avisar, Botao, Campo, Carregando, Cartao, Linha, Selo, Subtitulo, Tela, Texto, useConfirmar } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { quando } from '@/lib/formato';
import { notificar } from '@/lib/notificacoes';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { espaco, useTema } from '@/lib/tema';
import { PedidoAjuda, TIPOS_AJUDA } from '@/lib/tipos';

type Contato = { unidade_pedido: string | null; nome_pedido: string | null; unidade_voluntario: string | null; nome_voluntario: string | null };
const COLUNAS = 'id, autor_id, tipo, descricao, quando, status, voluntario_id, criado_em, autor:perfis!ajuda_pedidos_autor_id_fkey(nome)';

/** Quem combinou a ajuda vê a unidade do outro (só depois do aceite). */
function ContatoAjuda({ id, souAutor }: { id: string; souAutor: boolean }) {
  const [c, setC] = useState<Contato | null>(null);
  useEffect(() => {
    supabase.rpc('contato_ajuda', { p_pedido: id }).then(({ data }) => setC(((data as Contato[] | null) ?? [])[0] ?? null));
  }, [id]);
  if (!c) return null;
  return souAutor
    ? <Texto negrito>🤝 {c.nome_voluntario} vai ajudar{c.unidade_voluntario ? ` (unidade ${c.unidade_voluntario})` : ''}.</Texto>
    : <Texto negrito>🏠 {c.nome_pedido} · unidade {c.unidade_pedido}. Combine pelo interfone ou vá até lá.</Texto>;
}

// Vizinho solidário: quem precisa pede, quem pode ajuda.
export default function Solidario() {
  const { c } = useTema();
  const { condominioId, sessao } = useSessao();
  const uid = sessao!.user.id;
  const confirmar = useConfirmar();
  const [habilidades, setHabilidades] = useState<string[]>([]);
  const [disp, setDisp] = useState('');
  const [cadastrando, setCadastrando] = useState(false);

  const { dados, recarregar } = useConsulta(async () => {
    const [p, v, nv] = await Promise.all([
      supabase.from('ajuda_pedidos').select(COLUNAS).eq('condominio_id', condominioId).in('status', ['aberto', 'combinado']).order('criado_em', { ascending: false }).returns<PedidoAjuda[]>(),
      supabase.from('voluntarios').select('habilidades, disponibilidade, ativo').eq('condominio_id', condominioId).eq('perfil_id', uid).maybeSingle(),
      supabase.from('voluntarios').select('perfil_id', { count: 'exact', head: true }).eq('condominio_id', condominioId).eq('ativo', true),
    ]);
    return { data: { pedidos: p.data ?? [], eu: v.data, voluntarios: nv.count ?? 0 }, error: p.error };
  }, [condominioId]);

  async function serVoluntario() {
    const { error } = await supabase.from('voluntarios').upsert({ condominio_id: condominioId, habilidades, disponibilidade: disp.trim() || null, ativo: true });
    if (error) return avisar('Não foi possível', mensagemErro(error));
    setCadastrando(false);
    recarregar();
  }

  async function mudar(p: PedidoAjuda, status: PedidoAjuda['status']) {
    const { error } = await supabase.from('ajuda_pedidos').update({ status }).eq('id', p.id);
    if (error) return avisar('Não foi possível', mensagemErro(error));
    if (status === 'combinado') notificar('ajuda_aceita', p.id);
    recarregar();
  }

  if (!dados) return <Carregando />;
  const souVoluntario = !!dados.eu?.ativo;
  const meus = dados.pedidos.filter((p) => p.autor_id === uid);
  const queAceitei = dados.pedidos.filter((p) => p.voluntario_id === uid);
  const abertos = dados.pedidos.filter((p) => p.status === 'aberto' && p.autor_id !== uid);

  return (
    <Tela aoAtualizar={recarregar}>
      <Stack.Screen options={{ title: 'Vizinho solidário' }} />
      <Texto suave>Uma rede de ajuda entre vizinhos: buscar um remédio, ajudar com o celular, fazer companhia. Sem custo, só boa vontade.</Texto>

      <Botao icone="hand-left-outline" titulo="Preciso de ajuda" aoTocar={() => router.push('/solidario/pedir')} style={{ minHeight: 72 }} />
      <Texto tamanho="pequeno" suave>{dados.voluntarios} vizinho{dados.voluntarios === 1 ? '' : 's'} voluntário{dados.voluntarios === 1 ? '' : 's'} hoje.</Texto>

      {meus.length ? <Subtitulo>Meus pedidos</Subtitulo> : null}
      {meus.map((p) => (
        <Cartao key={p.id} destaque={p.status === 'combinado' ? 'sucesso' : undefined}>
          <Selo texto={p.status === 'aberto' ? 'Esperando um voluntário' : 'Combinado!'} tipo={p.status === 'aberto' ? 'alerta' : 'sucesso'} />
          <Texto negrito>{TIPOS_AJUDA[p.tipo]?.nome}{p.descricao ? `: ${p.descricao}` : ''}</Texto>
          {p.status === 'combinado' ? <ContatoAjuda id={p.id} souAutor /> : null}
          {p.status === 'combinado' ? <Botao icone="heart-outline" titulo="Já fui ajudado(a), obrigado!" aoTocar={() => mudar(p, 'concluido')} /> : null}
          <Botao tipo="texto" titulo="Cancelar pedido" aoTocar={() => confirmar('Cancelar pedido?', '', () => mudar(p, 'cancelado'))} />
        </Cartao>
      ))}

      {queAceitei.length ? <Subtitulo>Ajudas que eu combinei</Subtitulo> : null}
      {queAceitei.map((p) => (
        <Cartao key={p.id} destaque="primaria">
          <Texto negrito>{TIPOS_AJUDA[p.tipo]?.nome}{p.descricao ? `: ${p.descricao}` : ''}</Texto>
          {p.quando ? <Texto>Quando: {p.quando}</Texto> : null}
          <ContatoAjuda id={p.id} souAutor={false} />
          <Linha>
            <Botao titulo="Feito!" icone="checkmark" aoTocar={() => mudar(p, 'concluido')} style={{ flexGrow: 1 }} />
            <Botao tipo="secundario" titulo="Não vou conseguir" aoTocar={() => confirmar('Desistir?', 'O pedido volta para outros voluntários.', () => mudar(p, 'aberto'))} style={{ flexGrow: 1 }} />
          </Linha>
        </Cartao>
      ))}

      <Subtitulo>Pedidos dos vizinhos ({abertos.length})</Subtitulo>
      {abertos.length === 0 ? <Texto suave>Ninguém precisando de ajuda agora. 💙</Texto> : null}
      {abertos.map((p) => (
        <Cartao key={p.id}>
          <Linha>
            <Ionicons name={(TIPOS_AJUDA[p.tipo]?.icone ?? 'help-circle-outline') as never} size={28} color={c.primaria} />
            <Texto tamanho="subtitulo" negrito style={{ flex: 1 }}>{TIPOS_AJUDA[p.tipo]?.nome}</Texto>
          </Linha>
          {p.descricao ? <Texto>{p.descricao}</Texto> : null}
          {p.quando ? <Texto>Quando: {p.quando}</Texto> : null}
          <Texto tamanho="pequeno" suave>{p.autor?.nome || 'Um vizinho'} · {quando(p.criado_em)}</Texto>
          {souVoluntario ? (
            <Botao icone="hand-right-outline" titulo="Eu ajudo" aoTocar={() => confirmar('Combinar ajuda?', 'Você verá a unidade do vizinho para combinar.', () => mudar(p, 'combinado'), 'Sim, eu ajudo')} />
          ) : (
            <Texto tamanho="pequeno" suave>Torne-se voluntário para poder ajudar.</Texto>
          )}
        </Cartao>
      ))}

      <Subtitulo>Ser voluntário</Subtitulo>
      {souVoluntario && !cadastrando ? (
        <Cartao destaque="sucesso">
          <Texto negrito>Você é voluntário(a). Obrigado! 💙</Texto>
          <Texto tamanho="pequeno">Pode ajudar com: {(dados.eu?.habilidades ?? []).map((h: string) => TIPOS_AJUDA[h]?.nome).filter(Boolean).join(', ') || 'qualquer coisa'}</Texto>
          <Botao tipo="texto" titulo="Deixar de ser voluntário" aoTocar={async () => { await supabase.from('voluntarios').update({ ativo: false }).eq('condominio_id', condominioId).eq('perfil_id', uid); recarregar(); }} />
        </Cartao>
      ) : cadastrando ? (
        <Cartao>
          <Texto negrito>Posso ajudar com:</Texto>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
            {Object.entries(TIPOS_AJUDA).map(([k, t]) => {
              const sel = habilidades.includes(k);
              return (
                <Pressable key={k} onPress={() => setHabilidades((h) => (sel ? h.filter((x) => x !== k) : [...h, k]))} accessibilityRole="checkbox" accessibilityState={{ checked: sel }}
                  style={{ minHeight: 50, paddingHorizontal: espaco.m, borderRadius: 25, borderWidth: 2, borderColor: sel ? c.primaria : c.borda, backgroundColor: sel ? c.primaria : c.superficie, justifyContent: 'center' }}>
                  <Texto cor={sel ? c.sobrePrimaria : c.texto} negrito={sel}>{t.nome}</Texto>
                </Pressable>
              );
            })}
          </View>
          <Campo rotulo="Quando você costuma estar disponível?" ajuda="Opcional. Ex.: fins de semana, depois das 18h" valor={disp} aoMudar={setDisp} />
          <Texto tamanho="pequeno" suave>Quando você aceitar um pedido, o vizinho verá seu nome e sua unidade.</Texto>
          <Botao titulo="Quero ser voluntário" aoTocar={serVoluntario} />
          <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setCadastrando(false)} />
        </Cartao>
      ) : (
        <Botao tipo="secundario" icone="heart-outline" titulo="Quero ser voluntário" aoTocar={() => { setHabilidades(dados.eu?.habilidades ?? []); setCadastrando(true); }} />
      )}
    </Tela>
  );
}
