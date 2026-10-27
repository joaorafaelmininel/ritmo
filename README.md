# Ritmo

Assistente pessoal para usar no celular (web app instalável na tela inicial): treinos, alimentação, finanças, tarefas, perfumes e estudos. Funciona para uma pessoa só ou para quem divide a casa — cada um com seu login, compartilhando os dados por um código de convite.

| Módulo | O que faz |
|---|---|
| 💪 **Treinos** | Você monta os treinos (exercícios, séries, repetições, carga, descanso, dicas) e escolhe para quem e em quais dias. Durante o treino o app tem cronômetro, marcação de cada série, contagem de descanso com vibração, e no final pergunta: **realizou?**, **quanto cansou?**, **como se sentiu?** e **quanto tempo levou** (já preenchido pelo cronômetro). |
| 🥗 **Dieta** | Refeições do dia por tipo (café, almoço…), como se sentiu depois, se estava dentro do plano, e copos de água com meta diária. |
| 💸 **Gastos** | Lançamento com valor, categoria, data, forma de pagamento e quem pagou, com **foto da nota fiscal** opcional guardada junto do gasto. Resumo do mês por categoria e por quem pagou. |
| 🗓️ **Atividades** | Tarefas e compromissos com data, horário, categoria e responsável (um, outro ou os dois). Atrasadas, hoje, próximos dias. |
| 🌸 **Perfumes** | Coleção (marca, concentração, família olfativa, notas, favoritos, lista de desejos) e o diário **"qual perfume você usou hoje?"** com ocasião, clima, nota e se recebeu elogio. Resumo com mais usados, campeão de elogios e perfumes esquecidos na prateleira. |
| 📚 **Estudos** | Registro de estudo de idiomas (cronômetro "Estudar agora" ou registro manual), meta semanal, sequência de dias, gráfico da semana, tempo por idioma e **flashcards de vocabulário** com repetição espaçada (caixas de Leitner). |

## Tecnologia

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Visual: Geist nos títulos e números, Inter na interface (fontes embutidas, sem depender do Google Fonts) e ícones Lucide
- Supabase: login, banco Postgres com Row Level Security (cada casa só enxerga os próprios dados) e Storage privado para as fotos das notas

## Como colocar no ar

### 1. Supabase

1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. Em **SQL Editor → New query**, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Em **Authentication → URL Configuration**, coloque a URL do site (ex.: `https://ritmo.vercel.app`) em *Site URL*.
   Se preferir não confirmar e-mail no cadastro, desative em **Authentication → Providers → Email → Confirm email**.
4. Em **Settings → API**, copie a *Project URL* e a chave *anon public*.

### 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 3. Rodar / publicar

```bash
npm install
npm run dev        # http://localhost:3000
```

Para publicar, importe o repositório na [Vercel](https://vercel.com) e cadastre as mesmas duas variáveis de ambiente.

### 4. Instalar no celular

- **iPhone (Safari):** abra o site → botão Compartilhar → **Adicionar à Tela de Início**.
- **Android (Chrome):** menu ⋮ → **Instalar app**.

### 5. Primeiro uso

1. Você cria a conta, cria a casa e vai em **Mais → Perfil** para ver o **código de convite**.
2. Quem for participar cria a própria conta e digita o código. Pronto, vocês estão na mesma casa.
3. Em **Treinos → Novo treino**, monte o treino e escolha para quem é. No celular dessa pessoa o treino aparece com o botão **Iniciar**.

## Estrutura

```
supabase/schema.sql          tabelas, políticas RLS, funções de convite e bucket das notas
src/app/(app)/               telas do app (início, treinos, gastos, dieta, atividades, perfumes, estudos, perfil)
src/components/              componentes de interface e contexto da casa
src/lib/                     tipos, constantes, formatação e clientes do Supabase
```
