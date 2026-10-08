// Cadastro de igrejas (monitor, professor e administrador) e vínculo de alunos
import { sb, ok, enviarFoto } from '../supa.js';
import { $, esc, html, telBR, toast, erro, confirmar, modal, lerForm, preencherForm, comprimirImagem, ocupado, vazio } from '../ui.js';
import { estado, semestreAtual, turmaNome } from '../dados.js';

export default async function (raiz) {
  const sem = semestreAtual();
  const cForm = html(`<div class="cartao">
    <div class="cartao-topo"><h3 class="t-form">Cadastrar igreja</h3><button class="btn btn-sec btn-peq b-cancelar oculto">Cancelar edição</button></div>
    <form autocomplete="off">
      <div class="foto-campo"><label class="previa ret" title="Escolher foto">⛪<input type="file" accept="image/*" class="oculto"></label>
        <div><b>Foto da igreja</b><small>Opcional. A imagem é reduzida antes de subir.</small></div></div>
      <label class="campo"><span>Nome da igreja <b class="obr">*</b></span><input name="nome" required></label>
      <div class="grade-3">
        <label class="campo"><span>Rua <b class="obr">*</b></span><input name="rua" required></label>
        <label class="campo"><span>Bairro <b class="obr">*</b></span><input name="bairro" required></label>
        <label class="campo"><span>Cidade <b class="obr">*</b></span><input name="cidade" required list="lista-cidades"><datalist id="lista-cidades"></datalist></label>
      </div>
      <div class="grade-2">
        <label class="campo"><span>Nome do pastor <b class="obr">*</b></span><input name="pastor_nome" required></label>
        <label class="campo"><span>Telefone do pastor <b class="obr">*</b></span><input name="pastor_tel" type="tel" inputmode="tel" required></label>
        <label class="campo"><span>Nome do ancião ou anciã <b class="obr">*</b></span><input name="anciao_nome" required></label>
        <label class="campo"><span>WhatsApp do ancião ou anciã <b class="obr">*</b></span><input name="anciao_tel" type="tel" inputmode="tel" required><small>É para este número que o aluno envia o link de comprovação.</small></label>
        <label class="campo"><span>Nome do secretário(a)</span><input name="secretario_nome"></label>
        <label class="campo"><span>Telefone do secretário(a)</span><input name="secretario_tel" type="tel" inputmode="tel"></label>
      </div>
      <div class="campo"><span>Alunos vinculados ${sem ? `(semestre ${esc(sem.nome)})` : ''}</span><div class="seletor"></div></div>
      <button class="btn" type="submit">Salvar igreja</button>
    </form></div>`);
  const cLista = html(`<div class="cartao"><div class="cartao-topo"><h3>Igrejas cadastradas</h3></div>
    <div class="barra-filtro"><input class="entrada b-busca" placeholder="Pesquisar por nome, cidade, pastor ou ancião…"></div>
    <div class="tabela-rolagem"><table class="tabela"><thead><tr><th></th><th>Igreja</th><th>Cidade</th><th>Pastor</th><th>Ancião</th><th>Alunos</th><th>Ações</th></tr></thead><tbody></tbody></table></div></div>`);
  raiz.append(cForm, cLista);

  const form = $('form', cForm);
  let editando = null, fotoBlob = null, fotoUrl = null;
  let igrejas = [], alunos = [], vinculos = [];
  let seletor = null;

  // foto
  $('input[type=file]', form).onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      fotoBlob = await comprimirImagem(f, 1000);
      const prev = $('.previa', form);
      prev.style.backgroundImage = `url('${URL.createObjectURL(fotoBlob)}')`;
      prev.firstChild.textContent = '';
    } catch (err) { erro(err); }
  };

  async function carregar() {
    const [i, a, v, c] = await Promise.all([
      sb.from('igrejas').select('*').order('nome'),
      sb.from('perfis').select('id, nome, ra, turma_id, tipo, ativo').in('tipo', ['aluno', 'monitor']).eq('ativo', true).order('nome'),
      sem ? sb.from('aluno_igreja').select('*').eq('semestre_id', sem.id) : Promise.resolve({ data: [] }),
      sb.rpc('cidades'),
    ]);
    igrejas = ok(i) || []; alunos = ok(a) || []; vinculos = ok(v) || [];
    $('#lista-cidades').innerHTML = (ok(c) || []).map((x) => `<option value="${esc(typeof x === 'string' ? x : x.cidades)}">`).join('');
    desenharTabela();
    montarSeletor(editando?.id || null);
  }

  function montarSeletor(igrejaId) {
    const alvo = $('.seletor', form);
    if (!sem) { alvo.innerHTML = '<small class="dica">Cadastre um semestre para vincular alunos.</small>'; seletor = null; return; }
    const marcados = new Set(vinculos.filter((v) => v.igreja_id === igrejaId && igrejaId).map((v) => v.aluno_id));
    seletor = seletorAlunos(alunos, marcados, vinculos, igrejas, igrejaId);
    alvo.innerHTML = '';
    alvo.append(seletor.raiz);
  }

  function desenharTabela() {
    const termo = $('.b-busca', cLista).value.trim().toLowerCase();
    const lista = igrejas.filter((g) => !termo || [g.nome, g.cidade, g.pastor_nome, g.anciao_nome, g.bairro].join(' ').toLowerCase().includes(termo));
    const tb = $('tbody', cLista);
    tb.innerHTML = lista.length ? '' : `<tr><td colspan="7">${vazio('Nenhuma igreja encontrada.')}</td></tr>`;
    for (const g of lista) {
      const n = vinculos.filter((v) => v.igreja_id === g.id).length;
      const tr = html(`<table><tr class="${g.ativa ? '' : 'inativo'}">
        <td>${g.foto_url ? `<img class="avatar" style="width:36px;height:36px;border-radius:8px" src="${esc(g.foto_url)}" alt="">` : '⛪'}</td>
        <td><div class="corta" title="${esc(g.nome)}"><b>${esc(g.nome)}</b></div>${g.ativa ? '' : '<span class="etiqueta et-inativo">inativa</span>'}<div class="corta dica" style="margin:0">${esc(g.bairro)}</div></td>
        <td class="corta">${esc(g.cidade)}</td>
        <td><div class="corta">${esc(g.pastor_nome)}</div><small>${esc(telBR(g.pastor_tel))}</small></td>
        <td><div class="corta">${esc(g.anciao_nome)}</div><small>${esc(telBR(g.anciao_tel))}</small></td>
        <td>${n}</td>
        <td><div class="acoes-celula">
          <button class="btn-icone b-ed" title="Editar">✏️</button>
          <button class="btn-icone b-vinc" title="Vincular ou desvincular alunos">👥</button>
          <button class="btn-icone b-ex" title="${g.ativa ? 'Excluir' : 'Reativar'}">${g.ativa ? '🗑️' : '♻️'}</button>
        </div></td></tr></table>`).querySelector('tr');
      $('.b-ed', tr).onclick = () => editar(g);
      $('.b-vinc', tr).onclick = () => vincular(g);
      $('.b-ex', tr).onclick = () => (g.ativa ? excluir(g) : reativar(g));
      tb.append(tr);
    }
  }
  $('.b-busca', cLista).oninput = desenharTabela;

  function limparForm() {
    editando = null; fotoBlob = null; fotoUrl = null;
    form.reset();
    const prev = $('.previa', form);
    prev.style.backgroundImage = ''; prev.firstChild.textContent = '⛪';
    $('.t-form', cForm).textContent = 'Cadastrar igreja';
    $('.b-cancelar', cForm).classList.add('oculto');
    montarSeletor(null);
  }
  $('.b-cancelar', cForm).onclick = limparForm;

  function editar(g) {
    editando = g; fotoBlob = null; fotoUrl = g.foto_url;
    preencherForm(form, g);
    const prev = $('.previa', form);
    prev.style.backgroundImage = g.foto_url ? `url('${g.foto_url}')` : '';
    prev.firstChild.textContent = g.foto_url ? '' : '⛪';
    $('.t-form', cForm).textContent = 'Editar igreja';
    $('.b-cancelar', cForm).classList.remove('oculto');
    montarSeletor(g.id);
    cForm.scrollIntoView({ behavior: 'smooth' });
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    const d = lerForm(form);
    const reg = {
      nome: d.nome, rua: d.rua, bairro: d.bairro, cidade: d.cidade,
      pastor_nome: d.pastor_nome, pastor_tel: d.pastor_tel.replace(/\D/g, ''),
      anciao_nome: d.anciao_nome, anciao_tel: d.anciao_tel.replace(/\D/g, ''),
      secretario_nome: d.secretario_nome || null, secretario_tel: d.secretario_tel.replace(/\D/g, '') || null,
    };
    if (reg.anciao_tel.length < 10) return toast('Informe o WhatsApp do ancião com DDD.', 'erro');
    if (reg.pastor_tel.length < 10) return toast('Informe o telefone do pastor com DDD.', 'erro');
    ocupado(e.submitter, async () => {
      try {
        if (fotoBlob) fotoUrl = await enviarFoto('igrejas', fotoBlob);
        reg.foto_url = fotoUrl;
        let id;
        if (editando) { ok(await sb.from('igrejas').update(reg).eq('id', editando.id)); id = editando.id; }
        else id = ok(await sb.from('igrejas').insert(reg).select('id').single()).id;
        if (seletor) await salvarVinculos(id, seletor.selecionados());
        toast('Igreja salva.');
        limparForm();
        await carregar();
      } catch (err) { erro(err); }
    });
  };

  async function salvarVinculos(igrejaId, selecionados) {
    if (!sem) return;
    const atuais = new Set(vinculos.filter((v) => v.igreja_id === igrejaId).map((v) => v.aluno_id));
    const sair = [...atuais].filter((id) => !selecionados.has(id));
    const entrar = [...selecionados].filter((id) => !atuais.has(id));
    if (sair.length) ok(await sb.from('aluno_igreja').delete().eq('igreja_id', igrejaId).eq('semestre_id', sem.id).in('aluno_id', sair));
    if (entrar.length) {
      ok(await sb.from('aluno_igreja').upsert(
        entrar.map((aluno_id) => ({ aluno_id, igreja_id: igrejaId, semestre_id: sem.id })),
        { onConflict: 'aluno_id,semestre_id' },
      ));
    }
  }

  async function vincular(g) {
    if (!sem) return toast('Cadastre um semestre primeiro.', 'erro');
    const marcados = new Set(vinculos.filter((v) => v.igreja_id === g.id).map((v) => v.aluno_id));
    const s = seletorAlunos(alunos, marcados, vinculos, igrejas, g.id);
    const corpo = html(`<div><p class="dica">Semestre ${esc(sem.nome)}. Marcar um aluno que já está em outra igreja muda o vínculo dele para esta; o que ele já cumpriu na outra igreja fica guardado.</p></div>`);
    corpo.append(s.raiz);
    await modal({
      titulo: `Alunos de ${g.nome}`, corpo, largo: true,
      acoes: [{ rotulo: 'Cancelar', classe: 'btn-sec', valor: false }, {
        rotulo: 'Salvar vínculos',
        antes: async () => {
          try { await salvarVinculos(g.id, s.selecionados()); toast('Vínculos salvos.'); await carregar(); }
          catch (e) { erro(e); return false; }
        },
      }],
    });
  }

  async function excluir(g) {
    try {
      const n = ok(await sb.rpc('contar_historico', { p_tabela: 'igreja', p_id: g.id }));
      if (n > 0) {
        if (!(await confirmar(`A igreja <b>${esc(g.nome)}</b> tem ${n} registro(s) de prática e não pode ser excluída. Deseja <b>inativá-la</b>? Ela some das listas, mas o histórico fica guardado.`, { rotulo: 'Inativar' }))) return;
        ok(await sb.from('igrejas').update({ ativa: false }).eq('id', g.id));
        toast('Igreja inativada.');
      } else {
        const r = await confirmar(`Excluir a igreja <b>${esc(g.nome)}</b>? Os vínculos de alunos com ela serão removidos.`, { perigo: true, rotulo: 'Excluir', exigirTexto: g.nome });
        if (!r) return;
        ok(await sb.from('igrejas').delete().eq('id', g.id));
        toast('Igreja excluída.');
      }
      if (editando?.id === g.id) limparForm();
      await carregar();
    } catch (e) { erro(e); }
  }

  async function reativar(g) {
    try { ok(await sb.from('igrejas').update({ ativa: true }).eq('id', g.id)); toast('Igreja reativada.'); await carregar(); } catch (e) { erro(e); }
  }

  await carregar();
}

// Lista de alunos com pesquisa e caixas de seleção
export function seletorAlunos(alunos, marcados, vinculos, igrejas, igrejaId) {
  const sel = new Set(marcados);
  const onde = new Map(vinculos.map((v) => [v.aluno_id, v.igreja_id]));
  const nomeIgreja = (id) => igrejas.find((g) => g.id === id)?.nome || '';
  const raiz = html(`<div><input class="entrada" placeholder="Pesquisar aluno por nome, RA ou turma…" style="margin-bottom:8px">
    <div class="dica cont"></div><div class="lista-sel"></div></div>`);
  const desenhar = () => {
    const t = raiz.querySelector('input').value.trim().toLowerCase();
    const lista = alunos.filter((a) => !t || `${a.nome} ${a.ra} ${turmaNome(a.turma_id)}`.toLowerCase().includes(t));
    raiz.querySelector('.cont').textContent = `${sel.size} selecionado(s)`;
    raiz.querySelector('.lista-sel').innerHTML = lista.length ? lista.map((a) => {
      const outra = onde.get(a.id) && onde.get(a.id) !== igrejaId ? nomeIgreja(onde.get(a.id)) : '';
      return `<label class="check"><input type="checkbox" value="${a.id}" ${sel.has(a.id) ? 'checked' : ''}>
        <span>${esc(a.nome)} <small class="dica">· RA ${esc(a.ra)} · ${esc(turmaNome(a.turma_id))}${outra ? ` · hoje em ${esc(outra)}` : ''}</small></span></label>`;
    }).join('') : '<div class="vazio">Nenhum aluno encontrado.</div>';
    raiz.querySelectorAll('.lista-sel input').forEach((i) => (i.onchange = () => {
      i.checked ? sel.add(i.value) : sel.delete(i.value);
      raiz.querySelector('.cont').textContent = `${sel.size} selecionado(s)`;
    }));
  };
  raiz.querySelector('input').oninput = desenhar;
  desenhar();
  return { raiz, selecionados: () => sel };
}
