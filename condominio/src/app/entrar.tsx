import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { avisar, Botao, Campo, Cartao, Tela, Texto } from '@/components/ui';
import { APP_NOME, APP_SLOGAN } from '@/lib/marca';
import { configurado, mensagemErro, supabase } from '@/lib/supabase';
import { espaco, useTema } from '@/lib/tema';

// Login sem senha: a pessoa recebe um código de 6 números no e-mail.
// Nada de senha para decorar — muito mais simples para quem tem pouca familiaridade com tecnologia.
export default function Entrar() {
  const { c } = useTema();
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');

  const emailLimpo = email.trim().toLowerCase();

  async function pedirCodigo() {
    if (!/^\S+@\S+\.\S+$/.test(emailLimpo)) return avisar('E-mail incompleto', 'Confira se o e-mail está escrito certinho, com @ e ponto.');
    const { error } = await supabase.auth.signInWithOtp({ email: emailLimpo, options: { shouldCreateUser: true } });
    if (error) return avisar('Não foi possível enviar', mensagemErro(error));
    setEtapa('codigo');
  }

  async function confirmar() {
    const token = codigo.replace(/\D/g, '');
    if (token.length < 6) return avisar('Código incompleto', 'O código tem 6 números.');
    const { error } = await supabase.auth.verifyOtp({ email: emailLimpo, token, type: 'email' });
    if (error) avisar('Código não aceito', mensagemErro(error));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.fundo }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Tela>
          <View style={{ alignItems: 'center', gap: espaco.s, marginTop: espaco.xl, marginBottom: espaco.l }}>
            <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: c.primaria, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="home" size={56} color={c.sobrePrimaria} />
            </View>
            <Texto tamanho="grande" negrito centro>{APP_NOME}</Texto>
            <Texto suave centro>{APP_SLOGAN}</Texto>
          </View>

          {!configurado ? (
            <Cartao destaque="alerta">
              <Texto negrito>Configuração pendente</Texto>
              <Texto>Preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env (veja o README).</Texto>
            </Cartao>
          ) : null}

          {etapa === 'email' ? (
            <>
              <Texto tamanho="subtitulo" negrito>Para entrar, digite seu e-mail</Texto>
              <Texto suave>Vamos enviar um código de 6 números. Não precisa criar senha.</Texto>
              <Campo
                rotulo="Seu e-mail"
                valor={email}
                aoMudar={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                placeholder="exemplo@email.com"
                returnKeyType="send"
                onSubmitEditing={pedirCodigo}
              />
              <Botao titulo="Enviar código" icone="mail-outline" aoTocar={pedirCodigo} />
            </>
          ) : (
            <>
              <Texto tamanho="subtitulo" negrito>Confira seu e-mail</Texto>
              <Texto>
                Enviamos um código para <Texto negrito>{emailLimpo}</Texto>. Ele pode demorar um ou dois minutos.
                Se não aparecer, olhe também a pasta de spam ou lixo eletrônico.
              </Texto>
              <Campo
                rotulo="Código de 6 números"
                valor={codigo}
                aoMudar={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                placeholder="000000"
                style={{ fontSize: 32, letterSpacing: 10, textAlign: 'center' }}
                onSubmitEditing={confirmar}
              />
              <Botao titulo="Entrar" icone="log-in-outline" aoTocar={confirmar} />
              <Botao titulo="Enviar um novo código" tipo="secundario" aoTocar={pedirCodigo} />
              <Botao titulo="Usar outro e-mail" tipo="texto" aoTocar={() => { setEtapa('email'); setCodigo(''); }} />
            </>
          )}

          <Cartao>
            <Texto negrito>Precisa de ajuda?</Texto>
            <Texto suave>A síndica ou alguém da família pode fazer o primeiro acesso com você. Depois o app fica conectado.</Texto>
          </Cartao>
        </Tela>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
