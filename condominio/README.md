# Vizinhar

Aplicativo (iOS e Android) de gestão e comunicação para condomínios, organizado nas quatro dimensões do plano de gestão — **financeira, operacional, comunidade e desenvolvimento** — com cuidado especial para **moradores idosos** e para a **LGPD**.

> Nome provisório. Antes de publicar, veja [`docs/PROPRIEDADE-INTELECTUAL.md`](docs/PROPRIEDADE-INTELECTUAL.md).

## O que o app faz

| Dimensão | Para o morador | Para a gestão |
|---|---|---|
| **Finanças** (transparência total) | Saúde financeira (dinheiro em caixa, resultado do ano, inadimplência, orçamento usado), mês a mês, despesas e receitas por categoria, notas fiscais de cada pagamento, extratos e saldos, orçamento previsto × realizado, balancetes, pareceres do conselho, contratos, seguro e laudos, “Meus boletos” com Pix | Lançar receitas/despesas com nota, registrar saldos e extratos (com proteção LGPD), cadastrar orçamento, publicar documentos por classificação, gerar cobranças |
| **Dia a dia** (operacional) | Quem está de plantão agora, comunicados de serviço, avisar a portaria sobre visitas/prestadores/entregas, autorizar pelo app quem chegou sem aviso, encomendas, ocorrências com foto, reservas, manutenções | Portaria: painel com esperados do dia, “chegou alguém sem aviso” (pergunta ao morador), registro de encomendas e comunicados. Gestão: escala da equipe, ocorrências, reservas, manutenções |
| **Comunidade** | Avisos (com “Ouvir em voz alta”), enquetes com voto secreto por unidade, classificados entre vizinhos, telefones úteis e de emergência | Publicar avisos com notificação, ver quantos leram, criar enquetes |
| **Desenvolvimento** | Plano de gestão aberto com andamento de cada projeto, ideias com apoios, documentos (convenção, atas, balancetes) | Cadastrar projetos e processos por dimensão, atualizar andamento, responder ideias, publicar documentos |

Painel da gestão: adesão ao app, pendências, inadimplência, andamento do plano, unidades e **cartões impressos com códigos de acesso**, moradores e funções, pedidos LGPD e registro de alterações.

## Tecnologia

- **Expo SDK 58 / React Native** (um código para iOS e Android), Expo Router, TypeScript.
- **Supabase**: login por código no e-mail, Postgres com Row Level Security, Storage privado, Edge Functions (notificações e exclusão de conta).
- Sem bibliotecas de analytics ou propaganda.

```
src/app/                 telas (cada arquivo é uma rota)
  entrar, consentimento, vincular   primeiro acesso
  (app)/(abas)/          Início, Avisos, Finanças, Mais
  (app)/...              chamados, reservas, encomendas, manutenções, enquetes,
                         classificados, plano, sugestões, documentos, gestão…
src/components/ui.tsx    componentes acessíveis (letra ajustável, botões grandes, Ouvir)
src/lib/                 sessão, tema, preferências, formatação, Supabase
src/legal/textos.ts      Termos de Uso e Política de Privacidade (versionados)
supabase/migrations/     banco, regras de acesso, modelo inicial
supabase/functions/      notificar, excluir-conta
supabase/testes/         testes automáticos das regras de acesso
docs/                    LGPD, propriedade intelectual, acessibilidade, escala
```

## Como colocar no ar

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) **na região South America (São Paulo)**.
2. Rode as migrações, em ordem, no *SQL Editor* (ou `npx supabase db push` com o CLI):
   `20261124000001_estrutura.sql` → `20261124000002_seguranca.sql` → `20261124000003_modelo_inicial.sql` → `20261124000004_transparencia_dia_a_dia.sql`.
3. **E-mail com código** (*Authentication → Email Templates → Magic Link*): troque o conteúdo para mostrar o código, por exemplo:
   ```html
   <h2>Seu código de acesso</h2>
   <p style="font-size:32px;letter-spacing:6px"><b>{{ .Token }}</b></p>
   <p>Digite este código no aplicativo. Ele vale por 1 hora.</p>
   ```
4. **SMTP próprio** (*Authentication → SMTP Settings*): o envio padrão do Supabase é limitado e só serve para testes. Configure um provedor de e-mail transacional antes de convidar as 72 unidades.
5. Funções de servidor:
   ```bash
   npx supabase functions deploy excluir-conta notificar
   ```
6. Limpeza automática (LGPD): em *Database → Extensions*, ative `pg_cron` e rode:
   ```sql
   select cron.schedule('limpeza-lgpd', '0 4 * * 0', 'select public.limpar_dados_antigos()');
   ```

### 2. App

```bash
cd condominio
cp .env.example .env      # cole a Project URL e a anon key (Settings → API)
npm install
npx expo start            # abre no celular com o app Expo Go (QR code)
```

Notificações push exigem um *development build* (`npx eas-cli@latest build --profile development`) e o `projectId` do EAS em `app.json → extra.eas.projectId` (preenchido ao rodar `npx eas-cli@latest init`).

### 3. Publicar nas lojas

```bash
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform ios
npx eas-cli@latest submit --platform android
```
Antes: trocar o identificador `br.com.vizinhar.app` (em `app.json`) pelo definitivo, preencher titular em `src/lib/marca.ts` e `LICENSE`, e preencher os formulários de privacidade das lojas (ver `docs/LGPD.md`).

### 4. Primeiro uso (síndica)

1. Instale, entre com o e-mail e toque em **“Sou síndico(a) e quero cadastrar meu condomínio”**.
2. *Painel da gestão → Unidades*: digite as unidades (ex.: `101-104, 201-204, …` ou `A: 1-36, B: 1-36`) e toque **Cadastrar**.
3. **Imprimir cartões**: sai um PDF com um cartão por unidade, com o código e o passo a passo.
4. Ajuste o **Plano de gestão** (já vem com exemplos nas 4 dimensões), áreas comuns, manutenções e telefones úteis.
5. Entregue os cartões e faça um mutirão de instalação (ver `docs/ACESSIBILIDADE.md`).
6. Em *Moradores*, defina quem é subsíndico, conselheiro ou portaria.

## Qualidade

```bash
npm run typecheck     # TypeScript
npm run lint          # ESLint (regras do Expo + React Compiler)
npm run test:banco    # testa as regras de acesso do banco em um Postgres embutido (PGlite)
```

## Documentos

- [LGPD](docs/LGPD.md) — papéis, inventário de dados, medidas técnicas, checklist
- [Propriedade intelectual e registro](docs/PROPRIEDADE-INTELECTUAL.md) — INPI (software e marca), conflito de interesses, empresa
- [Modelo de licença para o condomínio](docs/MODELO-LICENCA-CONDOMINIO.md)
- [Acessibilidade e idosos](docs/ACESSIBILIDADE.md)
- [Escalar para outros condomínios](docs/ESCALA.md)

---
© 2026 — Todos os direitos reservados. Software proprietário (ver [LICENSE](LICENSE)).
