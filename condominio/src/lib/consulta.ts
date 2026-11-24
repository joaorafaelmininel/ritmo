import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { mensagemErro } from './supabase';

type Resposta<T> = PromiseLike<{ data: T | null; error: unknown }>;

/**
 * Carrega dados sempre que a tela volta a ficar visível
 * (assim a lista já aparece atualizada depois de salvar algo em outra tela).
 * `deps`: valores que, ao mudar, exigem nova busca (ex.: mês escolhido).
 */
export function useConsulta<T>(buscar: () => Resposta<T>, deps: unknown[] = []) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);
  const chave = JSON.stringify(deps);

  // Sempre a versão mais recente da função de busca, sem refazer o efeito a cada render.
  const buscarRef = useRef(buscar);
  useLayoutEffect(() => {
    buscarRef.current = buscar;
  });

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      Promise.resolve(buscarRef.current()).then(
        ({ data, error }) => {
          if (!ativo) return;
          if (error) setErro(mensagemErro(error));
          else { setErro(null); setDados(data); }
          setCarregando(false);
        },
        (e: unknown) => {
          if (!ativo) return;
          setErro(mensagemErro(e));
          setCarregando(false);
        },
      );
      return () => { ativo = false; };
    }, [chave, versao]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const recarregar = useCallback(() => {
    setCarregando(true);
    setVersao((v) => v + 1);
  }, []);

  return { dados, erro, carregando, recarregar };
}
