// Disciplinas e requisitos (monitor, professor e administrador)
import { sb, ok } from '../supa.js';
import { $, esc, html, toast, erro, confirmar, modal, lerForm, preencherForm, vazio } from '../ui.js';
import { estado, semestreAtual, turmaNome } from '../dados.js';

const CORES = ['#0b2e6b', '#c9362b', '#1f9d55', '#f2b705', '#2f6fdf', '#7a3fb0', '#d9681d', '#11867f'];

export default async function (raiz) {
  const partes = location.hash.split('/');
  if (partes[0] === '#disciplinas' && partes[1]) return abrirDisciplina(raiz, partes[1]);
  return listar(raiz);
}

async function listar(raiz) {
  const sem = semestreAtual();
  const [d, r, v] = await Promise.all([
    sb.from('disciplinas').select('*').eq('arquivada', false).order('nome'),
    sb.from('requisitos').select('id, disciplina_id').eq('arquivado', false),
    sem ? sb.from('disciplina_turma').select('*').eq('semestre_id', sem.id) : Promise.resolve({ data: [] }),
  ]);
  const discs = ok(d) || [], reqs = ok(r) || [], vincs = ok(v) || [];
  const c = html(`<div class="cartao"><div class="cartao-topo"><h3>Disciplinas</h3><button class="btn btn-peq b-criar">+ Criar disciplina</button></div><div class="grade-disc"></div></div>`);
  const g = $('.grade-disc', c);
  if (!discs.length) g.outerHTML = vazio('Nenhuma disciplina criada ainda.');
  for (const disc of discs) {
    const nReq = reqs.filter((x) => x.disciplina_id === disc.id).length;
    const turmas = vincs.filter((x) => x.disciplina_id === disc.id).map((x) => turmaNome(x.turma_id));
    const card = html(`<div class="card-disc" style="border-left-color:${esc(disc.cor)}">
      <div class="info"><b>${esc(disc.nome)}${disc.codigo ? ` <small>(${esc(disc.codigo)})</small>` : ''}</b>
      <small>${nReq} requisito(s)${sem ? ` · ${turmas.length ? esc(turmas.join(', ')) : 'sem turma em ' + esc(sem.nome)}` : ''}</small></div>
      <button class="btn-icone b-ed" title="Editar">✏️</button><button class="btn-icone b-ex" title="Excluir">🗑️</button></div>`);
    card.onclick = (e) => { if (!e.target.closest('button')) location.hash = 'disciplinas/' + disc.id; };
    $('.b-ed', card).onclick = () => editarDisciplina(disc, () => recarregar(raiz));
    $('.b-ex', card).onclick = () => excluirDisciplina(disc, () => recarregar(raiz));
    g.append(card);
  }
  $('.b-criar', c).onclick = () => editarDisciplina(null, () => recarregar(raiz));
  raiz.append(c);
}

function recarregar(raiz) { raiz.innerHTML = ''; return listar(raiz); }

async function editarDisciplina(disc, depois) {
  const form = html(`<form>
    <label class="campo"><span>Nome da disciplina <b class="obr">*</b></span><input name="nome" required></label>
    <label class="campo"><span>Código</span><input name="codigo"><small>Opcional.</small></label>
    <div class="campo"><span>Cor</span><div class="linha-botoes cores">${CORES.map((c) => `<label style="cursor:pointer"><input type="radio" name="cor" value="${c}" class="oculto"><span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 0 0 1px #ccd"></span></label>`).join('')}</div></div>
  </form>`);
  const marcarCor = (cor) => form.querySelectorAll('[name=cor]').forEach((r) => {
    r.checked = r.value === cor; r.nextElementSibling.style.boxShadow = r.checked ? '0 0 0 3px #0b2e6b' : '0 0 0 1px #ccd';
  });
  form.querySelectorAll('[name=cor]').forEach((r) => (r.onchange = () => marcarCor(r.value)));
  if (disc) preencherForm(form, { nome: disc.nome, codigo: disc.codigo || '' });
  marcarCor(disc?.cor || CORES[0]);
  await modal({
    titulo: disc ? 'Editar disciplina' : 'Criar disciplina', corpo: form,
    acoes: [{ rotulo: 'Cancelar', classe: 'btn-sec', valor: false }, {
      rotulo: 'Salvar',
      antes: async () => {
        if (!form.reportValidity()) return false;
        const d = lerForm(form);
        const cor = form.querySelector('[name=cor]:checked')?.value || CORES[0];
        const reg = { nome: d.nome, codigo: d.codigo || null, cor };
        try {
          if (disc) ok(await sb.from('disciplinas').update(reg).eq('id', disc.id));
          else ok(await sb.from('disciplinas').insert(reg));
          toast('Disciplina salva.');
          await depois();
        } catch (e) { erro(e); return false; }
      },
    }],
  });
}

async function excluirDisciplina(disc, depois) {
  try {
    const n = ok(await sb.rpc('contar_historico', { p_tabela: 'disciplina', p_id: disc.id }));
    if (n > 0) {
      if (!(await confirmar(`A disciplina <b>${esc(disc.nome)}</b> tem ${n} cumprimento(s) registrados e não pode ser excluída. Deseja <b>arquivá-la</b>? Ela some das listas e o histórico fica guardado.`, { rotulo: 'Arquivar' }))) return;
      ok(await sb.from('disciplinas').update({ arquivada: true }).eq('id', disc.id));
      toast('Disciplina arquivada.');
    } else {
      if (!(await confirmar(`Excluir a disciplina <b>${esc(disc.nome)}</b> e todos os requisitos dela?`, { perigo: true, rotulo: 'Excluir', exigirTexto: disc.nome }))) return;
      ok(await sb.from('disciplinas').delete().eq('id', disc.id));
      toast('Disciplina excluída.');
    }
    await depois();
  } catch (e) { erro(e); }
}

// ------------------------------------------------------------ dentro da disciplina

async function abrirDisciplina(raiz, id) {
  const disc = ok(await sb.from('disciplinas').select('*').eq('id', id).maybeSingle());
  if (!disc) { location.hash = 'disciplinas'; return; }
  const semPadrao = semestreAtual();
  let semId = semPadrao?.id || null;

  raiz.innerHTML = '';
  raiz.append(html(`<div class="linha-botoes" style="margin-bottom:12px"><button class="btn btn-sec btn-peq b-voltar">← Disciplinas</button></div>`));
  raiz.append(html(`<div class="cabeca-disc" style="background:linear-gradient(120deg,#071f4a,${esc(disc.cor)})">
    <div><h2>${esc(disc.nome)}</h2><small>${disc.codigo ? esc(disc.codigo) + ' · ' : ''}Requisitos e turmas da disciplina</small></div></div>`));
  $('.b-voltar', raiz).onclick = () => { location.hash = 'disciplinas'; };

  // Turmas vinculadas por semestre
  const cTurmas = html(`<div class="cartao"><div class="cartao-topo"><h3>Turmas que cursam esta disciplina</h3>
    <select class="entrada sel-sem" style="width:auto">${estado.semestres.map((s) => `<option value="${s.id}">${esc(s.nome)}</option>`).join('')}</select></div>
    <div class="area-turmas"></div></div>`);
  const cReqs = html(`<div class="cartao"><div class="cartao-topo"><h3>Requisitos</h3><button class="btn btn-peq b-novo">+ Criar novo requisito</button></div><div class="lista-reqs"></div></div>`);
  raiz.append(cTurmas, cReqs);

  const selSem = $('.sel-sem', cTurmas);
  if (semId) selSem.value = semId;
  selSem.onchange = () => { semId = selSem.value; desenharTurmas(); };

  async function desenharTurmas() {
    const area = $('.area-turmas', cTurmas);
    if (!estado.semestres.length) { area.innerHTML = vazio('Cadastre um semestre no Painel do administrador.'); selSem.classList.add('oculto'); return; }
    const vinc = ok(await sb.from('disciplina_turma').select('*').eq('disciplina_id', id).eq('semestre_id', semId)) || [];
    const ids = new Set(vinc.map((v) => v.turma_id));
    area.innerHTML = `<div class="chips" style="margin-bottom:12px">${ids.size ? [...ids].map((t) => `<span class="chip">${esc(turmaNome(t))}</span>`).join('') : '<span class="dica">Nenhuma turma vinculada neste semestre.</span>'}</div>
      <button class="btn btn-sec btn-peq b-edt">Editar turmas</button>
      <p class="dica">Todos os requisitos da disciplina valem para as turmas vinculadas. Quando um bloco de prática do semestre abrir, a disciplina fica disponível para elas.</p>`;
    $('.b-edt', area).onclick = () => editarTurmas(ids);
  }

  async function editarTurmas(atuais) {
    if (!estado.turmas.length) return toast('Cadastre as turmas no Painel do administrador.', 'erro');
    const corpo = html(`<div class="lista-sel">${estado.turmas.map((t) => `<label class="check"><input type="checkbox" value="${t.id}" ${atuais.has(t.id) ? 'checked' : ''}> ${esc(t.nome)}</label>`).join('')}</div>`);
    await modal({
      titulo: 'Turmas vinculadas', corpo,
      acoes: [{ rotulo: 'Cancelar', classe: 'btn-sec', valor: false }, {
        rotulo: 'Salvar',
        antes: async () => {
          const novas = new Set([...corpo.querySelectorAll('input:checked')].map((i) => i.value));
          const sair = [...atuais].filter((t) => !novas.has(t));
          const entrar = [...novas].filter((t) => !atuais.has(t));
          try {
            if (sair.length) ok(await sb.from('disciplina_turma').delete().eq('disciplina_id', id).eq('semestre_id', semId).in('turma_id', sair));
            if (entrar.length) ok(await sb.from('disciplina_turma').insert(entrar.map((turma_id) => ({ disciplina_id: id, turma_id, semestre_id: semId }))));
            toast('Turmas atualizadas.');
            desenharTurmas();
          } catch (e) { erro(e); return false; }
        },
      }],
    });
  }

  async function desenharReqs() {
    const reqs = ok(await sb.from('requisitos').select('*').eq('disciplina_id', id).eq('arquivado', false).order('ordem').order('criado_em')) || [];
    const l = $('.lista-reqs', cReqs);
    l.innerHTML = reqs.length ? '' : vazio('Esta disciplina ainda não tem requisitos. Comece criando o primeiro.');
    reqs.forEach((r, i) => {
      const item = html(`<div class="req-item"><span class="req-num">${i + 1}</span>
        <div class="req-txt">${esc(r.enunciado)}<small>${r.quantidade ? `Cumprir ${r.quantidade} vez(es) · no máximo uma por bloco` : 'Cumprir em todos os blocos de prática'}</small></div>
        <span class="acoes-celula">
          <button class="btn-icone b-sobe" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn-icone b-ed" title="Editar">✏️</button>
          <button class="btn-icone b-ex" title="Excluir">🗑️</button></span></div>`);
      $('.b-ed', item).onclick = () => editarReq(r, reqs.length);
      $('.b-ex', item).onclick = () => excluirReq(r);
      $('.b-sobe', item).onclick = async () => {
        try {
          const lista = reqs.map((x) => x.id);
          [lista[i - 1], lista[i]] = [lista[i], lista[i - 1]];
          await Promise.all(lista.map((rid, k) => sb.from('requisitos').update({ ordem: k }).eq('id', rid)));
          desenharReqs();
        } catch (e) { erro(e); }
      };
      l.append(item);
    });
    $('.b-novo', cReqs).onclick = () => editarReq(null, reqs.length);
  }

  async function editarReq(r, total) {
    let aviso = '';
    if (r) {
      const n = ok(await sb.rpc('contar_historico', { p_tabela: 'requisito', p_id: r.id }));
      if (n > 0) aviso = `<div class="aviso aviso-amarelo">Atenção: ${n} cumprimento(s) já foram registrados com este requisito. A alteração vale também para eles.</div>`;
    }
    const form = html(`<form>${aviso}
      <label class="campo"><span>Enunciado do requisito <b class="obr">*</b></span><textarea name="enunciado" required rows="3"></textarea></label>
      <label class="check" style="margin-bottom:10px"><input type="checkbox" name="todos"> Todos os blocos de prática</label>
      <label class="campo q-campo"><span>Quantas vezes deve ser cumprido <b class="obr">*</b></span><input name="quantidade" type="number" min="1" max="100" value="1">
        <small>Cada bloco de prática conta no máximo uma vez.</small></label></form>`);
    const todos = form.querySelector('[name=todos]');
    const sincroniza = () => form.querySelector('.q-campo').classList.toggle('oculto', todos.checked);
    todos.onchange = sincroniza;
    if (r) preencherForm(form, { enunciado: r.enunciado, todos: !r.quantidade, quantidade: r.quantidade || 1 });
    sincroniza();
    await modal({
      titulo: r ? 'Editar requisito' : 'Criar novo requisito', corpo: form, largo: true,
      acoes: [{ rotulo: 'Cancelar', classe: 'btn-sec', valor: false }, {
        rotulo: 'Salvar',
        antes: async () => {
          if (!form.reportValidity()) return false;
          const d = lerForm(form);
          const q = d.todos ? null : parseInt(d.quantidade, 10);
          if (!d.todos && !(q >= 1)) { toast('Informe a quantidade.', 'erro'); return false; }
          const reg = { enunciado: d.enunciado, quantidade: q };
          try {
            if (r) ok(await sb.from('requisitos').update(reg).eq('id', r.id));
            else ok(await sb.from('requisitos').insert({ ...reg, disciplina_id: id, ordem: total }));
            toast('Requisito salvo.');
            desenharReqs();
          } catch (e) { erro(e); return false; }
        },
      }],
    });
  }

  async function excluirReq(r) {
    try {
      const n = ok(await sb.rpc('contar_historico', { p_tabela: 'requisito', p_id: r.id }));
      if (n > 0) {
        if (!(await confirmar(`${n} aluno(s) já cumpriram este requisito. Ele será <b>arquivado</b>: some para os próximos blocos e continua no histórico e nos relatórios.`, { rotulo: 'Arquivar' }))) return;
        ok(await sb.from('requisitos').update({ arquivado: true }).eq('id', r.id));
        toast('Requisito arquivado.');
      } else {
        if (!(await confirmar('Excluir este requisito?', { perigo: true, rotulo: 'Excluir' }))) return;
        ok(await sb.from('requisitos').delete().eq('id', r.id));
        toast('Requisito excluído.');
      }
      desenharReqs();
    } catch (e) { erro(e); }
  }

  desenharTurmas();
  desenharReqs();
}
