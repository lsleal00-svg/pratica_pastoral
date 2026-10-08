// Cadastro de turmas
import { sb, ok } from '../supa.js';
import { $, esc, html, toast, erro, confirmar, modal, ocupado, vazio } from '../ui.js';
import { estado, carregarBase } from '../dados.js';

export default async function (raiz) {
  const c = html(`<div class="cartao"><h3>Cadastrar turma</h3>
    <form class="linha-botoes" style="align-items:flex-end">
      <label class="campo" style="flex:1;min-width:200px;margin:0"><span>Nome da turma <b class="obr">*</b></span><input name="nome" required placeholder="Ex.: 16º Turma"></label>
      <button class="btn" type="submit">Salvar</button>
    </form></div>`);
  const t = html(`<div class="cartao"><h3>Turmas cadastradas</h3><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Turma</th><th>Pessoas</th><th>Ações</th></tr></thead><tbody></tbody></table></div></div>`);
  raiz.append(c, t);

  async function desenhar() {
    await carregarBase();
    const pessoas = ok(await sb.from('perfis').select('turma_id')) || [];
    const tb = $('tbody', t);
    tb.innerHTML = estado.turmas.length ? '' : `<tr><td colspan="3">${vazio('Nenhuma turma cadastrada.')}</td></tr>`;
    for (const tu of estado.turmas) {
      const n = pessoas.filter((p) => p.turma_id === tu.id).length;
      const tr = html(`<table><tr><td><b>${esc(tu.nome)}</b></td><td>${n}</td><td><div class="acoes-celula">
        <button class="btn-icone b-ed" title="Editar">✏️</button><button class="btn-icone b-ex" title="Excluir">🗑️</button></div></td></tr></table>`).querySelector('tr');
      $('.b-ed', tr).onclick = () => editar(tu);
      $('.b-ex', tr).onclick = () => excluir(tu, n);
      tb.append(tr);
    }
  }

  $('form', c).onsubmit = (e) => {
    e.preventDefault();
    const nome = e.target.nome.value.trim();
    ocupado(e.submitter, async () => {
      try { ok(await sb.from('turmas').insert({ nome })); e.target.reset(); toast('Turma salva.'); await desenhar(); } catch (err) { erro(err); }
    });
  };

  async function editar(tu) {
    const corpo = html(`<label class="campo"><span>Nome da turma</span><input value="${esc(tu.nome)}"></label>`);
    await modal({
      titulo: 'Editar turma', corpo,
      acoes: [{ rotulo: 'Cancelar', classe: 'btn-sec', valor: false }, {
        rotulo: 'Salvar',
        antes: async () => {
          const nome = corpo.querySelector('input').value.trim();
          if (!nome) return false;
          try { ok(await sb.from('turmas').update({ nome }).eq('id', tu.id)); toast('Turma atualizada.'); await desenhar(); } catch (e) { erro(e); return false; }
        },
      }],
    });
  }

  async function excluir(tu, n) {
    const aviso = n
      ? `<b>${n} pessoa(s)</b> pertencem à turma <b>${esc(tu.nome)}</b>. Ao excluir, todas ficarão com status <b>“sem turma informada”</b> e a turma sai das disciplinas vinculadas.`
      : `Excluir a turma <b>${esc(tu.nome)}</b>?`;
    if (!(await confirmar(aviso, { titulo: 'Excluir turma', perigo: true, rotulo: 'Excluir', exigirTexto: n ? tu.nome : null }))) return;
    try { ok(await sb.from('turmas').delete().eq('id', tu.id)); toast('Turma excluída.'); await desenhar(); } catch (e) { erro(e); }
  }

  await desenhar();
}
