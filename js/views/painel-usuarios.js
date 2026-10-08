// Área de cadastro + tabela de usuários
import { sb, ok, api, enviarFoto } from '../supa.js';
import { $, esc, html, avatar, TIPOS, dataBR, cpfBR, toast, erro, confirmar, lerForm, preencherForm, comprimirImagem, ocupado, mostrarCodigo, vazio } from '../ui.js';
import { estado, semestreAtual, turmaNome, mapaDisciplinasPorTurma } from '../dados.js';

const POR_PAGINA = 30;

export default async function (raiz) {
  const sem = semestreAtual();
  const igrejas = ok(await sb.from('igrejas').select('id, nome').eq('ativa', true).order('nome')) || [];

  const cForm = html(`<div class="cartao">
    <div class="cartao-topo"><h3 class="t-form">Cadastrar pessoa</h3><button class="btn btn-sec btn-peq b-cancelar oculto">Cancelar edição</button></div>
    <form autocomplete="off">
      <div class="foto-campo"><label class="previa" title="Escolher foto">👤<input type="file" accept="image/*" class="oculto"></label>
        <div><b>Foto do perfil</b><small>Opcional. JPEG ou PNG — a imagem é reduzida antes de subir.</small></div></div>
      <label class="campo"><span>Nome completo <b class="obr">*</b></span><input name="nome" required></label>
      <div class="grade-2">
        <label class="campo"><span>Data de nascimento <b class="obr">*</b></span><input name="nascimento" type="date" required></label>
        <label class="campo"><span>Turma <b class="obr t-obr">*</b></span><select name="turma_id"><option value="">Selecione…</option>${estado.turmas.map((t) => `<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select></label>
        <label class="campo"><span>RA <b class="obr">*</b></span><input name="ra" inputmode="numeric" pattern="[0-9]+" required><small>Somente números.</small></label>
        <label class="campo"><span>CPF</span><input name="cpf" inputmode="numeric"><small>Opcional.</small></label>
        <label class="campo"><span>E-mail <b class="obr">*</b></span><input name="email" type="email" required></label>
        <label class="campo"><span>WhatsApp com DDD <b class="obr">*</b></span><input name="telefone" type="tel" inputmode="tel" required></label>
        <label class="campo"><span>Tipo de perfil <b class="obr">*</b></span><select name="tipo" required>${Object.entries(TIPOS).map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>
        <label class="campo"><span>Igreja ${sem ? `(${esc(sem.nome)})` : ''}</span><select name="igreja_id"><option value="">Nenhuma</option>${igrejas.map((g) => `<option value="${g.id}">${esc(g.nome)}</option>`).join('')}</select><small>Opcional.</small></label>
      </div>
      <button class="btn btn-bloco b-salvar" type="submit">Cadastrar e gerar código</button>
    </form></div>`);

  const cTab = html(`<div class="cartao">
    <div class="cartao-topo"><h3>Usuários <span class="etiqueta n-total">0</span></h3></div>
    <div class="barra-filtro">
      <input class="entrada b-busca" placeholder="Pesquisar por nome, e-mail, RA ou CPF…">
      <select class="entrada f-tipo"><option value="">Todos os perfis</option>${Object.entries(TIPOS).map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}<option value="inativos">Inativos</option></select>
    </div>
    <div class="tabela-rolagem"><table class="tabela"><thead><tr>
      <th>Nome</th><th>Nascimento</th><th>Turma</th><th>Disciplina</th><th>Igreja</th><th>RA</th><th>CPF</th><th>E-mail</th><th>Perfil</th><th>Ações</th>
    </tr></thead><tbody></tbody></table></div>
    <div class="paginacao"></div></div>`);
  raiz.append(cForm, cTab);

  const form = $('form', cForm);
  let editando = null, fotoBlob = null, pagina = 0, temporizador = null;

  const tipoSel = form.querySelector('[name=tipo]');
  const ajustaTurma = () => {
    const exige = ['aluno', 'monitor'].includes(tipoSel.value);
    form.querySelector('[name=turma_id]').required = exige;
    form.querySelector('.t-obr').classList.toggle('oculto', !exige);
  };
  tipoSel.onchange = ajustaTurma;
  ajustaTurma();

  $('input[type=file]', form).onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      fotoBlob = await comprimirImagem(f, 400);
      const p = $('.previa', form);
      p.style.backgroundImage = `url('${URL.createObjectURL(fotoBlob)}')`;
      p.firstChild.textContent = '';
    } catch (err) { erro(err); }
  };

  function limpar() {
    editando = null; fotoBlob = null;
    form.reset(); ajustaTurma();
    const p = $('.previa', form); p.style.backgroundImage = ''; p.firstChild.textContent = '👤';
    $('.t-form', cForm).textContent = 'Cadastrar pessoa';
    $('.b-salvar', form).textContent = 'Cadastrar e gerar código';
    $('.b-cancelar', cForm).classList.add('oculto');
  }
  $('.b-cancelar', cForm).onclick = limpar;

  async function editar(u, igrejaId) {
    editando = u; fotoBlob = null;
    preencherForm(form, { ...u, turma_id: u.turma_id || '', cpf: u.cpf || '', igreja_id: igrejaId || '' });
    ajustaTurma();
    const p = $('.previa', form);
    p.style.backgroundImage = u.foto_url ? `url('${u.foto_url}')` : ''; p.firstChild.textContent = u.foto_url ? '' : '👤';
    $('.t-form', cForm).textContent = 'Editar ' + u.nome;
    $('.b-salvar', form).textContent = 'Salvar alterações';
    $('.b-cancelar', cForm).classList.remove('oculto');
    cForm.scrollIntoView({ behavior: 'smooth' });
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    const d = lerForm(form);
    ocupado(e.submitter, async () => {
      try {
        let foto_url = editando?.foto_url || null;
        if (fotoBlob) foto_url = await enviarFoto(`perfis/${editando?.id || 'novos'}`, fotoBlob);
        const r = await api('salvar_usuario', { ...d, id: editando?.id, foto_url });
        if (editando) {
          toast('Cadastro atualizado.');
          if (editando.id === estado.perfil.id) Object.assign(estado.perfil, d, { foto_url });
        } else {
          await mostrarCodigo({
            codigo: r.codigo, nome: d.nome, telefone: d.telefone,
            aoEnviarEmail: () => api('enviar_codigo_email', { id: r.id, codigo: r.codigo }),
          });
        }
        limpar();
        await desenhar();
      } catch (err) { erro(err); }
    });
  };

  // ------------------------------------------------ tabela

  async function desenhar() {
    const termo = $('.b-busca', cTab).value.trim().replace(/[,()*%\\"]/g, ' ').trim();
    const filtro = $('.f-tipo', cTab).value;
    let q = sb.from('perfis').select('*', { count: 'exact' }).order('nome').range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
    if (filtro === 'inativos') q = q.eq('ativo', false);
    else if (filtro) q = q.eq('tipo', filtro);
    if (termo) {
      const t = `*${termo}*`;
      const dig = termo.replace(/\D/g, '');
      const ors = [`nome.ilike.${t}`, `email.ilike.${t}`];
      if (dig) ors.push(`ra.ilike.*${dig}*`, `cpf.ilike.*${dig}*`);
      q = q.or(ors.join(','));
    }
    const tb = $('tbody', cTab);
    let lista, total;
    try {
      const r = await q;
      lista = ok(r) || []; total = r.count || 0;
    } catch (e) { tb.innerHTML = `<tr><td colspan="10">${vazio(e.message)}</td></tr>`; return; }
    $('.n-total', cTab).textContent = total;

    const ids = lista.map((u) => u.id);
    const [mapaDisc, vincs] = await Promise.all([
      mapaDisciplinasPorTurma(sem?.id),
      sem && ids.length ? sb.from('aluno_igreja').select('aluno_id, igreja_id, igrejas(nome)').eq('semestre_id', sem.id).in('aluno_id', ids) : Promise.resolve({ data: [] }),
    ]);
    const igrejaDe = new Map((ok(vincs) || []).map((v) => [v.aluno_id, v]));

    tb.innerHTML = lista.length ? '' : `<tr><td colspan="10">${vazio('Ninguém encontrado.')}</td></tr>`;
    for (const u of lista) {
      const ig = igrejaDe.get(u.id);
      const disc = (mapaDisc[u.turma_id] || []).join(', ');
      const eu = u.id === estado.perfil.id;
      const tr = html(`<table><tr class="${u.ativo ? '' : 'inativo'}">
        <td><div class="pessoa-cel">${avatar(u, 32)}<div><div class="corta" title="${esc(u.nome)}">${esc(u.nome)}</div>${eu ? '<small class="dica">(você)</small>' : ''}</div></div></td>
        <td>${dataBR(u.nascimento)}</td>
        <td class="corta" title="${esc(turmaNome(u.turma_id))}">${esc(u.turma_id ? turmaNome(u.turma_id) : 'sem turma informada')}</td>
        <td class="corta" title="${esc(disc)}">${esc(disc || '—')}</td>
        <td class="corta" title="${esc(ig?.igrejas?.nome || '')}">${esc(ig?.igrejas?.nome || '—')}</td>
        <td>${esc(u.ra)}</td>
        <td style="white-space:nowrap">${u.cpf ? esc(cpfBR(u.cpf)) : '—'}</td>
        <td class="corta" title="${esc(u.email)}">${esc(u.email)}</td>
        <td><span class="etiqueta et-${u.tipo}">${esc(TIPOS[u.tipo])}</span>${u.ativo ? '' : ' <span class="etiqueta et-inativo">inativo</span>'}</td>
        <td><div class="acoes-celula">
          <button class="btn-icone b-ed" title="Editar">✏️</button>
          <button class="btn-icone b-cod" title="Redefinir senha (gerar código)">🔑</button>
          ${u.tipo === 'aluno' ? '<button class="btn-icone b-pro" title="Promover a monitor">⬆️</button>' : ''}
          ${u.tipo === 'monitor' ? '<button class="btn-icone b-pro" title="Voltar a aluno">⬇️</button>' : ''}
          ${eu ? '' : `<button class="btn-icone b-at" title="${u.ativo ? 'Inativar' : 'Ativar'}">${u.ativo ? '⏸️' : '▶️'}</button>`}
          ${eu ? '' : '<button class="btn-icone b-ex" title="Excluir">🗑️</button>'}
        </div></td></tr></table>`).querySelector('tr');
      $('.b-ed', tr).onclick = () => editar(u, ig?.igreja_id);
      $('.b-cod', tr).onclick = () => redefinir(u);
      const bp = $('.b-pro', tr); if (bp) bp.onclick = () => promover(u);
      const ba = $('.b-at', tr); if (ba) ba.onclick = () => alternarAtivo(u);
      const bx = $('.b-ex', tr); if (bx) bx.onclick = () => excluir(u);
      tb.append(tr);
    }

    // paginação: listas "1", "2", "3"…
    const pags = Math.ceil(total / POR_PAGINA);
    const pg = $('.paginacao', cTab);
    pg.innerHTML = pags > 1 ? Array.from({ length: pags }, (_, i) => `<button class="${i === pagina ? 'ativa' : ''}" data-p="${i}">${i + 1}</button>`).join('') : '';
    pg.querySelectorAll('button').forEach((b) => (b.onclick = () => { pagina = +b.dataset.p; desenhar(); }));
  }

  $('.b-busca', cTab).oninput = () => { clearTimeout(temporizador); temporizador = setTimeout(() => { pagina = 0; desenhar(); }, 300); };
  $('.f-tipo', cTab).onchange = () => { pagina = 0; desenhar(); };

  async function redefinir(u) {
    if (!u.ativo) return toast('Ative a pessoa antes de gerar um código.', 'erro');
    if (!(await confirmar(`Gerar um novo código de 6 dígitos para <b>${esc(u.nome)}</b>? A senha atual continua valendo até ela usar o código e criar outra.`, { rotulo: 'Gerar código' }))) return;
    try {
      const r = await api('gerar_codigo', { id: u.id });
      await mostrarCodigo({ codigo: r.codigo, nome: u.nome, telefone: u.telefone, aoEnviarEmail: () => api('enviar_codigo_email', { id: u.id, codigo: r.codigo }) });
    } catch (e) { erro(e); }
  }

  async function promover(u) {
    const novo = u.tipo === 'aluno' ? 'monitor' : 'aluno';
    const txt = novo === 'monitor' ? `Promover <b>${esc(u.nome)}</b> a <b>monitor</b>? Ele passa a cadastrar igrejas, eventos, disciplinas e requisitos.` : `Voltar <b>${esc(u.nome)}</b> para o perfil de <b>aluno</b>?`;
    if (!(await confirmar(txt, { rotulo: novo === 'monitor' ? 'Promover' : 'Confirmar' }))) return;
    try { await api('definir_tipo', { id: u.id, tipo: novo }); toast('Perfil atualizado.'); desenhar(); } catch (e) { erro(e); }
  }

  async function alternarAtivo(u) {
    const txt = u.ativo
      ? `Inativar <b>${esc(u.nome)}</b>? Tudo o que ela fez fica guardado, mas ela não consegue mais entrar.`
      : `Reativar <b>${esc(u.nome)}</b>? Ela volta a entrar com a mesma senha.`;
    if (!(await confirmar(txt, { rotulo: u.ativo ? 'Inativar' : 'Ativar', perigo: u.ativo }))) return;
    try { await api('definir_ativo', { id: u.id, ativo: !u.ativo }); toast(u.ativo ? 'Pessoa inativada.' : 'Pessoa reativada.'); desenhar(); } catch (e) { erro(e); }
  }

  async function excluir(u) {
    try {
      const n = ok(await sb.rpc('contar_historico', { p_tabela: 'aluno', p_id: u.id }));
      if (n > 0) {
        if (await confirmar(`<b>${esc(u.nome)}</b> tem ${n} registro(s) de prática e não pode ser excluído(a). Deseja <b>inativar</b>? O histórico fica guardado.`, { rotulo: 'Inativar' })) {
          await api('definir_ativo', { id: u.id, ativo: false }); toast('Pessoa inativada.'); desenhar();
        }
        return;
      }
      const txt = await confirmar(`Todos os dados de <b>${esc(u.nome)}</b> serão <b>apagados do sistema permanentemente</b>.`, { titulo: 'Excluir pessoa', perigo: true, rotulo: 'Excluir', exigirTexto: u.nome });
      if (!txt) return;
      await api('excluir_usuario', { id: u.id, confirmacao: txt });
      toast('Pessoa excluída.');
      if (editando?.id === u.id) limpar();
      desenhar();
    } catch (e) { erro(e); }
  }

  await desenhar();
}
