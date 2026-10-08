// Pedidos de acesso feitos pela tela de primeiro acesso
import { sb, ok, api } from '../supa.js';
import { $, esc, html, dataBR, cpfBR, telBR, dataHoraBR, toast, erro, confirmar, modal, mostrarCodigo, vazio } from '../ui.js';
import { estado, semestreAtual, turmaNome } from '../dados.js';

export default async function (raiz) {
  const c = html(`<div class="cartao"><div class="cartao-topo"><h3>Pedidos de acesso</h3>
    <select class="entrada f-st" style="width:auto"><option value="pendente">Pendentes</option><option value="aprovado">Aprovados</option><option value="recusado">Recusados</option></select></div>
    <div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Nome</th><th>Nascimento</th><th>Turma</th><th>RA</th><th>CPF</th><th>E-mail</th><th>WhatsApp</th><th>Pedido em</th><th>Ações</th></tr></thead><tbody></tbody></table></div></div>`);
  raiz.append(c);
  const igrejas = ok(await sb.from('igrejas').select('id, nome').eq('ativa', true).order('nome')) || [];

  async function desenhar() {
    const st = $('.f-st', c).value;
    const lista = ok(await sb.from('pedidos_acesso').select('*').eq('status', st).order('criado_em', { ascending: false }).limit(200)) || [];
    const tb = $('tbody', c);
    tb.innerHTML = lista.length ? '' : `<tr><td colspan="9">${vazio(st === 'pendente' ? 'Nenhum pedido aguardando análise.' : 'Nenhum pedido.')}</td></tr>`;
    for (const p of lista) {
      const tr = html(`<table><tr>
        <td class="corta" title="${esc(p.nome)}"><b>${esc(p.nome)}</b></td><td>${dataBR(p.nascimento)}</td>
        <td>${esc(turmaNome(p.turma_id))}</td><td>${esc(p.ra)}</td><td style="white-space:nowrap">${p.cpf ? esc(cpfBR(p.cpf)) : '—'}</td>
        <td class="corta" title="${esc(p.email)}">${esc(p.email)}</td><td style="white-space:nowrap">${esc(telBR(p.telefone))}</td>
        <td style="white-space:nowrap">${dataHoraBR(p.criado_em)}</td>
        <td>${st === 'pendente' ? '<div class="acoes-celula"><button class="btn btn-peq b-ap">Aprovar</button><button class="btn btn-sec btn-peq b-rc">Recusar</button></div>' : '—'}</td>
      </tr></table>`).querySelector('tr');
      if (st === 'pendente') {
        $('.b-ap', tr).onclick = () => aprovar(p);
        $('.b-rc', tr).onclick = () => recusar(p);
      }
      tb.append(tr);
    }
  }
  $('.f-st', c).onchange = desenhar;

  async function aprovar(p) {
    const sem = semestreAtual();
    const corpo = html(`<div>
      <p>Aprovar o acesso de <b>${esc(p.nome)}</b> como <b>aluno</b>.</p>
      <label class="campo"><span>Turma</span><select name="turma_id">${estado.turmas.map((t) => `<option value="${t.id}" ${t.id === p.turma_id ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select><small>Corrija aqui se o aluno escolheu a turma errada.</small></label>
      <label class="campo"><span>Igreja ${sem ? `(${esc(sem.nome)})` : ''}</span><select name="igreja_id"><option value="">Vincular depois</option>${igrejas.map((g) => `<option value="${g.id}">${esc(g.nome)}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" name="email" checked> Enviar o código também por e-mail</label>
    </div>`);
    const r = await modal({ titulo: 'Aprovar pedido', corpo, acoes: [{ rotulo: 'Cancelar', classe: 'btn-sec', valor: false }, { rotulo: 'Aprovar e gerar código' }] });
    if (!r) return;
    try {
      const res = await api('aprovar_pedido', {
        id: p.id,
        turma_id: corpo.querySelector('[name=turma_id]').value,
        igreja_id: corpo.querySelector('[name=igreja_id]').value,
        enviar_email: corpo.querySelector('[name=email]').checked,
      });
      if (corpo.querySelector('[name=email]').checked) {
        toast(res.email_enviado ? 'Código enviado por e-mail.' : 'O e-mail não saiu (Brevo não configurado). Envie pelo WhatsApp.', res.email_enviado ? 'ok' : 'erro');
      }
      await mostrarCodigo({ codigo: res.codigo, nome: res.nome, telefone: res.telefone, aoEnviarEmail: () => api('enviar_codigo_email', { id: res.id, codigo: res.codigo }) });
      desenhar();
    } catch (e) { erro(e); }
  }

  async function recusar(p) {
    if (!(await confirmar(`Recusar o pedido de <b>${esc(p.nome)}</b>?`, { perigo: true, rotulo: 'Recusar' }))) return;
    try { await api('recusar_pedido', { id: p.id }); toast('Pedido recusado.'); desenhar(); } catch (e) { erro(e); }
  }

  await desenhar();
}
