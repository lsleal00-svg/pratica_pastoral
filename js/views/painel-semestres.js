// Cadastro de semestres e de blocos de prática pastoral, com calendário no topo
import { sb, ok } from '../supa.js';
import { $, esc, html, dataBR, toast, erro, confirmar, modal, lerForm, preencherForm, ocupado, isoBrasilia, diaLocal, horaLocal, vazio } from '../ui.js';
import { estado, carregarBase, semestreNome, situacaoPratica } from '../dados.js';
import { criarCalendario } from '../calendario.js';
import { periodo } from './calendario.js';

export default async function (raiz) {
  const cal = criarCalendario({});
  const cCal = html('<div class="cartao"></div>');
  cCal.append(cal.raiz);

  const cSem = html(`<div class="cartao"><h3>Cadastrar semestre</h3>
    <form><div class="grade-3">
      <label class="campo"><span>Nome do semestre <b class="obr">*</b></span><input name="nome" required placeholder="Ex.: 2026.2"></label>
      <label class="campo"><span>Data de início <b class="obr">*</b></span><input name="inicio" type="date" required></label>
      <label class="campo"><span>Data de fim <b class="obr">*</b></span><input name="fim" type="date" required></label>
    </div><button class="btn" type="submit">Salvar semestre</button></form>
    <div class="tabela-rolagem" style="margin-top:16px"><table class="tabela"><thead><tr><th>Semestre</th><th>Início</th><th>Fim</th><th>Blocos</th><th>Ações</th></tr></thead><tbody class="tb-sem"></tbody></table></div></div>`);

  const cPra = html(`<div class="cartao"><h3>Cadastrar bloco de prática pastoral</h3>
    <p class="dica">O cumprimento dos requisitos e a comprovação do ancião precisam acontecer entre o início e o fim informados (horário de Brasília). Se as duas datas forem iguais, o bloco é de um dia só.</p>
    <form>
      <div class="grade-2">
        <label class="campo"><span>Nome da prática <b class="obr">*</b></span><input name="nome" required placeholder="Ex.: Prática Pastoral 1"></label>
        <label class="campo"><span>Semestre <b class="obr">*</b></span><select name="semestre_id" required></select></label>
        <label class="campo"><span>Data de início <b class="obr">*</b></span><input name="d_ini" type="date" required></label>
        <label class="campo"><span>Horário de início <b class="obr">*</b></span><input name="h_ini" type="time" required value="00:00"></label>
        <label class="campo"><span>Data de fim <b class="obr">*</b></span><input name="d_fim" type="date" required></label>
        <label class="campo"><span>Horário de fim <b class="obr">*</b></span><input name="h_fim" type="time" required value="23:59"></label>
      </div>
      <button class="btn" type="submit">Salvar prática</button></form>
    <div class="tabela-rolagem" style="margin-top:16px"><table class="tabela"><thead><tr><th>Prática</th><th>Semestre</th><th>Período</th><th>Situação</th><th>Ações</th></tr></thead><tbody class="tb-pra"></tbody></table></div></div>`);
  raiz.append(cCal, cSem, cPra);

  const fSem = $('form', cSem), fPra = $('form', cPra);
  // Ao escolher a data de início, a data de fim acompanha (bloco de um dia)
  fPra.d_ini.onchange = () => { if (!fPra.d_fim.value || fPra.d_fim.value < fPra.d_ini.value) fPra.d_fim.value = fPra.d_ini.value; };

  async function desenhar() {
    await carregarBase();
    cal.desenhar();
    fPra.semestre_id.innerHTML = estado.semestres.length
      ? estado.semestres.map((s) => `<option value="${s.id}" ${s.id === estado.semestreAtualId ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')
      : '<option value="">Cadastre um semestre primeiro</option>';

    const ts = $('.tb-sem', cSem);
    ts.innerHTML = estado.semestres.length ? '' : `<tr><td colspan="5">${vazio('Nenhum semestre cadastrado.')}</td></tr>`;
    for (const s of estado.semestres) {
      const n = estado.praticas.filter((p) => p.semestre_id === s.id).length;
      const tr = html(`<table><tr><td><b>${esc(s.nome)}</b>${s.id === estado.semestreAtualId ? ' <span class="etiqueta">atual</span>' : ''}</td><td>${dataBR(s.inicio)}</td><td>${dataBR(s.fim)}</td><td>${n}</td>
        <td><div class="acoes-celula"><button class="btn-icone b-ed" title="Editar">✏️</button><button class="btn-icone b-ex" title="Excluir">🗑️</button></div></td></tr></table>`).querySelector('tr');
      $('.b-ed', tr).onclick = () => editarSemestre(s);
      $('.b-ex', tr).onclick = () => excluirSemestre(s);
      ts.append(tr);
    }

    const tp = $('.tb-pra', cPra);
    const pras = [...estado.praticas].sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
    tp.innerHTML = pras.length ? '' : `<tr><td colspan="5">${vazio('Nenhum bloco de prática cadastrado.')}</td></tr>`;
    for (const p of pras) {
      const st = situacaoPratica(p);
      const tr = html(`<table><tr><td><b>${esc(p.nome)}</b></td><td>${esc(semestreNome(p.semestre_id))}</td><td>${periodo(p)}</td>
        <td><span class="status-pill ${st === 'aberta' ? 'status-aberta' : ''}" style="background:${st === 'aberta' ? '' : '#eef1f6'}">${{ aberta: 'Aberta', futura: 'Agendada', encerrada: 'Encerrada' }[st]}</span></td>
        <td><div class="acoes-celula"><button class="btn-icone b-ed" title="Editar">✏️</button><button class="btn-icone b-ex" title="Excluir">🗑️</button></div></td></tr></table>`).querySelector('tr');
      $('.b-ed', tr).onclick = () => editarPratica(p);
      $('.b-ex', tr).onclick = () => excluirPratica(p);
      tp.append(tr);
    }
  }

  // ------------------------------------------------ semestre
  fSem.onsubmit = (e) => {
    e.preventDefault();
    const d = lerForm(fSem);
    if (d.fim < d.inicio) return toast('A data de fim deve ser depois do início.', 'erro');
    ocupado(e.submitter, async () => {
      try { ok(await sb.from('semestres').insert(d)); fSem.reset(); toast('Semestre salvo.'); await desenhar(); cal.irPara(d.inicio); } catch (err) { erro(err); }
    });
  };

  async function editarSemestre(s) {
    const form = html(`<form><label class="campo"><span>Nome</span><input name="nome" required></label>
      <div class="grade-2"><label class="campo"><span>Início</span><input name="inicio" type="date" required></label>
      <label class="campo"><span>Fim</span><input name="fim" type="date" required></label></div></form>`);
    preencherForm(form, s);
    await modal({
      titulo: 'Editar semestre', corpo: form,
      acoes: [{ rotulo: 'Cancelar', classe: 'btn-sec', valor: false }, {
        rotulo: 'Salvar',
        antes: async () => {
          if (!form.reportValidity()) return false;
          const d = lerForm(form);
          if (d.fim < d.inicio) { toast('A data de fim deve ser depois do início.', 'erro'); return false; }
          try { ok(await sb.from('semestres').update(d).eq('id', s.id)); toast('Semestre atualizado.'); await desenhar(); } catch (e) { erro(e); return false; }
        },
      }],
    });
  }

  async function excluirSemestre(s) {
    try {
      const n = ok(await sb.rpc('contar_historico', { p_tabela: 'semestre', p_id: s.id }));
      if (n > 0) return toast(`O semestre ${s.nome} tem ${n} registro(s) de prática e não pode ser excluído.`, 'erro');
      if (!(await confirmar(`Excluir o semestre <b>${esc(s.nome)}</b>? Os blocos de prática dele ficarão com semestre <b>“não informado”</b>, e os vínculos de turmas e igrejas deste semestre serão removidos.`, { perigo: true, rotulo: 'Excluir', exigirTexto: s.nome }))) return;
      ok(await sb.from('semestres').delete().eq('id', s.id));
      toast('Semestre excluído.');
      await desenhar();
    } catch (e) { erro(e); }
  }

  // ------------------------------------------------ prática
  function lerPratica(form) {
    const d = lerForm(form);
    const inicio = isoBrasilia(d.d_ini, d.h_ini), fim = isoBrasilia(d.d_fim, d.h_fim);
    if (new Date(fim) <= new Date(inicio)) throw new Error('O fim da prática deve ser depois do início.');
    const s = estado.semestres.find((x) => x.id === d.semestre_id);
    if (s && (d.d_ini < s.inicio || d.d_fim > s.fim)) toast(`Aviso: o bloco está fora das datas do semestre ${s.nome}.`, 'erro');
    return { nome: d.nome, semestre_id: d.semestre_id || null, inicio, fim };
  }

  fPra.onsubmit = (e) => {
    e.preventDefault();
    if (!estado.semestres.length) return toast('Cadastre um semestre primeiro.', 'erro');
    ocupado(e.submitter, async () => {
      try {
        const reg = lerPratica(fPra);
        ok(await sb.from('praticas').insert(reg));
        fPra.reset(); fPra.h_ini.value = '00:00'; fPra.h_fim.value = '23:59';
        toast('Prática salva.');
        await desenhar();
        cal.irPara(reg.inicio.slice(0, 10));
      } catch (err) { erro(err); }
    });
  };

  async function editarPratica(p) {
    const form = fPra.cloneNode(true);
    form.querySelector('button').remove();
    form.querySelector('[name=semestre_id]').innerHTML = fPra.semestre_id.innerHTML;
    preencherForm(form, { nome: p.nome, semestre_id: p.semestre_id || '', d_ini: diaLocal(p.inicio), h_ini: horaLocal(p.inicio), d_fim: diaLocal(p.fim), h_fim: horaLocal(p.fim) });
    await modal({
      titulo: 'Editar prática', corpo: form, largo: true,
      acoes: [{ rotulo: 'Cancelar', classe: 'btn-sec', valor: false }, {
        rotulo: 'Salvar',
        antes: async () => {
          if (!form.reportValidity()) return false;
          try { ok(await sb.from('praticas').update(lerPratica(form)).eq('id', p.id)); toast('Prática atualizada.'); await desenhar(); } catch (e) { erro(e); return false; }
        },
      }],
    });
  }

  async function excluirPratica(p) {
    if (!(await confirmar(`Excluir o bloco <b>${esc(p.nome)}</b>?`, { perigo: true, rotulo: 'Excluir' }))) return;
    try { ok(await sb.from('praticas').delete().eq('id', p.id)); toast('Prática excluída.'); await desenhar(); } catch (e) { erro(e); }
  }

  await desenhar();
}
