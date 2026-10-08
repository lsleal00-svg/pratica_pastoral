// Calendário acadêmico: semestre (verde), práticas (amarelo), eventos (azul)
import { sb, ok } from '../supa.js';
import { esc, html, dataBR, dataHoraBR, modal, confirmar, toast, erro, lerForm, preencherForm, eEquipe, vazio, diaLocal } from '../ui.js';
import { estado, carregarBase, semestreAtual, situacaoPratica, turmaNome } from '../dados.js';
import { criarCalendario, eventoVisivel } from '../calendario.js';

export default async function (raiz) {
  const equipe = eEquipe(estado.perfil);
  const cal = criarCalendario({ aoClicarDia: mostrarDia });
  const cartaoCal = html('<div class="cartao"></div>');
  cartaoCal.append(cal.raiz);
  raiz.append(cartaoCal);

  const cPraticas = html('<div class="cartao"><h3>Blocos de prática pastoral</h3><div class="lista-praticas"></div></div>');
  const cEventos = html(`<div class="cartao"><div class="cartao-topo"><h3>Eventos</h3>${equipe ? '<button class="btn btn-peq b-novo">+ Novo evento</button>' : ''}</div><div class="lista-eventos lista-praticas"></div></div>`);
  raiz.append(cPraticas, cEventos);
  if (equipe) cEventos.querySelector('.b-novo').onclick = () => editarEvento(null);

  function desenharListas() {
    const sem = semestreAtual();
    const praticas = estado.praticas
      .filter((p) => !sem || p.semestre_id === sem.id || !p.semestre_id)
      .sort((a, b) => (a.inicio > b.inicio ? 1 : -1));
    const lp = cPraticas.querySelector('.lista-praticas');
    lp.innerHTML = praticas.length ? '' : vazio('Nenhum bloco de prática cadastrado neste semestre.');
    for (const p of praticas) {
      const s = situacaoPratica(p);
      const rot = { aberta: 'Aberta agora', futura: 'Agendada', encerrada: 'Encerrada' }[s];
      const b = html(`<button class="bloco-pratica ${s === 'encerrada' ? 'passada' : ''}">
        <span><b>${esc(p.nome)}</b><small>${periodo(p)}</small></span>
        <span class="status-pill ${s === 'aberta' ? 'status-aberta' : ''}">${rot}</span></button>`);
      b.onclick = () => mostrarPratica(p);
      lp.append(b);
    }

    const hoje = diaLocal(new Date());
    const evs = estado.eventos.filter((e) => eventoVisivel(e, estado.perfil) && e.data >= addMeses(hoje, -1))
      .sort((a, b) => (a.data > b.data ? 1 : -1));
    const le = cEventos.querySelector('.lista-eventos');
    le.innerHTML = evs.length ? '' : vazio('Nenhum evento próximo.');
    for (const e of evs) {
      const item = html(`<div class="bloco-evento">
        <span><b>${esc(e.titulo)}</b><br><small>${dataBR(e.data)}${e.hora ? ' às ' + e.hora.slice(0, 5) : ''}${e.turmas?.length ? ' · ' + esc(e.turmas.map(turmaNome).join(', ')) : ''}</small>
        ${e.descricao ? `<div class="dica">${esc(e.descricao)}</div>` : ''}</span>
        ${equipe ? '<span class="acoes-celula"><button class="btn-icone b-ed" title="Editar">✏️</button><button class="btn-icone b-ex" title="Excluir">🗑️</button></span>' : ''}
      </div>`);
      if (equipe) {
        item.querySelector('.b-ed').onclick = () => editarEvento(e);
        item.querySelector('.b-ex').onclick = () => excluirEvento(e);
      }
      le.append(item);
    }
  }

  async function recarregar() {
    await carregarBase();
    cal.desenhar();
    desenharListas();
  }

  async function editarEvento(ev) {
    const form = html(`<form>
      <label class="campo"><span>Título <b class="obr">*</b></span><input name="titulo" required></label>
      <div class="grade-2">
        <label class="campo"><span>Data <b class="obr">*</b></span><input name="data" type="date" required></label>
        <label class="campo"><span>Hora</span><input name="hora" type="time"></label>
      </div>
      <label class="campo"><span>Descrição</span><textarea name="descricao"></textarea></label>
      <div class="campo"><span>Turmas (nenhuma marcada = todas)</span>
        <div class="lista-sel">${estado.turmas.map((t) => `<label class="check"><input type="checkbox" value="${t.id}"> ${esc(t.nome)}</label>`).join('') || '<small>Nenhuma turma cadastrada.</small>'}</div>
      </div></form>`);
    if (ev) {
      preencherForm(form, { ...ev, hora: ev.hora?.slice(0, 5) || '' });
      form.querySelectorAll('.lista-sel input').forEach((i) => (i.checked = ev.turmas?.includes(i.value)));
    }
    await modal({
      titulo: ev ? 'Editar evento' : 'Novo evento', corpo: form,
      acoes: [{ rotulo: 'Cancelar', classe: 'btn-sec', valor: false }, {
        rotulo: 'Salvar',
        antes: async () => {
          if (!form.reportValidity()) return false;
          const d = lerForm(form);
          const turmas = [...form.querySelectorAll('.lista-sel input:checked')].map((i) => i.value);
          const reg = { titulo: d.titulo, data: d.data, hora: d.hora || null, descricao: d.descricao || null, turmas: turmas.length ? turmas : null };
          try {
            if (ev) ok(await sb.from('eventos').update(reg).eq('id', ev.id));
            else ok(await sb.from('eventos').insert({ ...reg, criado_por: estado.perfil.id }));
            toast('Evento salvo.');
            await recarregar();
          } catch (e) { erro(e); return false; }
        },
      }],
    });
  }

  async function excluirEvento(ev) {
    if (!(await confirmar(`Excluir o evento <b>${esc(ev.titulo)}</b>?`, { perigo: true, rotulo: 'Excluir' }))) return;
    try { ok(await sb.from('eventos').delete().eq('id', ev.id)); toast('Evento excluído.'); await recarregar(); } catch (e) { erro(e); }
  }

  function mostrarDia(dia, praticas, eventos) {
    const corpo = `${praticas.map((p) => `<div class="bloco-pratica" style="cursor:default;margin-bottom:8px"><span><b>${esc(p.nome)}</b><small>${periodo(p)}</small></span></div>`).join('')}
      ${eventos.map((e) => `<div class="bloco-evento" style="margin-bottom:8px"><span><b>${esc(e.titulo)}</b>${e.hora ? ' · ' + e.hora.slice(0, 5) : ''}${e.descricao ? `<div class="dica">${esc(e.descricao)}</div>` : ''}</span></div>`).join('')}`;
    modal({ titulo: dataBR(dia), corpo, acoes: [{ rotulo: 'Fechar' }] });
  }

  function mostrarPratica(p) {
    const s = situacaoPratica(p);
    modal({
      titulo: p.nome,
      corpo: `<p><b>Período:</b> ${periodo(p)}</p>
        <p><b>Situação:</b> ${{ aberta: 'aberta para cumprimento', futura: 'ainda não começou', encerrada: 'encerrada' }[s]}</p>
        <p class="dica">O cumprimento e a comprovação do ancião precisam acontecer dentro deste período. A lista do que foi cumprido em cada bloco e o relatório em PDF chegam nas próximas atualizações.</p>`,
      acoes: [{ rotulo: 'Fechar' }],
    });
  }

  desenharListas();
}

export function periodo(p) {
  const a = diaLocal(p.inicio), b = diaLocal(p.fim);
  return a === b ? `${dataBR(a)}, das ${dataHoraBR(p.inicio).slice(-5)} às ${dataHoraBR(p.fim).slice(-5)}`
    : `${dataHoraBR(p.inicio)} até ${dataHoraBR(p.fim)}`;
}

function addMeses(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}
