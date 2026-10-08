// Estado compartilhado e cargas comuns
import { sb, ok } from './supa.js';
import { diaLocal } from './ui.js';
import { comCopia } from './cache.js';

export const estado = {
  perfil: null,
  turmas: [],
  semestres: [],
  praticas: [],
  eventos: [],
  semestreAtualId: null,
};

// Usa a sessão guardada no aparelho (funciona sem internet)
export async function carregarPerfil() {
  const { data } = await sb.auth.getSession();
  const id = data?.session?.user?.id;
  if (!id) return null;
  const p = await comCopia('perfil:' + id, async () => ok(await sb.from('perfis').select('*').eq('id', id).maybeSingle()));
  estado.perfil = p;
  return p;
}

export async function carregarBase() {
  const b = await comCopia('base:' + (estado.perfil?.id || ''), async () => {
    const [t, s, p, e] = await Promise.all([
      sb.from('turmas').select('*').order('nome'),
      sb.from('semestres').select('*').order('inicio', { ascending: false }),
      sb.from('praticas').select('*').order('inicio'),
      sb.from('eventos').select('*').order('data'),
    ]);
    return { turmas: ok(t) || [], semestres: ok(s) || [], praticas: ok(p) || [], eventos: ok(e) || [] };
  });
  Object.assign(estado, b);
  estado.semestreAtualId = calcularSemestreAtual();
  return estado;
}

// Cumprimentos de um aluno (com cópia no aparelho)
export async function cumprimentosDoAluno(alunoId) {
  return comCopia('cumpr:' + alunoId, async () =>
    ok(await sb.from('cumprimentos').select('*').eq('aluno_id', alunoId)) || []);
}

// ------------------------------------------------------------ progresso

export const CUMPRIDO = ['confirmado', 'aprovado_prof'];
export const ROTULO_STATUS = {
  enviado: 'Aguardando o ancião',
  confirmado: 'Confirmado pelo ancião',
  revisar: 'Revisar e reenviar',
  aprovado_prof: 'Aprovado pelo professor',
  reprovado_prof: 'Reprovado pelo professor',
  nao_enviado: 'Não enviado',
};

// Quantas vezes o requisito é exigido no semestre
export function exigido(req, nBlocos) {
  return req.quantidade ?? nBlocos;
}

// Progresso de uma lista de requisitos: { exigido, cumprido, pct }
export function progresso(requisitos, praticasSemestre, cumprimentos) {
  let ex = 0, cu = 0;
  for (const r of requisitos) {
    const e = exigido(r, praticasSemestre.length);
    const feitos = cumprimentos.filter((c) => c.requisito_id === r.id && CUMPRIDO.includes(c.status)
      && praticasSemestre.some((p) => p.id === c.pratica_id)).length;
    ex += e; cu += Math.min(feitos, e);
  }
  return { exigido: ex, cumprido: cu, pct: ex ? Math.round((cu / ex) * 100) : 0 };
}

export function calcularSemestreAtual() {
  const hoje = diaLocal(new Date());
  const ss = estado.semestres;
  const atual = ss.filter((s) => s.inicio <= hoje && s.fim >= hoje).sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0];
  if (atual) return atual.id;
  const prox = ss.filter((s) => s.inicio > hoje).sort((a, b) => (a.inicio > b.inicio ? 1 : -1))[0];
  if (prox) return prox.id;
  const ult = [...ss].sort((a, b) => (a.fim < b.fim ? 1 : -1))[0];
  return ult ? ult.id : null;
}

export const turmaNome = (id) => estado.turmas.find((t) => t.id === id)?.nome || 'Sem turma informada';
export const semestreNome = (id) => estado.semestres.find((s) => s.id === id)?.nome || 'Não informado';
export const semestreAtual = () => estado.semestres.find((s) => s.id === estado.semestreAtualId) || null;

// Situação de um bloco de prática em relação a agora
export function situacaoPratica(p, agora = Date.now()) {
  const ini = new Date(p.inicio).getTime(), fim = new Date(p.fim).getTime();
  if (agora < ini) return 'futura';
  if (agora > fim) return 'encerrada';
  return 'aberta';
}

// Disciplinas de uma turma num semestre: [{disciplina, requisitos}]
export async function disciplinasDaTurma(turmaId, semestreId) {
  if (!turmaId || !semestreId) return [];
  return comCopia(`disc:${turmaId}:${semestreId}`, () => buscarDisciplinasDaTurma(turmaId, semestreId));
}
async function buscarDisciplinasDaTurma(turmaId, semestreId) {
  const v = ok(await sb.from('disciplina_turma').select('disciplina_id, disciplinas(*)')
    .eq('turma_id', turmaId).eq('semestre_id', semestreId)) || [];
  const discs = v.map((x) => x.disciplinas).filter((d) => d && !d.arquivada);
  if (!discs.length) return [];
  const reqs = ok(await sb.from('requisitos').select('*').in('disciplina_id', discs.map((d) => d.id))
    .eq('arquivado', false).order('ordem').order('criado_em')) || [];
  return discs.map((d) => ({ disciplina: d, requisitos: reqs.filter((r) => r.disciplina_id === d.id) }));
}

// Mapa turma_id -> [nomes de disciplinas] no semestre
export async function mapaDisciplinasPorTurma(semestreId) {
  if (!semestreId) return {};
  const v = ok(await sb.from('disciplina_turma').select('turma_id, disciplinas(nome, arquivada)').eq('semestre_id', semestreId)) || [];
  const m = {};
  for (const x of v) {
    if (!x.disciplinas || x.disciplinas.arquivada) continue;
    (m[x.turma_id] ||= []).push(x.disciplinas.nome);
  }
  return m;
}
