// Gráficos gerais (a parte de cumprimento entra junto com a fase de comprovação)
import { sb, ok } from '../supa.js';
import { esc, html, vazio } from '../ui.js';
import { estado } from '../dados.js';

export default async function (raiz) {
  const [a, g] = await Promise.all([
    sb.from('perfis').select('id, turma_id').in('tipo', ['aluno', 'monitor']).eq('ativo', true),
    sb.from('igrejas').select('id, cidade').eq('ativa', true),
  ]);
  const alunos = ok(a) || [], igrejas = ok(g) || [];

  raiz.append(html(`<div class="numeros">
    <div class="numero"><b>${estado.turmas.length}</b><small>Turmas</small></div>
    <div class="numero"><b>${alunos.length}</b><small>Alunos ativos</small></div>
    <div class="numero"><b>${igrejas.length}</b><small>Igrejas</small></div>
    <div class="numero"><b>${new Set(igrejas.map((i) => i.cidade.trim().toLowerCase())).size}</b><small>Cidades</small></div>
  </div>`));

  raiz.append(barras('Igrejas por cidade', contar(igrejas.map((i) => i.cidade.trim()))));
  raiz.append(barras('Alunos por turma', contar(alunos.map((x) => estado.turmas.find((t) => t.id === x.turma_id)?.nome || 'Sem turma'))));
  raiz.append(html(`<p class="dica">Os gráficos de cumprimento (por turma, por igreja, pendências e comprovações aguardando o ancião) aparecem quando a etapa de comprovação estiver no ar.</p>`));
}

function contar(lista) {
  const m = new Map();
  for (const x of lista) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function barras(titulo, dados) {
  const max = Math.max(1, ...dados.map((d) => d[1]));
  return html(`<div class="cartao"><h3>${esc(titulo)}</h3>${dados.length ? dados.map(([n, v]) => `
    <div class="barra-h"><span class="corta" title="${esc(n)}">${esc(n)}</span><div class="trilho"><div class="cheio" style="width:${(v / max) * 100}%"></div></div><span class="val">${v}</span></div>`).join('') : vazio('Sem dados ainda.')}</div>`);
}
