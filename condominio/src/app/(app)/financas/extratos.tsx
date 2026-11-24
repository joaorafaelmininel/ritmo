import * as DocumentPicker from 'expo-document-picker';
import { Stack } from 'expo-router';
import { useState } from 'react';

import { SeletorPeriodo } from '@/components/lista';
import { avisar, Botao, Campo, Carregando, Cartao, Linha, Marcar, Opcoes, Selo, Subtitulo, Tela, Texto } from '@/components/ui';
import { abrirArquivo, enviarArquivo } from '@/lib/arquivos';
import { useConsulta } from '@/lib/consulta';
import { dataLocal, isoData, lerValor, moeda, nomeMes } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { useTema } from '@/lib/tema';
import { ContaBancaria, Saldo, TIPOS_CONTA } from '@/lib/tipos';

const mesAno = (iso: string) => `${nomeMes(dataLocal(iso).getMonth())}/${dataLocal(iso).getFullYear()}`;

/** Saldos de fim de mês de cada conta e os extratos bancários. */
export default function Extratos() {
  const { c } = useTema();
  const { condominioId, eGestor, eConselho } = useSessao();
  const h = new Date();
  const [form, setForm] = useState(false);
  const [contaId, setContaId] = useState<string | null>(null);
  const [mes, setMes] = useState(new Date(h.getFullYear(), h.getMonth() - 1, 1));
  const [valor, setValor] = useState('');
  const [arquivo, setArquivo] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [revisado, setRevisado] = useState(false);
  const [novaConta, setNovaConta] = useState('');

  const { dados, recarregar } = useConsulta(async () => {
    const [ct, sd] = await Promise.all([
      supabase.from('contas_bancarias').select('*').eq('condominio_id', condominioId).eq('ativa', true).order('ordem').returns<ContaBancaria[]>(),
      supabase.from('saldos').select('*').eq('condominio_id', condominioId).order('competencia', { ascending: false }).limit(120).returns<Saldo[]>(),
    ]);
    return { data: { contas: ct.data ?? [], saldos: sd.data ?? [] }, error: ct.error };
  }, [condominioId]);

  async function salvar() {
    const v = lerValor(valor);
    if (!contaId) return avisar('Escolha a conta');
    if (!Number.isFinite(v)) return avisar('Digite o saldo do fim do mês');
    try {
      // Extrato não revisado fica restrito à gestão e ao conselho.
      const caminho = arquivo ? await enviarArquivo(condominioId, revisado ? 'extratos' : 'restrito', arquivo.uri, arquivo.mimeType ?? 'application/pdf') : null;
      const { error } = await supabase.from('saldos').upsert({
        condominio_id: condominioId, conta_id: contaId, competencia: isoData(mes), saldo_final: v,
        ...(caminho ? { extrato_path: caminho, extrato_publico: revisado } : {}),
      }, { onConflict: 'conta_id,competencia' });
      if (error) throw error;
      setForm(false); setValor(''); setArquivo(null); setRevisado(false);
      recarregar();
    } catch (e) {
      avisar('Não foi possível salvar', mensagemErro(e));
    }
  }

  async function criarConta(nome: string, tipo: ContaBancaria['tipo'] = 'corrente') {
    const { error } = await supabase.from('contas_bancarias').insert({ condominio_id: condominioId, nome, tipo, ordem: (dados?.contas.length ?? 0) + 1 });
    if (error) return avisar('Não foi possível criar', mensagemErro(error));
    setNovaConta('');
    recarregar();
  }

  if (!dados) return <Carregando />;
  return (
    <Tela>
      <Stack.Screen options={{ title: 'Extratos e saldos' }} />
      <Texto suave>Saldo de cada conta no último dia do mês, conferido com o extrato do banco.</Texto>

      {eGestor && dados.contas.length === 0 ? (
        <Botao titulo="Criar contas: corrente e fundo de reserva" aoTocar={async () => {
          const { error } = await supabase.rpc('aplicar_contas_padrao', { p_condominio: condominioId });
          if (error) avisar('Erro', mensagemErro(error)); else recarregar();
        }} />
      ) : null}

      {eGestor && dados.contas.length > 0 && !form ? (
        <Botao icone="add-circle-outline" titulo="Registrar saldo e extrato do mês" aoTocar={() => { setContaId(dados.contas[0].id); setForm(true); }} />
      ) : null}
      {form ? (
        <Cartao>
          <Opcoes rotulo="Conta" valor={contaId} aoMudar={setContaId} opcoes={dados.contas.map((ct) => ({ valor: ct.id, nome: ct.nome }))} />
          <Texto negrito>Mês</Texto>
          <SeletorPeriodo data={mes} aoMudar={setMes} />
          <Campo rotulo="Saldo no último dia do mês (R$)" valor={valor} aoMudar={setValor} keyboardType="numbers-and-punctuation" placeholder="0,00" />
          <Botao tipo="secundario" icone="document-attach-outline" titulo={arquivo ? `📎 ${arquivo.name}` : 'Anexar extrato (PDF)'} aoTocar={async () => {
            const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
            if (!r.canceled) setArquivo(r.assets[0]);
          }} />
          {arquivo ? (
            <Marcar
              rotulo="Revisei: o extrato não mostra nomes, CPF ou contas de moradores"
              ajuda="Extratos costumam listar quem pagou a taxa. Se não ocultou esses dados, deixe desmarcado: só gestão e conselho poderão abrir o arquivo."
              valor={revisado}
              aoMudar={setRevisado}
            />
          ) : null}
          <Botao titulo="Salvar" aoTocar={salvar} />
          <Botao tipo="texto" titulo="Cancelar" aoTocar={() => setForm(false)} />
        </Cartao>
      ) : null}

      {dados.contas.map((ct) => {
        const hist = dados.saldos.filter((s) => s.conta_id === ct.id).slice(0, 12);
        return (
          <Cartao key={ct.id}>
            <Linha style={{ justifyContent: 'space-between' }}>
              <Texto tamanho="subtitulo" negrito style={{ flex: 1 }}>{ct.nome}</Texto>
              <Selo texto={TIPOS_CONTA[ct.tipo]} />
            </Linha>
            {hist[0] ? (
              <Texto tamanho="titulo" negrito cor={Number(hist[0].saldo_final) >= 0 ? c.sucesso : c.perigo}>{moeda(hist[0].saldo_final)}</Texto>
            ) : <Texto suave>Sem saldos registrados.</Texto>}
            {hist.map((s, i) => {
              const anterior = hist[i + 1];
              const variacao = anterior ? Number(s.saldo_final) - Number(anterior.saldo_final) : null;
              const podeVer = s.extrato_path && (s.extrato_publico || eConselho);
              return (
                <Cartao key={s.id} aoTocar={podeVer ? () => abrirArquivo(s.extrato_path!) : undefined} rotulo={`Extrato de ${mesAno(s.competencia)}`}>
                  <Linha style={{ justifyContent: 'space-between' }}>
                    <Texto style={{ textTransform: 'capitalize' }}>{mesAno(s.competencia)}</Texto>
                    <Texto negrito>{moeda(s.saldo_final)}</Texto>
                  </Linha>
                  {variacao !== null ? (
                    <Texto tamanho="pequeno" cor={variacao >= 0 ? c.sucesso : c.perigo}>{variacao >= 0 ? '▲' : '▼'} {moeda(Math.abs(variacao))} no mês</Texto>
                  ) : null}
                  <Texto tamanho="pequeno" cor={podeVer ? c.primaria : c.textoSuave}>
                    {!s.extrato_path ? 'Extrato não anexado' : podeVer ? '📎 Ver extrato' : 'Extrato disponível para o conselho (contém dados de moradores)'}
                  </Texto>
                </Cartao>
              );
            })}
          </Cartao>
        );
      })}

      {eGestor && dados.contas.length > 0 ? (
        <>
          <Subtitulo>Outra conta</Subtitulo>
          <Campo rotulo="Nome da conta" valor={novaConta} aoMudar={setNovaConta} placeholder="Ex.: Aplicação, Fundo de obras" />
          <Botao tipo="secundario" titulo="Adicionar conta" desativado={novaConta.trim().length < 3} aoTocar={() => criarConta(novaConta.trim(), /obra/i.test(novaConta) ? 'obras' : /aplica/i.test(novaConta) ? 'aplicacao' : /reserva/i.test(novaConta) ? 'reserva' : 'corrente')} />
        </>
      ) : null}
    </Tela>
  );
}
