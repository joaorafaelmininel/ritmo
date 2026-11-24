import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

// Preferências de leitura ficam só no aparelho (não são enviadas ao servidor).
export const ESCALAS = [
  { valor: 1, nome: 'Normal' },
  { valor: 1.15, nome: 'Grande' },
  { valor: 1.3, nome: 'Muito grande' },
  { valor: 1.5, nome: 'Enorme' },
] as const;

type Prefs = {
  escala: number;
  contraste: boolean;
  confirmarAcoes: boolean;
  definir: (p: Partial<Omit<Prefs, 'definir'>>) => void;
};

const Ctx = createContext<Prefs>({ escala: 1.15, contraste: false, confirmarAcoes: true, definir: () => {} });
const CHAVE = 'vizinhar:preferencias';

export function PreferenciasProvider({ children }: { children: ReactNode }) {
  // Começa em "Grande": o público inclui muitas pessoas idosas.
  const [estado, setEstado] = useState({ escala: 1.15, contraste: false, confirmarAcoes: true });

  useEffect(() => {
    AsyncStorage.getItem(CHAVE).then((v) => {
      if (v) setEstado((e) => ({ ...e, ...JSON.parse(v) }));
    });
  }, []);

  const definir: Prefs['definir'] = (p) => {
    setEstado((e) => {
      const novo = { ...e, ...p };
      AsyncStorage.setItem(CHAVE, JSON.stringify(novo));
      return novo;
    });
  };

  return <Ctx.Provider value={{ ...estado, definir }}>{children}</Ctx.Provider>;
}

export const usePreferencias = () => useContext(Ctx);
