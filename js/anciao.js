// Página pública do ancião: confirma ou pede revisão pelo link recebido no WhatsApp
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { esc, dataHoraBR } from './ui.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'pp_anciao' } });
const raiz = document.getElementById('conteudo');
const token = new URLSearchParams(location.search).get('t') || '';

function limparErro(m) { return String(m || '').replace(/^(PRAZO|JA):\s*/, ''); }

async function carregar() {
  if (!/^[0-9a-f]{20,}$/i.test(token)) return mostrarAviso('Link inválido', 'Este endereço não é um pedido de comprovação válido. Peça ao aluno para enviar o link de novo.');
  const { data, error } = await sb.rpc('ver_envio', { p_token: token });
  if (error) return mostrarAviso('Não foi possível carregar', 'Verifique sua internet e abra o link de novo.');
  if (!data) return mostrarAviso('Pedido não encontrado', 'Este link não existe mais. Peça ao aluno para enviar um novo.');
  desenhar(data);
}

function mostrarAviso(titulo, texto, tipo = 'info') {
  raiz.innerHTML = `<div class="cartao"><h3>${esc(titulo)}</h3><div class="aviso aviso-${tipo}">${esc(texto)}</div></div>`;
}

function desenhar(d) {
  const respondido = d.status !== 'enviado';
  const situacao = d.status === 'confirmado'
    ? `<div class="aviso aviso-ok">Você confirmou este pedido em ${dataHoraBR(d.respondido_em)}. Obrigado!</div>`
    : d.status === 'revisar'
      ? `<div class="aviso aviso-amarelo">Você pediu revisão em ${dataHoraBR(d.respondido_em)}. Um novo pedido do aluno chegará em breve.${d.observacao ? `<br><b>Sua observação:</b> ${esc(d.observacao)}` : ''}</div>`
      : !d.aberto
        ? `<div class="aviso aviso-erro">O prazo deste bloco de prática terminou em ${dataHoraBR(d.fim)}. Não é mais possível responder por aqui; o professor da disciplina fará a análise.</div>`
        : '';

  raiz.innerHTML = `<div class="cartao">
    <p style="margin:0 0 8px">Olá${d.anciao ? ', <b>' + esc(d.anciao) + '</b>' : ''}!</p>
    <p style="margin:0">O estudante <b>${esc(d.aluno)}</b>${d.turma ? ` (${esc(d.turma)})` : ''} informou que cumpriu os requisitos abaixo na igreja <b>${esc(d.igreja)}</b>, em <b>${esc(d.pratica)}</b>.</p>
    <ul class="itens-anciao">${d.itens.map((i) => `<li><span class="ok">✓</span><span>${esc(i.enunciado)}<br><small class="dica">${esc(i.disciplina)}</small></span></li>`).join('')}</ul>
    <p class="dica">Prazo para responder: até ${dataHoraBR(d.fim)}.</p>
    ${situacao}
    ${!respondido && d.aberto ? `
      <label class="campo" style="margin-top:12px"><span>Observações (opcional)</span>
        <textarea id="obs" maxlength="1000" placeholder="Se for pedir revisão, explique o que precisa ser corrigido."></textarea></label>
      <div class="botoes-anciao">
        <button class="btn btn-confirmar" id="b-conf">✓ Confirmar</button>
        <button class="btn btn-sec" id="b-rev">↺ Revisar</button>
      </div>
      <div id="msg"></div>` : ''}
  </div>`;

  if (!respondido && d.aberto) {
    document.getElementById('b-conf').onclick = () => responder(true);
    document.getElementById('b-rev').onclick = () => responder(false);
  }
}

async function responder(confirmar) {
  const obs = document.getElementById('obs').value.trim();
  const bs = raiz.querySelectorAll('.botoes-anciao .btn');
  bs.forEach((b) => (b.disabled = true));
  const { error } = await sb.rpc('responder_envio', { p_token: token, p_confirmar: confirmar, p_observacao: obs || null });
  if (error) {
    bs.forEach((b) => (b.disabled = false));
    document.getElementById('msg').innerHTML = `<div class="aviso aviso-erro" style="margin-top:12px">${esc(limparErro(error.message) || 'Não foi possível registrar. Verifique a internet e tente de novo.')}</div>`;
    return;
  }
  await carregar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

carregar();
