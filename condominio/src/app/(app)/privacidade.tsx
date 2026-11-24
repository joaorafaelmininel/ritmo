import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Share } from 'react-native';

import { avisar, Botao, Campo, Cartao, Opcoes, Subtitulo, Tela, Texto, confirmar } from '@/components/ui';
import { RESUMO_PRIVACIDADE } from '@/legal/textos';
import { useConsulta } from '@/lib/consulta';
import { dataCurta } from '@/lib/formato';
import { ativarNotificacoes, desativarNotificacoes } from '@/lib/notificacoes';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';

const DOCS: Record<string, string> = { termos: 'Termos de Uso', privacidade: 'Política de Privacidade', notificacoes: 'Notificações' };

// Direitos do titular (LGPD art. 18) direto no app, sem burocracia.
export default function Privacidade() {
  const { membro, sair, sessao } = useSessao();
  const [tipo, setTipo] = useState('correcao');
  const [detalhes, setDetalhes] = useState('');

  const { dados, recarregar } = useConsulta(async () => {
    const [c, d, s] = await Promise.all([
      supabase.from('consentimentos').select('documento, versao, aceito, registrado_em').order('registrado_em', { ascending: false }),
      supabase.from('dispositivos').select('token', { count: 'exact', head: true }),
      supabase.from('solicitacoes_titular').select('tipo, status, criado_em').eq('perfil_id', sessao!.user.id).order('criado_em', { ascending: false }),
    ]);
    return { data: { consentimentos: c.data ?? [], notificando: (d.count ?? 0) > 0, pedidos: s.data ?? [] }, error: c.error };
  }, []);

  async function baixar() {
    const { data, error } = await supabase.rpc('meus_dados');
    if (error) return avisar('Não foi possível gerar', mensagemErro(error));
    await Share.share({ title: 'Meus dados', message: JSON.stringify(data, null, 2) });
  }

  async function pedir() {
    const { error } = await supabase.from('solicitacoes_titular').insert({ tipo, detalhes: detalhes.trim() || null });
    if (error) return avisar('Não foi possível enviar', mensagemErro(error));
    setDetalhes('');
    avisar('Pedido registrado', 'A gestão do condomínio tem até 15 dias para responder.');
    recarregar();
  }

  function excluirConta() {
    confirmar('Excluir sua conta?', 'Seu perfil, vínculo com a unidade, fotos e preferências serão apagados. Isso não pode ser desfeito.', () =>
      confirmar('Tem certeza absoluta?', 'Depois de excluir, para usar o app de novo será preciso um novo cadastro.', async () => {
        const { data, error } = await supabase.functions.invoke('excluir-conta');
        const erro = (data as { erro?: string } | null)?.erro;
        if (error || erro) return avisar('Não foi possível excluir', erro ?? mensagemErro(error));
        avisar('Conta excluída', 'Seus dados foram apagados.');
        await sair();
      }, 'Excluir para sempre'), 'Sim, quero excluir');
  }

  return (
    <Tela>
      <Stack.Screen options={{ title: 'Privacidade' }} />
      <Cartao>
        {RESUMO_PRIVACIDADE.map((t) => <Texto key={t}>• {t}</Texto>)}
      </Cartao>
      <Botao tipo="secundario" icone="document-text-outline" titulo="Política de Privacidade completa" aoTocar={() => router.push('/legal/privacidade')} />
      <Botao tipo="secundario" icone="document-text-outline" titulo="Termos de Uso" aoTocar={() => router.push('/legal/termos')} />

      <Subtitulo>Meus dados</Subtitulo>
      <Botao icone="download-outline" titulo="Baixar uma cópia dos meus dados" aoTocar={baixar} />
      <Botao tipo="secundario" icone="create-outline" titulo="Corrigir nome ou telefone" aoTocar={() => router.push('/perfil')} />

      <Subtitulo>Notificações no celular</Subtitulo>
      <Texto>{dados?.notificando ? 'Ativadas neste aparelho ou em outro.' : 'Desativadas.'}</Texto>
      {dados?.notificando ? (
        <Botao tipo="secundario" icone="notifications-off-outline" titulo="Parar de receber" aoTocar={async () => { await desativarNotificacoes(); recarregar(); }} />
      ) : (
        <Botao tipo="secundario" icone="notifications-outline" titulo="Quero receber avisos" aoTocar={async () => {
          const r = await ativarNotificacoes();
          if (r === 'negado') avisar('Permissão negada', 'Ative as notificações deste app nas configurações do celular.');
          if (r === 'indisponivel') avisar('Indisponível', 'Notificações só funcionam no app instalado em um celular.');
          recarregar();
        }} />
      )}

      <Subtitulo>Fazer um pedido</Subtitulo>
      <Opcoes
        valor={tipo}
        aoMudar={setTipo}
        opcoes={[
          { valor: 'correcao', nome: 'Corrigir dados' },
          { valor: 'acesso', nome: 'Saber o que vocês têm' },
          { valor: 'revogacao', nome: 'Retirar consentimento' },
          { valor: 'outro', nome: 'Outro' },
        ]}
      />
      <Campo rotulo="Detalhes" valor={detalhes} aoMudar={setDetalhes} multilinha />
      <Botao tipo="secundario" icone="send-outline" titulo="Enviar pedido" aoTocar={pedir} />
      {membro?.condominios.contato_privacidade ? (
        <Texto suave>Contato de privacidade do condomínio: {membro.condominios.contato_privacidade}</Texto>
      ) : null}
      {dados?.pedidos.map((p, i) => (
        <Texto key={i} tamanho="pequeno" suave>Pedido de {dataCurta(p.criado_em)} ({p.tipo}): {p.status}</Texto>
      ))}

      <Subtitulo>Histórico de aceites</Subtitulo>
      {dados?.consentimentos.map((c, i) => (
        <Texto key={i} tamanho="pequeno" suave>
          {dataCurta(c.registrado_em)} — {DOCS[c.documento] ?? c.documento} v{c.versao}: {c.aceito ? 'aceito' : 'recusado/retirado'}
        </Texto>
      ))}

      <Subtitulo>Excluir conta</Subtitulo>
      <Texto suave>O que você escreveu em pedidos e avisos continua no histórico do condomínio, mas sem o seu nome.</Texto>
      <Botao tipo="perigo" icone="trash-outline" titulo="Excluir minha conta" aoTocar={excluirConta} />
    </Tela>
  );
}
