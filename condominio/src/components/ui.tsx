import Ionicons from '@expo/vector-icons/Ionicons';
import * as Speech from 'expo-speech';
import { ComponentProps, ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isoData, lerData } from '@/lib/formato';
import { usePreferencias } from '@/lib/preferencias';
import { ALVO_TOQUE, espaco, tamanhos, useTema } from '@/lib/tema';

export type NomeIcone = ComponentProps<typeof Ionicons>['name'];

// Limite para somar a escala do app com a do sistema sem quebrar o layout.
const MAX_MULT = 1.6;

// ---------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------
type TextoProps = {
  children: ReactNode;
  tamanho?: keyof typeof tamanhos;
  negrito?: boolean;
  suave?: boolean;
  cor?: string;
  centro?: boolean;
  style?: StyleProp<TextStyle>;
  linhas?: number;
};

export function Texto({ children, tamanho = 'texto', negrito, suave, cor, centro, style, linhas }: TextoProps) {
  const { c, f } = useTema();
  return (
    <Text
      maxFontSizeMultiplier={MAX_MULT}
      numberOfLines={linhas}
      style={[
        {
          fontSize: f(tamanho),
          lineHeight: Math.round(f(tamanho) * 1.4),
          color: cor ?? (suave ? c.textoSuave : c.texto),
          fontWeight: negrito ? '700' : '400',
          textAlign: centro ? 'center' : 'left',
        },
        style,
      ]}>
      {children}
    </Text>
  );
}

export const Titulo = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => (
  <Texto tamanho="titulo" negrito style={[{ marginTop: espaco.s }, style]}>
    <Text accessibilityRole="header">{children}</Text>
  </Texto>
);

export const Subtitulo = ({ children }: { children: ReactNode }) => (
  <Texto tamanho="subtitulo" negrito style={{ marginTop: espaco.l, marginBottom: espaco.xs }}>
    <Text accessibilityRole="header">{children}</Text>
  </Texto>
);

// ---------------------------------------------------------------------
// Tela com rolagem e "puxar para atualizar"
// ---------------------------------------------------------------------
export function Tela({
  children,
  aoAtualizar,
  atualizando = false,
  semRolagem,
  rodape,
}: {
  children: ReactNode;
  aoAtualizar?: () => void;
  atualizando?: boolean;
  semRolagem?: boolean;
  rodape?: ReactNode;
}) {
  const { c } = useTema();
  const insets = useSafeAreaInsets();
  const conteudo = { padding: espaco.m, gap: espaco.m, paddingBottom: espaco.xl + (rodape ? 0 : insets.bottom) };
  return (
    <View style={{ flex: 1, backgroundColor: c.fundo }}>
      {semRolagem ? (
        <View style={[{ flex: 1 }, conteudo]}>{children}</View>
      ) : (
        <ScrollView
          contentContainerStyle={conteudo}
          keyboardShouldPersistTaps="handled"
          refreshControl={aoAtualizar ? <RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} /> : undefined}>
          {children}
        </ScrollView>
      )}
      {rodape ? (
        <View style={{ padding: espaco.m, paddingBottom: espaco.m + insets.bottom, borderTopWidth: 1, borderColor: c.borda, backgroundColor: c.superficie }}>
          {rodape}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------
// Botão — sempre com texto (nunca só ícone) e área de toque grande
// ---------------------------------------------------------------------
type BotaoProps = {
  titulo: string;
  aoTocar: () => void | Promise<void>;
  icone?: NomeIcone;
  tipo?: 'primario' | 'secundario' | 'perigo' | 'texto';
  desativado?: boolean;
  carregando?: boolean;
  dica?: string;
  style?: StyleProp<ViewStyle>;
};

export function Botao({ titulo, aoTocar, icone, tipo = 'primario', desativado, carregando, dica, style }: BotaoProps) {
  const { c, f, borda } = useTema();
  const [ocupado, setOcupado] = useState(false);
  const bloqueado = desativado || carregando || ocupado;
  const cores = {
    primario: { fundo: c.primaria, texto: c.sobrePrimaria, borda: c.primaria },
    secundario: { fundo: c.superficie, texto: c.primaria, borda: c.primaria },
    perigo: { fundo: c.superficie, texto: c.perigo, borda: c.perigo },
    texto: { fundo: 'transparent', texto: c.primaria, borda: 'transparent' },
  }[tipo];

  const tocar = async () => {
    if (bloqueado) return;
    setOcupado(true);
    try { await aoTocar(); } finally { setOcupado(false); }
  };

  return (
    <Pressable
      onPress={tocar}
      disabled={bloqueado}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint={dica}
      accessibilityState={{ disabled: bloqueado, busy: carregando || ocupado }}
      style={({ pressed }) => [
        {
          minHeight: ALVO_TOQUE,
          borderRadius: 14,
          paddingHorizontal: espaco.l,
          paddingVertical: espaco.s,
          backgroundColor: cores.fundo,
          borderWidth: tipo === 'texto' ? 0 : Math.max(2, borda),
          borderColor: cores.borda,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: espaco.s,
          opacity: bloqueado && !(carregando || ocupado) ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}>
      {carregando || ocupado ? (
        <ActivityIndicator color={cores.texto} />
      ) : icone ? (
        <Ionicons name={icone} size={f('subtitulo') + 2} color={cores.texto} />
      ) : null}
      <Text
        maxFontSizeMultiplier={MAX_MULT}
        style={{ color: cores.texto, fontSize: f('subtitulo') - 1, fontWeight: '700', textAlign: 'center', flexShrink: 1 }}>
        {titulo}
      </Text>
    </Pressable>
  );
}

/** Pergunta antes de ações importantes (pode ser desligado em Acessibilidade). */
export function confirmar(titulo: string, mensagem: string, acao: () => void, rotuloSim = 'Sim, confirmar') {
  Alert.alert(titulo, mensagem, [
    { text: 'Não, voltar', style: 'cancel' },
    { text: rotuloSim, onPress: acao },
  ]);
}

export function useConfirmar() {
  const { confirmarAcoes } = usePreferencias();
  return (titulo: string, mensagem: string, acao: () => void, rotuloSim?: string) =>
    confirmarAcoes ? confirmar(titulo, mensagem, acao, rotuloSim) : acao();
}

export function avisar(titulo: string, mensagem?: string) {
  Alert.alert(titulo, mensagem, [{ text: 'Entendi' }]);
}

// ---------------------------------------------------------------------
// Cartões e listas
// ---------------------------------------------------------------------
export function Cartao({
  children,
  aoTocar,
  destaque,
  style,
  rotulo,
}: {
  children: ReactNode;
  aoTocar?: () => void;
  destaque?: 'alerta' | 'perigo' | 'sucesso' | 'primaria';
  style?: StyleProp<ViewStyle>;
  rotulo?: string;
}) {
  const { c, borda } = useTema();
  const corBorda = destaque ? { alerta: c.alerta, perigo: c.perigo, sucesso: c.sucesso, primaria: c.primaria }[destaque] : c.borda;
  const fundo = destaque ? { alerta: c.alertaSuave, perigo: c.perigoSuave, sucesso: c.sucessoSuave, primaria: c.primariaSuave }[destaque] : c.superficie;
  const estilo: StyleProp<ViewStyle> = [
    { backgroundColor: fundo, borderRadius: 16, borderWidth: destaque ? 2 : borda, borderColor: corBorda, padding: espaco.m, gap: espaco.xs },
    style,
  ];
  if (!aoTocar) return <View style={estilo}>{children}</View>;
  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ pressed }) => [estilo, { opacity: pressed ? 0.8 : 1, minHeight: ALVO_TOQUE }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.s }}>
        <View style={{ flex: 1, gap: espaco.xs }}>{children}</View>
        <Ionicons name="chevron-forward" size={26} color={c.textoSuave} />
      </View>
    </Pressable>
  );
}

export function Selo({ texto, tipo = 'neutro' }: { texto: string; tipo?: 'neutro' | 'sucesso' | 'alerta' | 'perigo' | 'primaria' }) {
  const { c, f } = useTema();
  const cores = {
    neutro: [c.fundo, c.textoSuave],
    sucesso: [c.sucessoSuave, c.sucesso],
    alerta: [c.alertaSuave, c.alerta],
    perigo: [c.perigoSuave, c.perigo],
    primaria: [c.primariaSuave, c.primaria],
  }[tipo];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: cores[0], borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: cores[1] }}>
      <Text maxFontSizeMultiplier={MAX_MULT} style={{ color: cores[1], fontSize: f('pequeno'), fontWeight: '700' }}>{texto}</Text>
    </View>
  );
}

export function Linha({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: espaco.s, flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Vazio({ icone = 'leaf-outline', texto }: { icone?: NomeIcone; texto: string }) {
  const { c } = useTema();
  return (
    <View style={{ alignItems: 'center', padding: espaco.xl, gap: espaco.s }}>
      <Ionicons name={icone} size={48} color={c.textoSuave} />
      <Texto suave centro>{texto}</Texto>
    </View>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  const { c } = useTema();
  return (
    <View style={{ alignItems: 'center', padding: espaco.xl, gap: espaco.s }} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={c.primaria} />
      <Texto suave>{texto}</Texto>
    </View>
  );
}

export function Erro({ texto, aoTentar }: { texto: string; aoTentar?: () => void }) {
  return (
    <Cartao destaque="perigo">
      <Texto negrito>Não foi possível carregar</Texto>
      <Texto>{texto}</Texto>
      {aoTentar ? <Botao titulo="Tentar de novo" icone="refresh" tipo="secundario" aoTocar={aoTentar} /> : null}
    </Cartao>
  );
}

export function Progresso({ valor, cor }: { valor: number; cor?: string }) {
  const { c } = useTema();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: valor }}
      style={{ height: 14, borderRadius: 7, backgroundColor: c.fundo, borderWidth: 1, borderColor: c.borda, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, valor))}%`, height: '100%', backgroundColor: cor ?? c.primaria }} />
    </View>
  );
}

// ---------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------
export function Campo({
  rotulo,
  ajuda,
  valor,
  aoMudar,
  multilinha,
  ...resto
}: { rotulo: string; ajuda?: string; valor: string; aoMudar: (t: string) => void; multilinha?: boolean } & Omit<TextInputProps, 'value' | 'onChangeText'>) {
  const { c, f } = useTema();
  const [foco, setFoco] = useState(false);
  return (
    <View style={{ gap: espaco.xs }}>
      <Texto negrito>{rotulo}</Texto>
      {ajuda ? <Texto tamanho="pequeno" suave>{ajuda}</Texto> : null}
      <TextInput
        value={valor}
        onChangeText={aoMudar}
        accessibilityLabel={rotulo}
        accessibilityHint={ajuda}
        placeholderTextColor={c.textoSuave}
        maxFontSizeMultiplier={MAX_MULT}
        multiline={multilinha}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        style={{
          minHeight: multilinha ? 120 : ALVO_TOQUE,
          borderWidth: foco ? 3 : 2,
          borderColor: foco ? c.primaria : c.borda,
          borderRadius: 12,
          paddingHorizontal: espaco.m,
          paddingVertical: espaco.s,
          fontSize: f('texto'),
          color: c.texto,
          backgroundColor: c.superficie,
          textAlignVertical: multilinha ? 'top' : 'center',
        }}
        {...resto}
      />
    </View>
  );
}

/** Escolha única com botões grandes (substitui menus suspensos, difíceis para muita gente). */
export function Opcoes<T extends string>({
  rotulo,
  opcoes,
  valor,
  aoMudar,
}: {
  rotulo?: string;
  opcoes: { valor: T; nome: string }[];
  valor: T | null;
  aoMudar: (v: T) => void;
}) {
  const { c, f } = useTema();
  return (
    <View style={{ gap: espaco.xs }} accessibilityRole="radiogroup" accessibilityLabel={rotulo}>
      {rotulo ? <Texto negrito>{rotulo}</Texto> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s }}>
        {opcoes.map((o) => {
          const sel = o.valor === valor;
          return (
            <Pressable
              key={o.valor}
              onPress={() => aoMudar(o.valor)}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel, checked: sel }}
              accessibilityLabel={o.nome}
              style={{
                minHeight: 50,
                paddingHorizontal: espaco.m,
                borderRadius: 25,
                borderWidth: 2,
                borderColor: sel ? c.primaria : c.borda,
                backgroundColor: sel ? c.primaria : c.superficie,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}>
              {sel ? <Ionicons name="checkmark" size={20} color={c.sobrePrimaria} /> : null}
              <Text maxFontSizeMultiplier={MAX_MULT} style={{ fontSize: f('texto') - 1, fontWeight: '600', color: sel ? c.sobrePrimaria : c.texto }}>
                {o.nome}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Caixa de seleção grande (sim/não). */
export function Marcar({ rotulo, valor, aoMudar, ajuda }: { rotulo: string; valor: boolean; aoMudar: (v: boolean) => void; ajuda?: string }) {
  const { c } = useTema();
  return (
    <Pressable
      onPress={() => aoMudar(!valor)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: valor }}
      accessibilityLabel={rotulo}
      accessibilityHint={ajuda}
      style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.m, minHeight: ALVO_TOQUE, paddingVertical: espaco.xs }}>
      <View
        style={{
          width: 34, height: 34, borderRadius: 8, borderWidth: 3,
          borderColor: valor ? c.primaria : c.textoSuave,
          backgroundColor: valor ? c.primaria : c.superficie,
          alignItems: 'center', justifyContent: 'center',
        }}>
        {valor ? <Ionicons name="checkmark" size={24} color={c.sobrePrimaria} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Texto>{rotulo}</Texto>
        {ajuda ? <Texto tamanho="pequeno" suave>{ajuda}</Texto> : null}
      </View>
    </Pressable>
  );
}

/** Data: atalhos (Hoje, Amanhã…) + digitação dd/mm/aaaa. Evita calendários pequenos. */
export function CampoData({ rotulo, valor, aoMudar, atalhos = true }: { rotulo: string; valor: string | null; aoMudar: (iso: string | null) => void; atalhos?: boolean }) {
  const paraTexto = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');
  const [texto, setTexto] = useState(paraTexto(valor));
  // Se a data mudou por fora (ex.: atalho "Amanhã"), atualiza o texto digitado.
  const [anterior, setAnterior] = useState(valor);
  if (valor !== anterior) {
    setAnterior(valor);
    if (valor && valor !== lerData(texto)) setTexto(paraTexto(valor));
  }
  const hoje = new Date();
  const somar = (d: number) => isoData(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + d));
  return (
    <View style={{ gap: espaco.xs }}>
      {atalhos ? (
        <Opcoes
          rotulo={rotulo}
          valor={valor === somar(0) ? 'h' : valor === somar(1) ? 'a' : valor === somar(7) ? 's' : null}
          aoMudar={(v) => aoMudar(somar(v === 'h' ? 0 : v === 'a' ? 1 : 7))}
          opcoes={[{ valor: 'h', nome: 'Hoje' }, { valor: 'a', nome: 'Amanhã' }, { valor: 's', nome: 'Daqui 7 dias' }]}
        />
      ) : null}
      <Campo
        rotulo={atalhos ? 'Ou digite a data' : rotulo}
        ajuda="Formato: dia/mês/ano, por exemplo 25/12/2026"
        valor={texto}
        keyboardType="numbers-and-punctuation"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        aoMudar={(t) => {
          // Coloca as barras automaticamente
          const d = t.replace(/\D/g, '').slice(0, 8);
          const fmt = d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
          setTexto(fmt);
          aoMudar(lerData(fmt));
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------
// Leitura em voz alta (para quem tem dificuldade de leitura)
// ---------------------------------------------------------------------
export function BotaoOuvir({ texto }: { texto: string }) {
  const [falando, setFalando] = useState(false);
  useEffect(() => () => { Speech.stop(); }, []);
  return (
    <Botao
      tipo="secundario"
      icone={falando ? 'stop-circle-outline' : 'volume-high-outline'}
      titulo={falando ? 'Parar de ouvir' : 'Ouvir em voz alta'}
      aoTocar={() => {
        if (falando) { Speech.stop(); setFalando(false); return; }
        setFalando(true);
        Speech.speak(texto, { language: 'pt-BR', rate: 0.9, onDone: () => setFalando(false), onStopped: () => setFalando(false), onError: () => setFalando(false) });
      }}
    />
  );
}

// ---------------------------------------------------------------------
// Ladrilho grande da tela inicial
// ---------------------------------------------------------------------
export function Ladrilho({ titulo, icone, aoTocar, cor, contador }: { titulo: string; icone: NomeIcone; aoTocar: () => void; cor?: string; contador?: number }) {
  const { c, f, borda } = useTema();
  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="button"
      accessibilityLabel={contador ? `${titulo}, ${contador} novidade${contador > 1 ? 's' : ''}` : titulo}
      style={({ pressed }) => ({
        flexBasis: '47%', flexGrow: 1, minHeight: 112, borderRadius: 18, padding: espaco.m,
        backgroundColor: c.superficie, borderWidth: borda, borderColor: c.borda,
        justifyContent: 'space-between', opacity: pressed ? 0.8 : 1,
      })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Ionicons name={icone} size={34} color={cor ?? c.primaria} />
        {contador ? (
          <View style={{ minWidth: 30, height: 30, borderRadius: 15, backgroundColor: c.perigo, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{contador}</Text>
          </View>
        ) : null}
      </View>
      <Text maxFontSizeMultiplier={1.4} style={{ fontSize: f('texto'), fontWeight: '700', color: c.texto, marginTop: espaco.s }}>{titulo}</Text>
    </Pressable>
  );
}
