import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Item, ItemLista } from '@/components/lista';
import { NomeIcone, Tela, Texto } from '@/components/ui';
import { dataCurta, moeda } from '@/lib/formato';
import { useResumo } from '@/lib/resumo';
import { useSessao } from '@/lib/sessao';
import { espaco } from '@/lib/tema';
import { Dimensao, DIMENSOES } from '@/lib/tipos';

export default function DimensaoTela() {
  const { id } = useLocalSearchParams<{ id: Dimensao }>();
  const { eGestor, ePortaria } = useSessao();
  const { dados } = useResumo();
  const info = DIMENSOES[id] ?? DIMENSOES.operacional;

  const plano: Item = { titulo: 'Projetos desta área', detalhe: 'O que a gestão está fazendo', icone: 'map-outline', rota: `/plano?dimensao=${id}` };

  const itens: Record<Dimensao, Item[]> = {
    financeira: [
      {
        titulo: 'Meus boletos', icone: 'receipt-outline', rota: '/cobrancas', destaque: !!dados?.cobranca,
        detalhe: dados?.cobranca ? `${moeda(dados.cobranca.valor)} · vence ${dataCurta(dados.cobranca.vencimento)}` : 'Taxa do condomínio e Pix',
      },
      { titulo: 'Prestação de contas', detalhe: 'Quanto entrou e para onde foi o dinheiro', icone: 'bar-chart-outline', rota: '/financas' },
      { titulo: 'Balancetes e documentos', icone: 'folder-open-outline', rota: '/documentos' },
      ...(eGestor ? [{ titulo: 'Lançar receita ou despesa', icone: 'add-circle-outline' as NomeIcone, rota: '/financas/lancamento' }] : []),
      plano,
    ],
    comunidade: [
      { titulo: 'Avisos', detalhe: 'Recados da gestão', icone: 'megaphone-outline', rota: '/avisos', contador: dados?.naoLidos },
      { titulo: 'Enquetes', detalhe: 'Dê sua opinião', icone: 'checkbox-outline', rota: '/enquetes' },
      { titulo: 'Vizinhos anunciam', detalhe: 'Vendas, doações e serviços', icone: 'pricetags-outline', rota: '/classificados' },
      { titulo: 'Telefones e emergência', detalhe: 'Um toque para ligar', icone: 'call-outline', rota: '/contatos' },
      plano,
    ],
    operacional: [
      { titulo: 'Registrar ocorrência', detalhe: 'Conserto, limpeza, segurança ou barulho', icone: 'alert-circle-outline', rota: '/chamados/novo', destaque: true },
      { titulo: eGestor ? 'Ocorrências dos moradores' : 'Minhas ocorrências', detalhe: 'Acompanhe as respostas', icone: 'list-outline', rota: '/chamados', contador: eGestor ? dados?.ocorrenciasAbertas : 0 },
      { titulo: 'Reservar espaço', detalhe: 'Salão de festas, churrasqueira', icone: 'calendar-outline', rota: '/reservas', contador: eGestor ? dados?.paraAprovar : 0 },
      { titulo: ePortaria ? 'Encomendas (registrar)' : 'Encomendas', detalhe: 'Pacotes na portaria', icone: 'cube-outline', rota: '/encomendas', contador: dados?.encomendas },
      { titulo: 'Manutenções', detalhe: 'Calendário de manutenção preventiva', icone: 'construct-outline', rota: '/manutencoes', contador: eGestor ? dados?.manutencoesVencidas : 0 },
      plano,
    ],
    desenvolvimento: [
      { titulo: 'Plano de gestão', detalhe: 'Todos os projetos, nas quatro áreas', icone: 'map-outline', rota: '/plano' },
      { titulo: 'Dar uma ideia', detalhe: 'Sugira melhorias e apoie as dos vizinhos', icone: 'bulb-outline', rota: '/sugestoes' },
      { titulo: 'Documentos', detalhe: 'Convenção, regimento e atas', icone: 'folder-open-outline', rota: '/documentos' },
    ],
  };

  return (
    <Tela>
      <Stack.Screen options={{ title: info.botao }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s }}>
        <Ionicons name={info.icone as never} size={36} color={info.cor} />
        <Texto suave style={{ flex: 1 }}>{info.descricao}</Texto>
      </View>
      {itens[id]?.map((item) => <ItemLista key={item.titulo} item={item} cor={info.cor} />)}
    </Tela>
  );
}
