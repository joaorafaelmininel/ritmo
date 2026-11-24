import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '@/legal/textos';
import { definirFormatoUnidade } from './formato';
import { supabase } from './supabase';
import type { Membro, Papel } from './tipos';

type Estado = {
  carregando: boolean;
  sessao: Session | null;
  nome: string;
  consentiu: boolean;
  vinculos: Membro[];
  membro: Membro | null; // vínculo ativo
  papel: Papel | null;
  eGestor: boolean;
  eConselho: boolean;
  ePortaria: boolean;
  condominioId: string;
  recarregar: () => Promise<void>;
  escolherCondominio: (id: string) => void;
  sair: () => Promise<void>;
};

const Ctx = createContext<Estado>(null as unknown as Estado);
const CHAVE_CONDO = 'vizinhar:condominio';

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState('');
  const [consentiu, setConsentiu] = useState(false);
  const [vinculos, setVinculos] = useState<Membro[]>([]);
  const [ativo, setAtivo] = useState<string | null>(null);

  const carregarDados = useCallback(async (s: Session | null) => {
    if (!s) {
      setNome(''); setConsentiu(false); setVinculos([]);
      setCarregando(false);
      return;
    }
    const uid = s.user.id;
    const [perfil, consent, membros, salvo] = await Promise.all([
      supabase.from('perfis').select('nome').eq('id', uid).maybeSingle(),
      supabase.from('consentimentos').select('documento, versao').eq('perfil_id', uid).eq('aceito', true),
      supabase.from('membros')
        .select('id, condominio_id, unidade_id, papel, vinculo, telefone, criado_em, condominios(id, nome, cidade, uf, contato_privacidade, formato_unidade), unidades(id, bloco, numero)')
        .eq('perfil_id', uid).eq('ativo', true),
      AsyncStorage.getItem(CHAVE_CONDO),
    ]);
    setNome(perfil.data?.nome ?? '');
    const docs = consent.data ?? [];
    setConsentiu(
      docs.some((d) => d.documento === 'termos' && d.versao === VERSAO_TERMOS) &&
      docs.some((d) => d.documento === 'privacidade' && d.versao === VERSAO_PRIVACIDADE),
    );
    const lista = (membros.data ?? []) as unknown as Membro[];
    setVinculos(lista);
    setAtivo(lista.find((m) => m.condominio_id === salvo)?.condominio_id ?? lista[0]?.condominio_id ?? null);
    setCarregando(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      carregarDados(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      setSessao(s);
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT' || evento === 'USER_DELETED' as string) carregarDados(s);
    });
    return () => data.subscription.unsubscribe();
  }, [carregarDados]);

  const membro = vinculos.find((v) => v.condominio_id === ativo) ?? null;
  // Nomes das unidades seguem o formato do condomínio ativo (ex.: Quadra 8 · Lote 1)
  definirFormatoUnidade(membro?.condominios.formato_unidade);
  const papel = membro?.papel ?? null;

  const valor = useMemo<Estado>(() => ({
    carregando,
    sessao,
    nome,
    consentiu,
    vinculos,
    membro,
    papel,
    eGestor: papel === 'sindico' || papel === 'subsindico' || papel === 'administracao',
    eConselho: papel === 'sindico' || papel === 'subsindico' || papel === 'administracao' || papel === 'conselheiro',
    ePortaria: papel === 'sindico' || papel === 'subsindico' || papel === 'administracao' || papel === 'portaria',
    condominioId: membro?.condominio_id ?? '',
    recarregar: () => carregarDados(sessao),
    escolherCondominio: (id) => { setAtivo(id); AsyncStorage.setItem(CHAVE_CONDO, id); },
    sair: async () => { await supabase.auth.signOut(); },
  }), [carregando, sessao, nome, consentiu, vinculos, membro, papel, carregarDados]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useSessao = () => useContext(Ctx);
