import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Botao, Cartao, Ladrilho, Subtitulo, Tela, Texto } from '@/components/ui';
import { useConsulta } from '@/lib/consulta';
import { dataCurta, isoData, moeda, nomeUnidade, saudacao } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';
import { espaco, useTema } from '@/lib/tema';
import { DIMENSOES } from '@/lib/tipos';

type Resumo = {
  naoLidos: number;
  importante: { id: string; titulo: string } | null;
  encomendas: number;
  cobranca: { valor: number; vencimento: string } | null;
  paraAprovar: number;
  chamadosAbertos: number;
  manutencoesVencidas: number;
};

export default function Inicio() {
  const { c } = useTema();
  const { nome, membro, condominioId, eGestor, ePortaria, sessao } = useSessao();
  const unidadeId = membro?.unidade_id;

  const { dados, recarregar, carregando } = useConsulta<Resumo>(async () => {
    const uid = sessao!.user.id;
    const desde = new Date(Date.now() - 30 * 86400000).toISOString();
    const [avisos, lidos, enc, cob, res, cham, man] = await Promise.all([
      supabase.from('avisos').select('id, titulo, importante').eq('condominio_id', condominioId).gte('publicado_em', desde).order('publicado_em', { ascending: false }),
      supabase.from('avisos_leituras').select('aviso_id').eq('perfil_id', uid),
      unidadeId
        ? supabase.from('encomendas').select('id', { count: 'exact', head: true }).eq('unidade_id', unidadeId).is('retirada_em', null)
        : Promise.resolve({ count: 0 }),
      unidadeId
        ? supabase.from('cobrancas').select('valor, vencimento').eq('unidade_id', unidadeId).eq('status', 'aberta').order('vencimento').limit(1)
        : Promise.resolve({ data: [] as { valor: number; vencimento: string }[] }),
      eGestor
        ? supabase.from('reservas').select('id', { count: 'exact', head: true }).eq('condominio_id', condominioId).eq('status', 'pendente')
        : Promise.resolve({ count: 0 }),
      eGestor
        ? supabase.from('chamados').select('id', { count: 'exact', head: true }).eq('condominio_id', condominioId).in('status', ['aberto', 'em_andamento'])
        : Promise.resolve({ count: 0 }),
      eGestor
        ? supabase.from('manutencoes').select('id', { count: 'exact', head: true }).eq('condominio_id', condominioId).lt('proxima', isoData(new Date()))
        : Promise.resolve({ count: 0 }),
    ]);
    const lidosSet = new Set((lidos.data ?? []).map((l) => l.aviso_id));
    const naoLidos = (avisos.data ?? []).filter((a) => !lidosSet.has(a.id));
    return {
      data: {
        naoLidos: naoLidos.length,
        importante: naoLidos.find((a) => a.importante) ?? null,
        encomendas: enc.count ?? 0,
        cobranca: (cob as { data: { valor: number; vencimento: string }[] | null }).data?.[0] ?? null,
        paraAprovar: res.count ?? 0,
        chamadosAbertos: cham.count ?? 0,
        manutencoesVencidas: man.count ?? 0,
      },
      error: avisos.error,
    };
  }, [condominioId, unidadeId]);

  const ir = (rota: string) => () => router.push(rota as never);
  const primeiroNome = nome.split(' ')[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.fundo }} edges={['top']}>
      <Tela aoAtualizar={recarregar} atualizando={carregando && !!dados}>
        <View>
          <Texto tamanho="grande" negrito>{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ''}!</Texto>
          <Texto suave>
            {membro?.condominios.nome}
            {membro?.unidades ? ` · ${nomeUnidade(membro.unidades)}` : ''}
          </Texto>
        </View>

        {/* Recados que pedem atenção, em linguagem direta */}
        {dados?.importante ? (
          <Cartao destaque="alerta" aoTocar={ir(`/aviso/${dados.importante.id}`)} rotulo={`Aviso importante: ${dados.importante.titulo}`}>
            <Texto negrito cor={c.alerta}>AVISO IMPORTANTE</Texto>
            <Texto tamanho="subtitulo" negrito>{dados.importante.titulo}</Texto>
            <Texto suave>Toque para ler</Texto>
          </Cartao>
        ) : null}
        {dados?.encomendas ? (
          <Cartao destaque="primaria" aoTocar={ir('/encomendas')} rotulo="Você tem encomenda na portaria">
            <Texto tamanho="subtitulo" negrito>📦 Tem encomenda para você</Texto>
            <Texto>{dados.encomendas === 1 ? '1 pacote aguardando' : `${dados.encomendas} pacotes aguardando`} na portaria.</Texto>
          </Cartao>
        ) : null}
        {dados?.cobranca ? (
          <Cartao destaque={dados.cobranca.vencimento < isoData(new Date()) ? 'perigo' : undefined} aoTocar={ir('/cobrancas')} rotulo="Ver meu boleto">
            <Texto negrito>Taxa de condomínio</Texto>
            <Texto>{moeda(dados.cobranca.valor)} · vence em {dataCurta(dados.cobranca.vencimento)}</Texto>
          </Cartao>
        ) : null}

        {eGestor ? (
          <Botao
            icone="briefcase-outline"
            titulo={`Painel da gestão${dados && dados.paraAprovar + dados.chamadosAbertos + dados.manutencoesVencidas > 0 ? ` (${dados.paraAprovar + dados.chamadosAbertos + dados.manutencoesVencidas} pendências)` : ''}`}
            aoTocar={ir('/gestao')}
          />
        ) : null}

        <Subtitulo>{DIMENSOES.operacional.apelido}</Subtitulo>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
          <Ladrilho titulo="Pedir um conserto" icone="hammer-outline" aoTocar={ir('/chamados')} contador={eGestor ? dados?.chamadosAbertos : 0} />
          <Ladrilho titulo="Reservar espaço" icone="calendar-outline" aoTocar={ir('/reservas')} contador={eGestor ? dados?.paraAprovar : 0} />
          <Ladrilho titulo="Encomendas" icone="cube-outline" aoTocar={ir('/encomendas')} contador={dados?.encomendas} />
          <Ladrilho titulo="Manutenções" icone="construct-outline" aoTocar={ir('/manutencoes')} contador={eGestor ? dados?.manutencoesVencidas : 0} />
        </View>

        <Subtitulo>{DIMENSOES.comunidade.apelido}</Subtitulo>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
          <Ladrilho titulo="Avisos" icone="megaphone-outline" aoTocar={ir('/avisos')} contador={dados?.naoLidos} cor={DIMENSOES.comunidade.cor} />
          <Ladrilho titulo="Enquetes" icone="checkbox-outline" aoTocar={ir('/enquetes')} cor={DIMENSOES.comunidade.cor} />
          <Ladrilho titulo="Vizinhos anunciam" icone="pricetags-outline" aoTocar={ir('/classificados')} cor={DIMENSOES.comunidade.cor} />
          <Ladrilho titulo="Telefones úteis" icone="call-outline" aoTocar={ir('/contatos')} cor={DIMENSOES.comunidade.cor} />
        </View>

        <Subtitulo>{DIMENSOES.financeira.apelido}</Subtitulo>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
          <Ladrilho titulo="Prestação de contas" icone="bar-chart-outline" aoTocar={ir('/financas')} cor={DIMENSOES.financeira.cor} />
          <Ladrilho titulo="Meus boletos" icone="receipt-outline" aoTocar={ir('/cobrancas')} cor={DIMENSOES.financeira.cor} />
        </View>

        <Subtitulo>{DIMENSOES.desenvolvimento.apelido}</Subtitulo>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
          <Ladrilho titulo="Plano de gestão" icone="map-outline" aoTocar={ir('/plano')} cor={DIMENSOES.desenvolvimento.cor} />
          <Ladrilho titulo="Dar uma ideia" icone="bulb-outline" aoTocar={ir('/sugestoes')} cor={DIMENSOES.desenvolvimento.cor} />
          <Ladrilho titulo="Documentos" icone="folder-open-outline" aoTocar={ir('/documentos')} cor={DIMENSOES.desenvolvimento.cor} />
          {ePortaria && !eGestor ? <Ladrilho titulo="Registrar encomenda" icone="add-circle-outline" aoTocar={ir('/encomendas')} /> : null}
        </View>

        <Botao tipo="perigo" icone="warning-outline" titulo="Emergência: telefones" aoTocar={ir('/contatos')} style={{ marginTop: espaco.l }} />
      </Tela>
    </SafeAreaView>
  );
}
