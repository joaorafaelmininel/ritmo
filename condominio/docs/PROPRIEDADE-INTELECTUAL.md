# Propriedade intelectual e registro do Vizinhar

> Guia prático para proteger o app desde o primeiro condomínio. **Não substitui orientação de advogado(a)** — leve este documento para uma consulta antes de vender o app para outros condomínios.

## 0. Urgente: o repositório está público

O repositório `joaorafaelmininel/ritmo` no GitHub está **público**. Qualquer pessoa pode ver e copiar o código.
O direito autoral continua existindo, mas fica muito mais difícil provar e impedir uma cópia.

**Faça agora:** GitHub → repositório → *Settings* → *General* → *Danger Zone* → **Change visibility → Private**.
Melhor ainda: mover a pasta `condominio/` para um **repositório privado próprio** (ex.: `vizinhar`), separado do app pessoal Ritmo.

## 1. Quem é o dono do app

- No Brasil, o software é protegido **desde a criação**, sem precisar de registro (Lei 9.609/1998, art. 2º, §3º). O registro serve como **prova** de autoria e data.
- O titular é quem criou (ou quem contratou/empregou o criador — art. 4º). Por isso:
  - **O condomínio não pode pagar pelo desenvolvimento.** Se pagar, ele pode reivindicar a titularidade (art. 4º). Deixe por escrito que o app foi desenvolvido por iniciativa e às custas de vocês.
  - Custos de infraestrutura (Supabase, conta Apple/Google) também devem sair de vocês (ou da empresa de vocês), não do caixa do condomínio — a não ser que haja contrato e aprovação em assembleia.
- **Regime de bens:** os direitos patrimoniais de autor, em regra, **não se comunicam** entre cônjuges, salvo pacto antenupcial (Lei 9.610/1998, art. 39) — os *rendimentos* sim. Se os dois contribuíram para a criação (ex.: sua esposa desenhou os processos do plano de gestão que viraram funcionalidades), considerem registrar os **dois como autores/titulares**.

### Uso de IA no desenvolvimento

O código foi escrito com auxílio de IA (Claude). Pontos de atenção:

- A lei brasileira exige autor **humano**. Guardem provas da contribuição criativa de vocês: o plano de gestão, as decisões de produto, os requisitos (LGPD, idosos), as revisões e mudanças. O histórico do git e esta conversa ajudam.
- Os termos de uso da Anthropic atribuem ao usuário os direitos sobre o conteúdo gerado — confira a versão vigente dos termos aplicáveis à sua conta.
- Revisem e personalizem o código ao longo do tempo: cada alteração de vocês reforça a autoria.

## 2. Conflito de interesses (síndica × fornecedor do app)

Como a síndica é casada com o titular do app, é essencial transparência:

1. **Apresentem o app em assembleia** (ou ao conselho) e registrem em ata: quem é o titular, que o uso é **gratuito** para o condomínio, e que os dados pertencem ao condomínio.
2. Assinem um **contrato de licença de uso** (modelo em [`MODELO-LICENCA-CONDOMINIO.md`](MODELO-LICENCA-CONDOMINIO.md)) com cláusulas de proteção de dados (o condomínio é *controlador*; vocês são *operador*).
3. Qualquer cobrança futura ao próprio condomínio deve ser aprovada em assembleia, com a síndica se declarando impedida de votar/conduzir essa pauta.
4. Garantam a **saída**: se o condomínio deixar de usar o app, ele recebe uma exportação completa dos dados.

## 3. Registro do programa de computador no INPI

| Item | Como é |
|---|---|
| Onde | Sistema **e-Software** do INPI (gov.br/inpi) — 100% on-line |
| O que se envia | **Não** se envia o código: apenas o **hash SHA-512** do código-fonte + dados do programa |
| Prazo de proteção | 50 anos, contados de 1º de janeiro do ano seguinte à publicação/criação (art. 2º, §2º) |
| Tempo de emissão | Certificado em poucos dias úteis após o pedido completo |
| Custo | Taxa única via GRU (serviço de registro de programa de computador), com **desconto para pessoa física, MEI, ME, EPP**. Confira o valor na tabela de retribuições vigente |

**Passo a passo**

1. Crie login no e-INPI e emita a GRU do serviço de registro de programa de computador. Pague.
2. Torne o repositório privado e gere o pacote + hash:
   ```bash
   cd condominio
   node scripts/hash-inpi.mjs
   ```
   O script cria `registro-inpi/vizinhar-<versão>-<data>.zip` e o arquivo `.sha512.txt` com o hash.
3. **Guarde o .zip intacto** em dois lugares (pendrive + nuvem). Se um dia houver disputa, esse arquivo, com o mesmo hash, prova o que foi registrado.
4. No e-Software, preencha: título (“Vizinhar”), data de criação (primeiro commit: 24/11/2026), autores, titular, linguagens (TypeScript, SQL), campo de aplicação (administração/gestão; comunicação) e tipo (aplicativo).
5. Assine a **Declaração de Veracidade** digitalmente (certificado ICP-Brasil; verifique se o INPI já aceita assinatura gov.br) e anexe.
6. Para versões grandes no futuro, é possível registrar como “programa derivado”.

## 4. Marca “Vizinhar”

“Vizinhar” é um **nome provisório**. Antes de investir em logo, domínio e lojas:

1. **Busca prévia** no INPI (busca.inpi.gov.br → Marcas), por nome exato e semelhantes, nas classes abaixo. Procure também nas lojas de apps, no registro.br e no Instagram.
2. Nomes muito descritivos (“Condomínio Fácil”, “App do Condomínio”) costumam ser negados (Lei 9.279/1996, art. 124, VI). Nomes inventados são mais fortes.
3. Classes de Nice sugeridas:
   - **9** — aplicativo/software baixável
   - **42** — software como serviço (SaaS), desenvolvimento de software
   - **36** — administração de condomínios/imóveis (se pretenderem oferecer serviços de administração)
   - **35** — gestão de negócios (opcional)
4. Depositem primeiro a marca **nominativa** (só o nome); a **mista** (nome + logo) pode vir depois.
5. Prazo médio até a concessão: de 1 a 2 anos. O depósito já garante prioridade.
6. Se mudarem o nome, troque em `src/lib/marca.ts` e `app.json`.

Registrem também o domínio (ex.: `vizinhar.com.br` ou `vizinhar.app.br`) e os perfis em redes sociais.

## 5. Antes de escalar para outros condomínios

1. **Abram uma empresa** (consulte um contador: a atividade de desenvolvimento de software tem restrições de enquadramento em alguns regimes, como o MEI).
2. Façam um **contrato de cessão de direitos patrimoniais** de vocês (autores) para a empresa, e registrem/averbem no INPI em nome da empresa.
3. Contratem advogado(a) para revisar: Termos de Uso, Política de Privacidade (`src/legal/textos.ts`), contrato com condomínios e acordo de tratamento de dados.
4. Para qualquer pessoa que ajudar no código (freelancer, amigo), exijam contrato com cessão de direitos **antes** de começar.

## 6. Componentes de terceiros

O app usa bibliotecas de código aberto com licenças permissivas (MIT/Apache) — compatíveis com software fechado. Basta manter os avisos de copyright (arquivo [`TERCEIROS.md`](../TERCEIROS.md)). Evitem incluir bibliotecas com licença **GPL/AGPL**, que podem obrigar a abrir o código.

## Checklist

- [ ] Repositório privado (ou movido para repositório próprio privado)
- [ ] Preencher titular em `LICENSE` e `src/lib/marca.ts`
- [ ] Busca de marca no INPI + domínio
- [ ] Registro do software no INPI (`node scripts/hash-inpi.mjs`)
- [ ] Depósito da marca (classes 9 e 42, no mínimo)
- [ ] Apresentação em assembleia + contrato de licença com o condomínio
- [ ] Revisão jurídica dos textos legais
- [ ] Empresa + cessão de direitos (antes do 2º condomínio)
