import { Stack } from 'expo-router';
import { useState } from 'react';

import { avisar, Botao, Campo, CampoData, Carregando, Cartao, Linha, Marcar, Selo, Tela, Texto } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataCurta, isoData, lerValor } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { Manutencao } from '@/lib/tipos';

function situacao(m: Manutencao) {
  if (!m.proxima) return { nome: 'Sem data definida', tipo: 'neutro' as const };
  const hoje = isoData(new Date());
  const em30 = isoData(new Date(Date.now() + 30 * 86400000));
  if (m.proxima < hoje) return { nome: 'Atrasada', tipo: 'perigo' as const };
  if (m.proxima <= em30) return { nome: 'Próximos 30 dias', tipo: 'alerta' as const };
  return { nome: 'Em dia', tipo: 'sucesso' as const };
}

export default function Manutencoes() {
  const { condominioId, eGestor } = useSessao();
  const [registrando, setRegistrando] = useState<string | null>(null);
  const [data, setData] = useState<string | null>(isoData(new Date()));
  const [custo, setCusto] = useState('');
  const [obs, setObs] = useState('');
  const [novo, setNovo] = useState(false);
  const [item, setItem] = useState('');
  const [meses, setMeses] = useState('12');
  const [legal, setLegal] = useState(false);

  const { dados, carregando, recarregar } = useConsulta(
    () => supabase.from('manutencoes').select('*').eq('condominio_id', condominioId).order('proxima', { ascending: true, nullsFirst: true }).returns<Manutencao[]>(),
    [condominioId],
  );

  async function registrar(id: string) {
    if (!data) return avisar('Informe a data em que o serviço foi feito');
    const { error } = await supabase.from('manutencoes_registros').insert({
      manutencao_id: id, realizada_em: data, custo: custo ? lerValor(custo) : null, observacao: obs.trim() || null,
    });
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    setRegistrando(null); setCusto(''); setObs('');
    recarregar();
  }

  async function criar() {
    if (item.trim().length < 3) return avisar('Informe o nome do item');
    const { error } = await supabase.from('manutencoes').insert({
      condominio_id: condominioId, item: item.trim(), periodicidade_meses: Number(meses) || 12, obrigacao_legal: legal,
    });
    if (error) return avisar('Não foi possível salvar', mensagemErro(error));
    setNovo(false); setItem('');
    recarregar();
  }

  if (!dados) return <Carregando />;
  return (
    <Tela aoAtualizar={recarregar} atualizando={carregando}>
      <Stack.Screen options={{ title: 'Manutenções' }} />
      <Texto suave>Calendário de manutenção preventiva do condomínio. Tudo em dia evita gastos maiores e riscos.</Texto>
      {dados.map((m) => {
        const s = situacao(m);
        return (
          <Cartao key={m.id} destaque={s.tipo === 'perigo' ? 'perigo' : undefined}>
            <Linha>
              <Selo texto={s.nome} tipo={s.tipo} />
              {m.obrigacao_legal ? <Selo texto="Obrigatória por lei" tipo="primaria" /> : null}
            </Linha>
            <Texto tamanho="subtitulo" negrito>{m.item}</Texto>
            {m.descricao ? <Texto suave>{m.descricao}</Texto> : null}
            <Texto>Última: {dataCurta(m.ultima_realizacao)} · Próxima: <Texto negrito>{dataCurta(m.proxima)}</Texto></Texto>
            <Texto tamanho="pequeno" suave>A cada {m.periodicidade_meses} {m.periodicidade_meses === 1 ? 'mês' : 'meses'}</Texto>
            {eGestor && registrando !== m.id ? (
              <Botao tipo="secundario" icone="checkmark-done-outline" titulo="Registrar serviço feito" aoTocar={() => setRegistrando(m.id)} />
            ) : null}
            {registrando === m.id ? (
              <>
                <CampoData rotulo="Quando foi feito?" valor={data} aoMudar={setData} atalhos={false} />
                <Campo rotulo="Custo (R$)" ajuda="Opcional" valor={custo} aoMudar={setCusto} keyboardType="decimal-pad" />
                <Campo rotulo="Observação" ajuda="Opcional. Ex.: empresa, nº do laudo" valor={obs} aoMudar={setObs} />
                <Botao titulo="Salvar registro" aoTocar={() => registrar(m.id)} />
                <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setRegistrando(null)} />
              </>
            ) : null}
          </Cartao>
        );
      })}
      {eGestor && !novo ? <Botao tipo="secundario" icone="add" titulo="Adicionar item de manutenção" aoTocar={() => setNovo(true)} /> : null}
      {novo ? (
        <Cartao>
          <Campo rotulo="Item" valor={item} aoMudar={setItem} placeholder="Ex.: Revisão do portão" />
          <Campo rotulo="Repetir a cada quantos meses?" valor={meses} aoMudar={(t) => setMeses(t.replace(/\D/g, ''))} keyboardType="number-pad" />
          <Marcar rotulo="Obrigatória por lei ou norma" valor={legal} aoMudar={setLegal} />
          <Botao titulo="Salvar item" aoTocar={criar} />
          <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setNovo(false)} />
        </Cartao>
      ) : null}
    </Tela>
  );
}
