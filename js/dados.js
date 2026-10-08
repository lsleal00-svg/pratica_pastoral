// Estado compartilhado e cargas comuns
import { sb, ok } from './supa.js';
import { diaLocal } from './ui.js';

export const estado = {
  perfil: null,
  turmas: [],
  semestres: [],
  praticas: [],
  eventos: [],
  semestreAtualId: null,
};

export async function carregarPerfil() {
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return null;
  const p = ok(await sb.from('perfis').select('*').eq('id', u.user.id).maybeSingle());
  estado.perfil = p;
  return p;
}

export async function carregarBase() {
  const [t, s, p, e] = await Promise.all([
    sb.from('turmas').select('*').order('nome'),
    sb.from('semestres').select('*').order('inicio', { ascending: false }),
    sb.from('praticas').select('*').order('inicio'),
    sb.from('eventos').select('*').order('data'),
  ]);
  estado.turmas = ok(t) || [];
  estado.semestres = ok(s) || [];
  estado.praticas = ok(p) || [];
  estado.eventos = ok(e) || [];
  estado.semestreAtualId = calcularSemestreAtual();
  return estado;
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
