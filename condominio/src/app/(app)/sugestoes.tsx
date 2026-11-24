import { Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, Carregando, Cartao, Linha, Opcoes, Selo, Tela, Texto, Vazio } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { quando } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { Dimensao, DIMENSOES, Sugestao } from '@/lib/tipos';

const STATUS: Record<string, { nome: string; tipo: 'neutro' | 'primaria' | 'sucesso' | 'perigo' | 'alerta' }> = {
  nova: { nome: 'Nova', tipo: 'neutro' },
  em_analise: { nome: 'Em análise', tipo: 'alerta' },
  aceita: { nome: 'Aceita', tipo: 'sucesso' },
  virou_projeto: { nome: 'Virou projeto!', tipo: 'primaria' },
  nao_aceita: { nome: 'Não será feita agora', tipo: 'perigo' },
};

export default function Sugestoes() {
  const { condominioId, sessao, eGestor } = useSessao();
  const uid = sessao!.user.id;
  const [escrevendo, setEscrevendo] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dimensao, setDimensao] = useState<Dimensao | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});

  const { dados, recarregar } = useConsulta(
    () => supabase.from('sugestoes').select('*, perfis(nome), sugestoes_apoios(perfil_id)').eq('condominio_id', condominioId).order('criado_em', { ascending: false }).returns<Sugestao[]>(),
    [condominioId],
  );

  async function enviar() {
    if (titulo.trim().length < 3) return avisar('Escreva sua ideia em poucas palavras');
    const { error } = await supabase.from('sugestoes').insert({ condominio_id: condominioId, titulo: titulo.trim(), descricao: descricao.trim() || null, dimensao });
    if (error) return avisar('Não foi possível enviar', mensagemErro(error));
    setEscrevendo(false); setTitulo(''); setDescricao(''); setDimensao(null);
    recarregar();
  }

  async function apoiar(s: Sugestao, apoiei: boolean) {
    if (apoiei) await supabase.from('sugestoes_apoios').delete().eq('sugestao_id', s.id).eq('perfil_id', uid);
    else await supabase.from('sugestoes_apoios').insert({ sugestao_id: s.id });
    recarregar();
  }

  async function decidir(s: Sugestao, status: string) {
    const { error } = await supabase.from('sugestoes').update({ status, resposta: respostas[s.id]?.trim() || s.resposta }).eq('id', s.id);
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    recarregar();
  }

  if (!dados) return <Carregando />;
  const ordenadas = [...dados].sort((a, b) => (b.sugestoes_apoios?.length ?? 0) - (a.sugestoes_apoios?.length ?? 0));

  return (
    <Tela>
      <Stack.Screen options={{ title: 'Ideias dos moradores' }} />
      <Texto suave>Sugira melhorias e apoie as ideias dos vizinhos. As mais apoiadas ajudam a definir as prioridades do plano de gestão.</Texto>
      {escrevendo ? (
        <Cartao>
          <Campo rotulo="Sua ideia" valor={titulo} aoMudar={setTitulo} placeholder="Ex.: Instalar bicicletário" />
          <Campo rotulo="Explique (opcional)" valor={descricao} aoMudar={setDescricao} multilinha />
          <Opcoes rotulo="Sobre o quê? (opcional)" valor={dimensao} aoMudar={setDimensao} opcoes={(Object.keys(DIMENSOES) as Dimensao[]).map((d) => ({ valor: d, nome: DIMENSOES[d].apelido }))} />
          <Botao titulo="Enviar ideia" icone="send-outline" aoTocar={enviar} />
          <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setEscrevendo(false)} />
        </Cartao>
      ) : (
        <Botao icone="bulb-outline" titulo="Dar uma ideia" aoTocar={() => setEscrevendo(true)} />
      )}
      {ordenadas.length === 0 ? <Vazio icone="bulb-outline" texto="Seja a primeira pessoa a sugerir algo!" /> : null}
      {ordenadas.map((s) => {
        const apoios = s.sugestoes_apoios?.length ?? 0;
        const apoiei = !!s.sugestoes_apoios?.some((a) => a.perfil_id === uid);
        return (
          <Cartao key={s.id}>
            <Linha>
              <Selo texto={STATUS[s.status]?.nome ?? s.status} tipo={STATUS[s.status]?.tipo} />
              {s.dimensao ? <Selo texto={DIMENSOES[s.dimensao].nome} /> : null}
            </Linha>
            <Texto tamanho="subtitulo" negrito>{s.titulo}</Texto>
            {s.descricao ? <Texto>{s.descricao}</Texto> : null}
            <Texto tamanho="pequeno" suave>{s.perfis?.nome ?? 'Morador(a)'} · {quando(s.criado_em)}</Texto>
            {s.resposta ? (
              <Cartao destaque="primaria"><Texto negrito>Resposta da gestão</Texto><Texto>{s.resposta}</Texto></Cartao>
            ) : null}
            <Botao
              tipo={apoiei ? 'primario' : 'secundario'}
              icone={apoiei ? 'heart' : 'heart-outline'}
              titulo={`${apoiei ? 'Você apoia' : 'Apoiar'} · ${apoios}`}
              aoTocar={() => apoiar(s, apoiei)}
            />
            {eGestor ? (
              <>
                <Campo rotulo="Resposta da gestão" valor={respostas[s.id] ?? ''} aoMudar={(t) => setRespostas((r) => ({ ...r, [s.id]: t }))} />
                <Opcoes valor={s.status} aoMudar={(st) => decidir(s, st)} opcoes={Object.entries(STATUS).map(([valor, x]) => ({ valor, nome: x.nome }))} />
              </>
            ) : null}
          </Cartao>
        );
      })}
    </Tela>
  );
}
