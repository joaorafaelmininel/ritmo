import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const dir = process.argv[2] ?? new URL("../migrations", import.meta.url).pathname;
const db = new PGlite();
const stripExt = s => s.replace('create extension if not exists pgcrypto;', '');
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema storage;
create table auth.users (id uuid primary key, email text, phone text, created_at timestamptz default now(), last_sign_in_at timestamptz, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text);
alter table storage.objects enable row level security;
grant usage on schema public, auth, storage to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
alter default privileges in schema public grant all on functions to authenticated, anon;
alter default privileges in schema public grant all on sequences to authenticated, anon;
grant select, insert, delete on storage.objects to authenticated;
`);
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
for (let pass = 1; pass <= 2; pass++) for (const f of files) {
  try { await db.exec(stripExt(fs.readFileSync(dir + '/' + f, 'utf8'))); } catch (e) { console.error('ERRO', pass, f, e.message); process.exit(1); }
}
console.log('migrations ok (2x)');
const A='00000000-0000-0000-0000-00000000000a', B='00000000-0000-0000-0000-00000000000b', C='00000000-0000-0000-0000-00000000000c';
await db.exec(`insert into auth.users (id,email,raw_user_meta_data) values ('${A}','a@x','{"nome":"Síndica"}'),('${B}','b@x','{"nome":"Dona Maria"}'),('${C}','c@x','{}')`);
async function as(u, sql, params=[]) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${u}',false); set role authenticated;`);
  try { const r = await db.query(sql, params); return r.rows; } catch (e) { return { erro: e.message }; } finally { await db.exec('reset role'); }
}
let falhas = 0;
const log = (t, v, checar) => {
  const deveFalhar = /\(falha\)|\(deve falhar\)/.test(t);
  let passou = deveFalhar ? !!v?.erro : !v?.erro;
  if (passou && checar) passou = checar(v);
  if (!passou) falhas++;
  console.log(passou ? '✓' : '✗', t.padEnd(42), JSON.stringify(v).slice(0, 160));
};
const n = (v) => Number(v?.[0]?.count ?? v?.[0]?.n);
const [{ c }] = await as(A, `select criar_condominio('Residencial Teste','Jardinópolis','sp') c`);
log('condo', c);
const lista = Array.from({length: 72}, (_, i) => String(101 + (i%4) + Math.floor(i/4)*10));
log('criar_unidades', await as(A, `select criar_unidades($1, $2) n`, [c, lista]));
const cods = await as(A, `select * from unidades_com_codigo($1)`, [c]);
log('unidades c/ codigo', cods.length);
log('A projetos/manut/areas', await as(A, `select (select count(*) from projetos) p, (select count(*) from manutencoes) m, (select count(*) from areas_comuns) a`));
log('B entra', await as(B, `select entrar_com_codigo($1) x`, [cods[0].codigo_acesso.toLowerCase()]));
log('C entra', await as(C, `select entrar_com_codigo($1, 'inquilino') x`, [cods[1].codigo_acesso]));
log('C código errado (falha)', await as(C, `select entrar_com_codigo('XXXX') x`));
log('C troca unidade c/ código', await as(C, `select entrar_com_codigo($1, 'inquilino') x`, [cods[2].codigo_acesso]));
log('B lê código (deve falhar)', await as(B, `select codigo_acesso from unidades limit 1`));
log('B lê unidades', (await as(B, `select id, numero from unidades`)).length);
log('B unidades_com_codigo (falha)', await as(B, `select * from unidades_com_codigo($1)`, [c]));
log('B vira síndico (falha)', await as(B, `update membros set papel='sindico' where perfil_id=auth.uid() returning papel`));
log('B muda telefone', await as(B, `update membros set telefone='16 99999' where perfil_id=auth.uid() returning telefone`));
log('B vê membros', await as(B, `select count(*) from membros`), (v) => n(v) === 1);
log('A vê membros', await as(A, `select count(*) from membros`), (v) => n(v) === 3);
log('B vê nome de A', await as(B, `select nome from perfis`));
// avisos
log('B publica aviso (falha)', await as(B, `insert into avisos (condominio_id,titulo,corpo) values ($1,'x','y') returning id`, [c]));
const [av] = await as(A, `insert into avisos (condominio_id,titulo,corpo) values ($1,'Água','Sem água amanhã') returning id`, [c]);
log('B marca leitura', await as(B, `insert into avisos_leituras (aviso_id) values ($1) returning lido_em is not null ok`, [av.id]));
log('A leituras', await as(A, `select leituras_aviso($1) n`, [av.id]));
// chamados
const ub = (await as(B, `select unidade_id from membros where perfil_id=auth.uid()`))[0].unidade_id;
const [ch] = await as(B, `insert into chamados (condominio_id,unidade_id,titulo,categoria) values ($1,$2,'Vizinho barulhento','barulho') returning id`, [c, ub]);
log('C vê chamado de B', await as(C, `select count(*) from chamados`), (v) => n(v) === 0);
log('A vê chamado', await as(A, `select count(*) from chamados`), (v) => n(v) === 1);
log('B muda status p/ resolvido (falha)', await as(B, `update chamados set status='resolvido' where id=$1 returning status`, [ch.id]));
log('A comenta com status', await as(A, `insert into chamados_atualizacoes (chamado_id,texto,status_novo) values ($1,'Vamos verificar','em_andamento') returning status_novo`, [ch.id]));
log('B comenta tentando status', await as(B, `insert into chamados_atualizacoes (chamado_id,texto,status_novo) values ($1,'Obrigada','resolvido') returning status_novo`, [ch.id]), (v) => v[0].status_novo === null);
log('status do chamado', await as(B, `select status from chamados where id=$1`, [ch.id]), (v) => v[0].status === 'em_andamento');
log('C comenta chamado alheio (falha)', await as(C, `insert into chamados_atualizacoes (chamado_id,texto) values ($1,'oi')`, [ch.id]));
// enquete
const [en] = await as(A, `insert into enquetes (condominio_id,titulo) values ($1,'Pintura') returning id`, [c]);
const ops = await as(A, `insert into enquete_opcoes (enquete_id,texto,ordem) values ($1,'Azul',1),($1,'Verde',2) returning id`, [en.id]);
log('B vota', await as(B, `select votar($1,$2)`, [en.id, ops[0].id]));
log('B troca voto', await as(B, `select votar($1,$2)`, [en.id, ops[1].id]));
log('C vota', await as(C, `select votar($1,$2)`, [en.id, ops[1].id]));
log('A vota sem unidade (falha)', await as(A, `select votar($1,$2)`, [en.id, ops[0].id]));
log('resultado (B)', await as(B, `select texto, votos, minha from resultado_enquete($1)`, [en.id]), (v) => v.find((r) => r.texto === 'Verde').votos == 2 && v.find((r) => r.texto === 'Verde').minha);
log('B lê votos direto', await as(B, `select count(*) from votos`), (v) => n(v) === 0);
// reservas
const [area] = await as(B, `select id from areas_comuns limit 1`);
log('B reserva', await as(B, `insert into reservas (condominio_id,area_id,unidade_id,data,status) values ($1,$2,$3,current_date+3,'confirmada') returning status`, [c, area.id, ub]), (v) => v[0].status === 'pendente');
const uc = (await as(C, `select unidade_id from membros where perfil_id=auth.uid()`))[0].unidade_id;
log('C reserva mesma data (falha)', await as(C, `insert into reservas (condominio_id,area_id,unidade_id,data) values ($1,$2,$3,current_date+3)`, [c, area.id, uc]));
log('C reserva p/ unidade de B (falha)', await as(C, `insert into reservas (condominio_id,area_id,unidade_id,data) values ($1,$2,$3,current_date+4)`, [c, area.id, ub]));
log('C datas ocupadas', await as(C, `select * from datas_ocupadas($1, current_date, current_date+30)`, [area.id]));
log('C vê reservas', await as(C, `select count(*) from reservas`), (v) => n(v) === 0);
log('B tenta confirmar própria (falha)', await as(B, `update reservas set status='confirmada' returning status`));
log('B cancela', await as(B, `update reservas set status='cancelada' returning status`));
// finanças
log('A cobrança B', await as(A, `insert into cobrancas (condominio_id,unidade_id,competencia,valor,vencimento) values ($1,$2,'2026-10-01',450,'2026-10-10'),($1,$3,'2026-10-01',450,'2026-12-10') returning id`, [c, ub, uc]));
log('C vê cobranças', await as(C, `select count(*) from cobrancas`), (v) => n(v) === 1);
log('C inadimplência', await as(C, `select * from resumo_inadimplencia($1)`, [c]), (v) => Number(v[0].unidades_em_atraso) === 1);
log('A lançamento', await as(A, `insert into lancamentos (condominio_id,tipo,categoria,descricao,valor) values ($1,'despesa','Água','Conta',812.5) returning valor`, [c]));
log('B vê lançamentos', await as(B, `select count(*) from lancamentos`));
log('B lança (falha)', await as(B, `insert into lancamentos (condominio_id,tipo,categoria,descricao,valor) values ($1,'receita','x','x',1)`, [c]));
log('B vê auditoria', await as(B, `select count(*) from auditoria`), (v) => n(v) === 0);
log('A vê auditoria', await as(A, `select count(*) from auditoria`), (v) => n(v) > 0);
// encomenda
const [enc] = await as(A, `insert into encomendas (condominio_id,unidade_id,descricao) values ($1,$2,'Caixa Mercado Livre') returning id`, [c, ub]);
log('B retira', await as(B, `update encomendas set retirada_em=now(), retirada_por='Maria', descricao='hack' where id=$1 returning descricao, retirada_por`, [enc.id]), (v) => v[0].descricao === 'Caixa Mercado Livre');
log('C vê encomendas', await as(C, `select count(*) from encomendas`), (v) => n(v) === 0);
// sugestões
const [sg] = await as(B, `insert into sugestoes (condominio_id,titulo) values ($1,'Bicicletário') returning id`, [c]);
log('C apoia', await as(C, `insert into sugestoes_apoios (sugestao_id) values ($1) returning 1`, [sg.id]));
log('B se aprova (ignorado)', await as(B, `update sugestoes set status='aceita' where id=$1 returning status`, [sg.id]), (v) => v[0].status === 'nova');
// manutenção
const [mt] = await as(A, `select id from manutencoes limit 1`);
log('A registra manutenção', await as(A, `insert into manutencoes_registros (manutencao_id, realizada_em) values ($1,'2026-11-01') returning 1`, [mt.id]));
log('próxima', await as(B, `select ultima_realizacao, proxima from manutencoes where id=$1`, [mt.id]));
// storage
log('B envia em chamados', await as(B, `insert into storage.objects (bucket_id,name,owner_id) values ('arquivos',$1,$2) returning name`, [`${c}/chamados/f.jpg`, B]));
log('B envia em documentos (falha)', await as(B, `insert into storage.objects (bucket_id,name,owner_id) values ('arquivos',$1,$2)`, [`${c}/documentos/f.pdf`, B]));
log('C lê foto do chamado de B', await as(C, `select count(*) from storage.objects`), (v) => n(v) === 0);
log('A lê foto', await as(A, `select count(*) from storage.objects`), (v) => n(v) === 1);
log('B meus_dados', await as(B, `select meus_dados() d`));
// --- Transparência financeira ---
log('A contas padrão', await as(A, `select count(*) from contas_bancarias`), (v) => n(v) === 2);
const [conta] = await as(A, `select id from contas_bancarias limit 1`);
log('A registra saldo', await as(A, `insert into saldos (condominio_id, conta_id, competencia, saldo_final) values ($1,$2,'2026-10-01',48250.10) returning saldo_final`, [c, conta.id]));
log('B vê saldos', await as(B, `select count(*) from saldos`), (v) => n(v) === 1);
log('B registra saldo (falha)', await as(B, `insert into saldos (condominio_id, conta_id, competencia, saldo_final) values ($1,$2,'2026-11-01',1)`, [c, conta.id]));
log('A balancete c/ competência', await as(A, `insert into documentos (condominio_id,titulo,categoria,arquivo_path,competencia) values ($1,'Balancete outubro','balancete','x','2026-10-01') returning categoria`, [c]));
// --- Dia a dia: portaria ---
await as(A, `update membros set papel='portaria' where perfil_id=$1`, [C]);
log('C (portaria) publica comunicado operacional', await as(C, `insert into avisos (condominio_id,titulo,corpo,categoria) values ($1,'Portão B','Usar portão A','operacional') returning id`, [c]));
log('C (portaria) aviso financeiro (falha)', await as(C, `insert into avisos (condominio_id,titulo,corpo,categoria) values ($1,'x','y','financeiro')`, [c]));
log('B avisa visita', await as(B, `insert into portaria (condominio_id,unidade_id,origem,tipo,nome,status) values ($1,$2,'morador','prestador','Pedreiro José','esperado') returning status`, [c, ub]));
log('B registra como portaria (falha)', await as(B, `insert into portaria (condominio_id,unidade_id,origem,nome,status) values ($1,$2,'portaria','X','na_portaria')`, [c, ub]));
const [vis] = await as(C, `insert into portaria (condominio_id,unidade_id,origem,tipo,nome,status) values ($1,$2,'portaria','visita','Sobrinha Ana','na_portaria') returning id`, [c, ub]);
log('Portaria vê registros', await as(C, `select count(*) from portaria`), (v) => n(v) === 2);
log('B autoriza visita', await as(B, `update portaria set status='autorizado' where id=$1 returning status, respondido_em is not null r`, [vis.id]), (v) => v[0].status === 'autorizado' && v[0].r);
log('B marca entrada (falha)', await as(B, `update portaria set status='entrou' where id=$1`, [vis.id]));
log('Portaria marca entrada', await as(C, `update portaria set status='entrou' where id=$1 returning status`, [vis.id]), (v) => v[0].status === 'entrou');
log('Gestão vê registros da portaria', await as(A, `select count(*) from portaria`), (v) => n(v) === 2);
log('A cadastra equipe', await as(A, `insert into equipe (condominio_id,nome,funcao,dias,hora_inicio,hora_fim) values ($1,'João','portaria','{0,1,2,3,4,5,6}','19:00','07:00') returning nome`, [c]));
log('B vê equipe', await as(B, `select count(*) from equipe`), (v) => n(v) === 1);
// --- Convivência: pets e prestadores ---
const [pet] = await as(B, `insert into pets (condominio_id,unidade_id,nome,especie,descricao) values ($1,$2,'Thor','cachorro','Caramelo, coleira azul') returning id`, [c, ub]);
log('B cadastra pet', pet ? [pet] : pet, (v) => !!v[0]?.id);
log('B cadastra pet em outra unidade (falha)', await as(B, `insert into pets (condominio_id,unidade_id,nome) values ($1,$2,'X')`, [c, uc]));
log('C vê pet de B', await as(C, `select count(*) from pets`), (v) => n(v) === 1);
log('C marca pet de B perdido (ignorado)', await as(C, `update pets set perdido=true where id=$1 returning id`, [pet.id]), (v) => v.length === 0);
log('B marca perdido', await as(B, `update pets set perdido=true where id=$1 returning perdido_desde is not null p`, [pet.id]), (v) => v[0].p);
log('C avisa que viu o pet', await as(C, `insert into pets_avistamentos (pet_id, local) values ($1,'No jardim da casa 210') returning 1`, [pet.id]));
log('B vê avistamento', await as(B, `select count(*) from pets_avistamentos`), (v) => n(v) === 1);
const [pr] = await as(C, `insert into prestadores (condominio_id,tipo,nome,telefone) values ($1,'Eletricista','Carlos','16999990000') returning id`, [c]);
log('B recomenda prestador', await as(B, `insert into prestadores_recomendacoes (prestador_id, comentario) values ($1,'Pontual e honesto') returning 1`, [pr.id]));
log('B edita prestador de C (ignorado)', await as(B, `update prestadores set nome='X' where id=$1 returning id`, [pr.id]), (v) => v.length === 0);
// --- Calendário anual ---
log('A ações padrão', await as(A, `select count(*) from acoes_planejadas`), (v) => n(v) === 7);
const [acao] = await as(A, `select id from acoes_planejadas where categoria='poda'`);
log('A conclui poda 2026', await as(A, `insert into acoes_execucoes (acao_id, ano, data) values ($1, 2026, '2026-06-15') returning status`, [acao.id]));
log('B conclui ação (falha)', await as(B, `insert into acoes_execucoes (acao_id, ano) values ($1, 2027)`, [acao.id]));
log('B vê calendário', await as(B, `select count(*) from acoes_execucoes`), (v) => n(v) === 1);
log('B envia foto de pet', await as(B, `insert into storage.objects (bucket_id,name,owner_id) values ('arquivos',$1,$2) returning name`, [`${c}/pets/thor.jpg`, B]));
// --- Vizinho solidário ---
const [aj] = await as(B, `insert into ajuda_pedidos (condominio_id,unidade_id,tipo,descricao) values ($1,$2,'farmacia','Buscar remédio') returning id`, [c, ub]);
log('B pede ajuda', aj ? [aj] : aj, (v) => !!v[0]?.id);
log('C lê unidade do pedido (falha)', await as(C, `select unidade_id from ajuda_pedidos`));
log('C aceita sem ser voluntário (ignorado)', await as(C, `update ajuda_pedidos set status='combinado' where id=$1 returning id`, [aj.id]), (v) => v.length === 0);
log('C vira voluntário', await as(C, `insert into voluntarios (condominio_id, habilidades) values ($1, '{farmacia}') returning 1`, [c]));
log('C aceita pedido', await as(C, `update ajuda_pedidos set status='combinado' where id=$1 returning voluntario_id`, [aj.id]), (v) => v[0].voluntario_id === C);
log('C vê contato após aceitar', await as(C, `select * from contato_ajuda($1)`, [aj.id]), (v) => v[0]?.unidade_pedido != null);
log('A (gestão) vê contato', await as(A, `select * from contato_ajuda($1)`, [aj.id]), (v) => v.length === 1);
// --- Achados ---
log('B publica achado', await as(B, `insert into achados (condominio_id,titulo,local) values ($1,'Chave com chaveiro azul','Piscina') returning status`, [c]));
// --- Fugas ---
log('Histórico de fuga criado', await as(B, `select count(*) from pets_fugas`), (v) => n(v) === 1);
log('B: pet voltou', await as(B, `update pets set perdido=false where id=$1 returning perdido`, [pet.id]));
log('Fuga encerrada', await as(B, `select fim is not null f from pets_fugas`), (v) => v[0].f);
// --- Equipamentos e coleta ---
log('A modelos padrão', await as(A, `select (select count(*) from equipamentos) e, (select count(*) from coletas) c, (select count(*) from metas) m`), (v) => Number(v[0].e) === 8 && Number(v[0].c) === 2 && Number(v[0].m) === 4);
log('C (portaria) atualiza equipamento', await as(C, `update equipamentos set status='manutencao', previsao='sexta' where nome='Bomba d''água' returning status`), (v) => v[0]?.status === 'manutencao');
log('B atualiza equipamento (ignorado)', await as(B, `update equipamentos set status='ok' returning id`), (v) => v.length === 0);
// --- Indicadores, prioridades ---
log('B vê indicadores', await as(B, `select indicadores($1) i`, [c]), (v) => v[0].i.adesao > 0);
const projs = await as(A, `select id from projetos limit 4`);
for (const p of projs.slice(0, 3)) await as(B, `insert into projetos_prioridades (projeto_id, unidade_id) values ($1,$2)`, [p.id, ub]);
log('B 4ª prioridade (falha)', await as(B, `insert into projetos_prioridades (projeto_id, unidade_id) values ($1,$2)`, [projs[3].id, ub]));
log('C não vê votos de B', await as(C, `select count(*) from projetos_prioridades`), (v) => n(v) === 0);
log('Ranking agregado', await as(C, `select sum(votos) s from ranking_prioridades($1)`, [c]), (v) => Number(v[0].s) === 3);
log('Projeto concluído ganha data', await as(A, `update projetos set status='concluido' where id=$1 returning concluido_em is not null d, progresso`, [projs[0].id]), (v) => v[0].d && v[0].progresso === 100);
log('Resumo do período (morador)', await as(B, `select resumo_periodo($1, current_date - 90, current_date) r`, [c]), (v) => v[0].r.ocorrencias_registradas >= 1);
// --- Eventos ---
const [ev] = await as(B, `insert into eventos (condominio_id,titulo,inicio,tipo) values ($1,'Festa junina', now() + interval '10 days','festa') returning id`, [c]);
log('B organiza evento', ev ? [ev] : ev, (v) => !!v[0]?.id);
log('C confirma presença', await as(C, `insert into eventos_presencas (evento_id, unidade_id, adultos, criancas, rateio) values ($1,$2,2,3,true) returning criancas`, [ev.id, uc]));
log('C confirma por B (falha)', await as(C, `insert into eventos_presencas (evento_id, unidade_id) values ($1,$2)`, [ev.id, ub]));
const [tf] = await as(B, `insert into eventos_tarefas (evento_id, descricao) values ($1,'Bandeirinhas') returning id`, [ev.id]);
log('C cria tarefa em evento alheio (falha)', await as(C, `insert into eventos_tarefas (evento_id, descricao) values ($1,'X')`, [ev.id]));
log('C assume tarefa', await as(C, `update eventos_tarefas set responsavel_id=auth.uid() where id=$1 returning responsavel_id`, [tf.id]), (v) => v[0]?.responsavel_id === C);
log('A toma tarefa de C? (gestão pode)', await as(A, `update eventos_tarefas set responsavel_id=null where id=$1 returning id`, [tf.id]), (v) => v.length === 1);
// --- Falta de serviços ---
log('B relata falta de luz', await as(B, `select * from relatar_falta($1,'energia','meia fase')`, [c]), (v) => v[0].novo === true);
log('C relata a mesma falta', await as(C, `select * from relatar_falta($1,'energia','sem luz')`, [c]), (v) => v[0].novo === false && Number(v[0].relatos) === 2);
log('B atualiza incidente (ignorado)', await as(B, `update incidentes set status='resolvido' returning id`), (v) => v.length === 0);
log('Portaria registra protocolo', await as(C, `update incidentes set protocolo='CPFL 123', origem='concessionaria', status='resolvido' returning fim is not null f`), (v) => v[0]?.f);
// --- Manual, comissões, assembleia ---
await as(A, `select aplicar_manual_padrao($1)`, [c]);
log('A manual padrão', await as(B, `select count(*) from manual_secoes`), (v) => n(v) >= 8);
const [com] = await as(A, `insert into comissoes (condominio_id, nome) values ($1,'Obras') returning id`, [c]);
log('B entra na comissão', await as(B, `insert into comissoes_membros (comissao_id) values ($1) returning 1`, [com.id]));
log('B vira coordenador (falha)', await as(B, `insert into comissoes_membros (comissao_id, perfil_id, coordenador) values ($1, $2, true)`, [com.id, C]));
const [asm] = await as(A, `insert into assembleias (condominio_id, titulo, data) values ($1,'AGO 2026', now() + interval '20 days') returning id`, [c]);
const [it] = await as(A, `insert into assembleia_pauta (assembleia_id, ordem, titulo) values ($1,1,'Previsão orçamentária 2027') returning id`, [asm.id]);
log('B pergunta sobre item', await as(B, `insert into assembleia_perguntas (pauta_id, texto) values ($1,'Podem enviar a planilha?') returning id`, [it.id]));
log('B responde a própria pergunta (ignorado)', await as(B, `update assembleia_perguntas set resposta='x' returning id`), (v) => v.length === 0);
log('A responde', await as(A, `update assembleia_perguntas set resposta='Planilha anexada ao item' returning respondido_em is not null r`), (v) => v[0].r);
log('B confirma presença na assembleia', await as(B, `insert into assembleia_presencas (assembleia_id, unidade_id, modo) values ($1,$2,'online') returning modo`, [asm.id, ub]));
// --- Primeira resposta e indicadores ---
log('Primeira resposta registrada', await as(A, `select primeira_resposta_em is not null r from chamados where id=$1`, [ch.id]), (v) => v[0].r);
log('Indicadores ampliados', await as(B, `select indicadores($1) i`, [c]), (v) => v[0].i.primeira_resposta_min !== undefined && v[0].i.comissoes_ativas === 1 && v[0].i.participacao_assembleia > 0);
log('anon vê avisos', await as('', `select count(*) from avisos`), (v) => n(v) === 0);
console.log(falhas ? `\n${falhas} verificação(ões) falharam` : '\nTodas as verificações passaram');
process.exit(falhas ? 1 : 0);
