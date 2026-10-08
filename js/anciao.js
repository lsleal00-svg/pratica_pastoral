// App do ancião: login por telefone, lista de teologandos, aprovar ou pedir correção
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { $, $$, esc, html, dataHoraBR, telBR, linkWhats, toast, modal, iniciais } from './ui.js';

// ------------------------------------------------------------ sessão própria (separada da do aluno)
const MARCA = 'pp_anciao_manter';
const area = () => { try { return localStorage.getItem(MARCA) === '1' ? localStorage : sessionStorage; } catch { return sessionStorage; } };
const armazenamento = {
  getItem: (k) => { try { return area().getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { area().setItem(k, v); } catch {} },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch {} try { sessionStorage.removeItem(k); } catch {} },
};
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: armazenamento, persistSession: true, autoRefreshToken: true, storageKey: 'pp_sessao_anciao' },
});
const raiz = $('#conteudo');

async function api(acao, dados) {
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify({ acao, dados }),
    });
  } catch { throw new Error('Sem conexão. Verifique sua internet.'); }
  let c = {}; try { c = await r.json(); } catch {}
  if (!r.ok || c.erro) throw new Error(c.erro || 'Erro no servidor.');
  return c;
}
const limparErro = (m) => String(m || '').replace(/^(PRAZO|JA):\s*/, '');
const rpc = async (fn, args) => {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(/fetch/i.test(error.message) ? 'Sem conexão. Verifique sua internet.' : limparErro(error.message));
  return data;
};

// ------------------------------------------------------------ entrada

let telefone = '';

function telaTelefone(msg = '') {
  $('#sub').textContent = 'Área do ancião';
  ['b-sino', 'b-sair'].forEach((id) => $('#' + id).classList.add('oculto'));
  raiz.innerHTML = `<div class="cartao">
    <h3>Entrar</h3>
    <p class="dica">Área exclusiva dos anciãos e anciãs das igrejas onde os estudantes de Teologia da FAAMA fazem prática pastoral.</p>
    ${msg}
    <form id="f-tel">
      <label class="campo"><span>Seu telefone (WhatsApp) com DDD</span>
        <input name="tel" type="tel" inputmode="tel" autocomplete="tel" placeholder="(91) 90000-0000" required value="${esc(telefone)}"></label>
      <button class="btn btn-bloco" type="submit">Continuar</button>
    </form></div>`;
  $('#f-tel').onsubmit = async (e) => {
    e.preventDefault();
    const b = e.submitter; b.disabled = true;
    telefone = e.target.tel.value.trim();
    try {
      const r = await api('anciao_verificar', { telefone });
      r.tem_senha ? telaSenha(r) : telaPrimeiroAcesso(r);
    } catch (err) {
      b.disabled = false;
      $('#f-tel').insertAdjacentHTML('beforebegin', `<div class="aviso aviso-erro">${esc(err.message)}</div>`);
    }
  };
}

function telaSenha(r) {
  raiz.innerHTML = `<div class="cartao">
    <h3>Olá${r.nome ? ', ' + esc(r.nome) : ''}!</h3>
    <p class="dica">Telefone ${esc(telBR(telefone))}</p>
    <div id="msg"></div>
    <form id="f-senha">
      <label class="campo"><span>Sua senha</span><input name="senha" type="password" required autocomplete="current-password"></label>
      <label class="check" style="margin-bottom:14px"><input type="checkbox" name="manter" checked> Manter-me conectado</label>
      <button class="btn btn-bloco" type="submit">Entrar</button>
    </form>
    <p class="dica" style="margin-top:14px">Esqueceu a senha ou trocou de celular? Peça ao professor da disciplina para redefinir o seu acesso.</p>
    <button class="link-btn" id="b-voltar">← Usar outro telefone</button></div>`;
  $('#b-voltar').onclick = () => telaTelefone();
  $('#f-senha').onsubmit = async (e) => {
    e.preventDefault();
    const b = e.submitter; b.disabled = true;
    try {
      manter(e.target.manter.checked);
      const { error } = await sb.auth.signInWithPassword({ email: r.email, password: e.target.senha.value });
      if (error) throw new Error(/invalid/i.test(error.message) ? 'Senha incorreta.' : error.message);
      await painel();
    } catch (err) { b.disabled = false; $('#msg').innerHTML = `<div class="aviso aviso-erro">${esc(err.message)}</div>`; }
  };
}

function telaPrimeiroAcesso(r) {
  raiz.innerHTML = `<div class="cartao">
    <h3>Primeiro acesso</h3>
    <p>Olá${r.nome ? ', <b>' + esc(r.nome) + '</b>' : ''}! Crie uma senha para o telefone <b>${esc(telBR(telefone))}</b>. Ela vai ficar guardada neste celular.</p>
    <div id="msg"></div>
    <form id="f-nova">
      <label class="campo"><span>Crie uma senha (mínimo de 6 caracteres)</span><input name="s1" type="password" minlength="6" required autocomplete="new-password"></label>
      <label class="campo"><span>Repita a senha</span><input name="s2" type="password" minlength="6" required autocomplete="new-password"></label>
      <label class="check" style="margin-bottom:14px"><input type="checkbox" name="manter" checked> Manter-me conectado</label>
      <button class="btn btn-bloco" type="submit">Criar senha e entrar</button>
    </form>
    <button class="link-btn" id="b-voltar" style="margin-top:10px">← Usar outro telefone</button></div>`;
  $('#b-voltar').onclick = () => telaTelefone();
  $('#f-nova').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, b = e.submitter;
    const erro = (t) => ($('#msg').innerHTML = `<div class="aviso aviso-erro">${esc(t)}</div>`);
    if (f.s1.value !== f.s2.value) return erro('As duas senhas não são iguais.');
    b.disabled = true;
    try {
      const c = await api('anciao_criar_senha', { telefone, senha: f.s1.value });
      manter(f.manter.checked);
      const { error } = await sb.auth.signInWithPassword({ email: c.email, password: f.s1.value });
      if (error) throw new Error(error.message);
      await painel();
    } catch (err) { b.disabled = false; erro(err.message); }
  };
}

function manter(sim) { try { sim ? localStorage.setItem(MARCA, '1') : localStorage.removeItem(MARCA); } catch {} }

// ------------------------------------------------------------ painel

const STATUS = {
  pendente: ['Pendente', 'var(--amarelo-claro)', '#7a5a00'],
  vencido: ['Prazo vencido', 'var(--vermelho-claro)', '#8d2119'],
  correcao: ['Aguardando correção', 'var(--azul-claro)', '#1d4fa8'],
  aprovado: ['Aprovado', 'var(--verde-claro)', '#12663a'],
  sem: ['Nenhum envio', '#eef1f6', '#45506a'],
};
const pill = (k) => `<span class="status-pill" style="background:${STATUS[k][1]};color:${STATUS[k][2]}">${STATUS[k][0]}</span>`;

function statusAluno(a) {
  const es = a.envios || [];
  if (es.some((e) => e.status === 'enviado' && !e.vencido)) return 'pendente';
  if (es.some((e) => e.status === 'enviado' && e.vencido)) return 'vencido';
  if (es.some((e) => e.status === 'revisar')) return 'correcao';
  if (es.some((e) => e.status === 'confirmado')) return 'aprovado';
  return 'sem';
}

const abertos = new Set();

async function painel() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return telaTelefone();
  ['b-sino', 'b-sair'].forEach((id) => $('#' + id).classList.remove('oculto'));
  $('#b-sair').onclick = async () => { await sb.auth.signOut(); manter(false); telaTelefone(); };
  $('#b-sino').onclick = (e) => { e.stopPropagation(); abrirNotificacoes(); };
  atualizarSino();

  let d;
  try { d = await rpc('anciao_painel'); }
  catch (err) {
    if (/Acesso negado/.test(err.message)) { await sb.auth.signOut(); return telaTelefone(`<div class="aviso aviso-erro">Seu acesso não está ativo. Procure o professor da disciplina.</div>`); }
    raiz.innerHTML = `<div class="cartao"><div class="aviso aviso-erro">${esc(err.message)}</div><button class="btn" id="b-tentar">Tentar de novo</button></div>`;
    $('#b-tentar').onclick = painel;
    return;
  }
  $('#sub').textContent = d.anciao?.nome || 'Área do ancião';
  raiz.innerHTML = '';
  if (!d.igrejas.length) {
    raiz.innerHTML = `<div class="cartao"><div class="aviso aviso-amarelo">Seu telefone não está mais ligado a nenhuma igreja. Procure o professor da disciplina.</div></div>`;
    return;
  }
  for (const g of d.igrejas) raiz.append(cartaoIgreja(g));
}

function cartaoIgreja(g) {
  const c = html(`<div class="cartao">
    <div class="cartao-topo" style="margin-bottom:6px"><div><h3 style="margin:0">⛪ ${esc(g.nome)}</h3>
      <small class="dica">${esc(g.rua)} · ${esc(g.bairro)} · ${esc(g.cidade)}<br>Pastor: ${esc(g.pastor_nome)} · ${esc(telBR(g.pastor_tel))}</small></div></div>
    <h4 style="margin:12px 0 0;font-size:14px;color:var(--suave);text-transform:uppercase;letter-spacing:.4px">Teologandos</h4>
    <div class="lista-alunos"></div></div>`);
  const lista = $('.lista-alunos', c);
  const alunos = [...g.alunos].sort((a, b) => {
    const ordem = ['pendente', 'vencido', 'correcao', 'aprovado', 'sem'];
    return ordem.indexOf(statusAluno(a)) - ordem.indexOf(statusAluno(b)) || a.nome.localeCompare(b.nome);
  });
  if (!alunos.length) lista.innerHTML = '<div class="vazio">Nenhum teologando vinculado a esta igreja neste semestre.</div>';
  for (const a of alunos) {
    const st = statusAluno(a);
    const linha = html(`<button class="aluno-linha ${abertos.has(a.id) ? 'aberto' : ''}">
      <span class="avatar avatar-ini" style="width:38px;height:38px;font-size:14px">${esc(iniciais(a.nome))}</span>
      <span class="nome"><b>${esc(a.nome)}</b><small>${esc(a.turma || '')}</small></span>${pill(st)}<span class="seta">›</span></button>`);
    const det = html(`<div class="aluno-detalhe ${abertos.has(a.id) ? '' : 'oculto'}"></div>`);
    linha.onclick = () => {
      const abrir = det.classList.contains('oculto');
      det.classList.toggle('oculto', !abrir); linha.classList.toggle('aberto', abrir);
      abrir ? abertos.add(a.id) : abertos.delete(a.id);
    };
    preencherAluno(det, a, g);
    lista.append(linha, det);
  }
  return c;
}

function preencherAluno(det, a, g) {
  const envios = a.envios || [];
  if (!envios.length) { det.innerHTML = '<p class="dica">Ainda não enviou requisitos para aprovação.</p>'; return; }
  det.innerHTML = a.telefone ? `<a class="link-btn" style="display:inline-block;margin:4px 0" target="_blank" rel="noopener" href="${esc(linkWhats(a.telefone, ''))}">💬 Falar com ${esc(a.nome.split(' ')[0])} no WhatsApp</a>` : '';
  for (const e of envios) {
    const rot = e.status === 'confirmado' ? 'aprovado' : e.status === 'revisar' ? 'correcao' : e.vencido ? 'vencido' : 'pendente';
    const caixa = html(`<div class="envio">
      <div class="cartao-topo" style="margin:0"><div><h4>${esc(e.pratica)}</h4><small class="dica">Enviado em ${dataHoraBR(e.criado_em)}</small></div>${pill(rot)}</div>
      <ul class="itens-anciao">${e.itens.map((i) => `<li><span class="ok">✓</span><span>${esc(i.enunciado)}<br><small class="dica">${esc(i.disciplina)}</small></span></li>`).join('')}</ul>
      <div class="acao"></div></div>`);
    const acao = $('.acao', caixa);
    if (e.status === 'enviado' && !e.vencido) {
      acao.innerHTML = `<p class="dica"><b>Prazo para responder:</b> até ${dataHoraBR(e.prazo)}</p>
        <label class="campo"><span>Observações para o teologando</span><textarea maxlength="1000" placeholder="Obrigatório para pedir correção."></textarea></label>
        <div class="botoes-anciao"><button class="btn btn-confirmar b-ap">✓ Aprovar tudo</button><button class="btn btn-sec b-cor">↺ Pedir correção</button></div>`;
      $('.b-ap', acao).onclick = () => responder(e, true, $('textarea', acao).value, acao);
      $('.b-cor', acao).onclick = () => responder(e, false, $('textarea', acao).value, acao);
    } else if (e.status === 'enviado' && e.vencido) {
      const jaPediu = (g.pedidos_pendentes || []).includes(e.pratica_id);
      acao.innerHTML = `<div class="aviso aviso-erro">O prazo para responder terminou em ${dataHoraBR(e.prazo)}.</div>
        ${jaPediu ? '<div class="aviso aviso-info">Pedido de prorrogação enviado. Aguarde a resposta do professor.</div>'
          : '<button class="btn btn-sec btn-bloco b-pror">Pedir prorrogação ao professor</button>'}`;
      const bp = $('.b-pror', acao); if (bp) bp.onclick = () => pedirProrrogacao(g, e);
    } else if (e.status === 'revisar') {
      acao.innerHTML = `<p class="dica">Você pediu correção em ${dataHoraBR(e.respondido_em)}${e.observacao ? `: <i>${esc(e.observacao)}</i>` : ''}. Aguardando o teologando reenviar.</p>`;
    } else if (e.status === 'confirmado') {
      acao.innerHTML = `<p class="dica">Aprovado por você em ${dataHoraBR(e.respondido_em)}.</p>`;
    }
    det.append(caixa);
  }
}

async function responder(e, aprovar, obs, acao) {
  obs = obs.trim();
  if (!aprovar && !obs) return toast('Escreva a observação para o teologando antes de pedir correção.', 'erro');
  if (aprovar && !(await modal({ titulo: 'Aprovar requisitos', corpo: `<p>Confirmar que o teologando cumpriu <b>todos</b> os ${e.itens.length} requisito(s) de <b>${esc(e.pratica)}</b>?</p>`, acoes: [{ rotulo: 'Cancelar', classe: 'btn-sec', valor: false }, { rotulo: 'Aprovar tudo' }] }))) return;
  $$('button', acao).forEach((b) => (b.disabled = true));
  try {
    await rpc('anciao_responder', { p_envio: e.id, p_aprovar: aprovar, p_observacao: obs || null });
    toast(aprovar ? 'Aprovado. Obrigado!' : 'Pedido de correção enviado ao teologando.');
    await painel();
  } catch (err) { toast(err.message, 'erro'); $$('button', acao).forEach((b) => (b.disabled = false)); }
}

async function pedirProrrogacao(g, e) {
  const corpo = html(`<div><p>Pedir ao professor mais prazo para responder os pedidos de <b>${esc(e.pratica)}</b> na ${esc(g.nome)}.</p>
    <label class="campo"><span>Mensagem para o professor (opcional)</span><textarea maxlength="1000" placeholder="Ex.: estive viajando e só vi agora."></textarea></label></div>`);
  const ok = await modal({ titulo: 'Pedir prorrogação', corpo, acoes: [{ rotulo: 'Cancelar', classe: 'btn-sec', valor: false }, { rotulo: 'Enviar pedido' }] });
  if (!ok) return;
  try {
    await rpc('anciao_pedir_prorrogacao', { p_igreja: g.id, p_pratica: e.pratica_id, p_mensagem: $('textarea', corpo).value });
    toast('Pedido enviado. Você será avisado aqui quando o professor responder.');
    await painel();
  } catch (err) { toast(err.message, 'erro'); }
}

// ------------------------------------------------------------ notificações

async function atualizarSino() {
  const { count } = await sb.from('notificacoes').select('id', { count: 'exact', head: true }).eq('lida', false);
  const b = $('#n-sino');
  b.textContent = count > 99 ? '99+' : String(count || 0);
  b.classList.toggle('oculto', !count);
}

async function abrirNotificacoes() {
  const aberto = $('.painel-flutuante');
  if (aberto) { aberto.remove(); return; }
  const p = html('<div class="painel-flutuante"><div class="notif-topo"><b>Notificações</b><button class="link-btn b-lidas">Marcar como lidas</button></div><div class="notif-lista"><div class="carregando">Carregando…</div></div></div>');
  document.body.append(p);
  const { data } = await sb.from('notificacoes').select('*').order('criado_em', { ascending: false }).limit(50);
  $('.notif-lista', p).innerHTML = (data || []).length
    ? data.map((n) => `<div class="notif ${n.lida ? '' : 'nova'}"><b>${esc(n.titulo)}</b>${n.texto ? `<p>${esc(n.texto)}</p>` : ''}<small>${dataHoraBR(n.criado_em)}</small></div>`).join('')
    : '<div class="vazio">Nenhuma notificação.</div>';
  $('.b-lidas', p).onclick = async () => { await sb.rpc('marcar_lidas'); $$('.notif.nova', p).forEach((n) => n.classList.remove('nova')); atualizarSino(); };
}
document.addEventListener('click', (e) => { const p = $('.painel-flutuante'); if (p && !p.contains(e.target) && e.target.id !== 'b-sino') p.remove(); });

// ------------------------------------------------------------ instalar

let promptInstalar = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptInstalar = e; $('#b-instalar').classList.remove('oculto'); });
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
if (ios && !navigator.standalone) $('#b-instalar').classList.remove('oculto');
$('#b-instalar').onclick = async () => {
  if (promptInstalar) { promptInstalar.prompt(); await promptInstalar.userChoice; promptInstalar = null; $('#b-instalar').classList.add('oculto'); return; }
  modal({ titulo: 'Instalar no celular', corpo: ios ? '<p>No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</p>' : '<p>No menu do navegador (⋮), escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p>', acoes: [{ rotulo: 'Entendi' }] });
};
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// ------------------------------------------------------------ início

if (new URLSearchParams(location.search).has('t')) {
  raiz.innerHTML = '<div class="cartao"><div class="aviso aviso-info">Este link não é mais usado. Os pedidos dos teologandos agora aparecem aqui, no app do ancião. Entre com o seu telefone.</div></div>';
  setTimeout(() => painel(), 2500);
} else {
  painel();
}
setInterval(() => { if ($('#b-sino:not(.oculto)')) atualizarSino(); }, 60_000);
