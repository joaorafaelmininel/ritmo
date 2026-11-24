import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { avisar, BotaoOuvir, Botao, Campo, Cartao, Marcar, Tela, Texto, Titulo } from '@/components/ui';
import { RESUMO_PRIVACIDADE, VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '@/legal/textos';
import { APP_NOME } from '@/lib/marca';
import { useSessao } from '@/lib/sessao';
import { mensagemErro, supabase } from '@/lib/supabase';
import { espaco, useTema } from '@/lib/tema';

// Primeiro acesso (ou nova versão dos textos): resumo claro + aceite registrado.
export default function Consentimento() {
  const { c } = useTema();
  const { sessao, nome: nomeAtual, recarregar, sair } = useSessao();
  const [nome, setNome] = useState(nomeAtual);
  const [maior, setMaior] = useState(false);
  const [aceito, setAceito] = useState(false);

  async function continuar() {
    if (nome.trim().length < 2) return avisar('Como devemos chamar você?', 'Digite seu nome.');
    if (!maior || !aceito) return avisar('Falta marcar', 'Marque as duas caixas para continuar.');
    const uid = sessao!.user.id;
    const r1 = await supabase.from('perfis').update({ nome: nome.trim() }).eq('id', uid);
    const r2 = await supabase.from('consentimentos').insert([
      { documento: 'termos', versao: VERSAO_TERMOS, plataforma: Platform.OS },
      { documento: 'privacidade', versao: VERSAO_PRIVACIDADE, plataforma: Platform.OS },
    ]);
    const erro = r1.error ?? r2.error;
    if (erro) return avisar('Não foi possível salvar', mensagemErro(erro));
    await recarregar();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.fundo }} edges={['top']}>
      <Tela rodape={<Botao titulo="Concordo e quero continuar" icone="checkmark-circle-outline" aoTocar={continuar} />}>
        <Titulo>Boas-vindas ao {APP_NOME}</Titulo>
        <Texto>Antes de começar, veja em poucas linhas como cuidamos dos seus dados.</Texto>

        <Cartao>
          {RESUMO_PRIVACIDADE.map((t) => (
            <View key={t} style={{ flexDirection: 'row', gap: espaco.s }}>
              <Texto negrito cor={c.primaria}>•</Texto>
              <Texto style={{ flex: 1 }}>{t}</Texto>
            </View>
          ))}
        </Cartao>
        <BotaoOuvir texto={RESUMO_PRIVACIDADE.join('. ')} />

        <View style={{ gap: espaco.s }}>
          <Botao tipo="secundario" icone="document-text-outline" titulo="Ler a Política de Privacidade" aoTocar={() => router.push('/legal/privacidade')} />
          <Botao tipo="secundario" icone="document-text-outline" titulo="Ler os Termos de Uso" aoTocar={() => router.push('/legal/termos')} />
        </View>

        <Campo rotulo="Seu nome" ajuda="É assim que a síndica e os vizinhos verão você." valor={nome} aoMudar={setNome} autoCapitalize="words" autoComplete="name" />

        <Marcar rotulo="Tenho 18 anos ou mais." valor={maior} aoMudar={setMaior} />
        <Marcar rotulo="Li e concordo com os Termos de Uso e a Política de Privacidade." valor={aceito} aoMudar={setAceito} />

        <Botao tipo="texto" titulo="Sair" aoTocar={sair} />
      </Tela>
    </SafeAreaView>
  );
}
