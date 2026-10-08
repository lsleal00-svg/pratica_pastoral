import { sb, ok, enviarFoto } from './supa.js';
import { $, $$, esc, html, avatar, TIPOS, dataBR, cpfBR, telBR, dataHoraBR, comprimirImagem, toast, erro, modal } from './ui.js';
import { estado, carregarPerfil, carregarBase, turmaNome } from './dados.js';

// Abas por perfil (a primeira é a tela inicial)
const ABAS = {
  aluno:     [['igreja', 'Igreja'], ['calendario', 'Calendário'], ['graficos', 'Gráficos']],
  monitor:   [['igreja', 'Minha igreja'], ['calendario', 'Calendário'], ['igrejas', 'Igrejas'], ['disciplinas', 'Disciplinas e requisitos'], ['graficos', 'Gráficos']],
  professor: [['graficos', 'Gráficos'], ['acompanhamento', 'Acompanhamento'], ['calendario', 'Calendário'], ['igrejas', 'Igrejas'], ['disciplinas', 'Disciplinas e requisitos'], ['painel', 'Painel do administrador']],
  admin:     [['graficos', 'Gráficos'], ['acompanhamento', 'Acompanhamento'], ['calendario', 'Calendário'], ['igrejas', 'Igrejas'], ['disciplinas', 'Disciplinas e requisitos'], ['painel', 'Painel do administrador']],
};

const VIEWS = {
  igreja: () => import('./views/igreja.js'),
  calendario: () => import('./views/calendario.js'),
  igrejas: () => import('./views/igrejas.js'),
  disciplinas: () => import('./views/disciplinas.js'),
  painel: () => import('./views/painel.js'),
  graficos: () => import('./views/graficos.js'),
  acompanhamento: () => import('./views/acompanhamento.js'),
};

let abaAtual = null;

async function iniciar() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return location.replace('index.html');
  let p;
  try { p = await carregarPerfil(); } catch (e) { erro(e); }
  if (!p || !p.ativo) {
    await sb.auth.signOut();
    return location.replace('index.html');
  }
  try { if (['aluno', 'monitor'].includes(p.tipo)) localStorage.setItem('pp_aparelho_aluno', '1'); } catch {}
  try { await carregarBase(); } catch (e) { erro(e); }
  montarTopo();
  montarAbas();
  window.addEventListener('hashchange', abrirDoHash);
  abrirDoHash();
  atualizarSino();
  setInterval(atualizarSino, 60_000);
  // internet voltou: registra o que ficou guardado e redesenha a tela da igreja
  window.addEventListener('online', async () => {
    const { sincronizarFila } = await import('./comprovacao.js');
    const n = await sincronizarFila();
    if (n) { toast(`${n} envio(s) guardado(s) foram registrados. Mande o link ao ancião.`); if (abaAtual === 'igreja') abrir('igreja'); }
  });
}

function montarAbas() {
  const lista = ABAS[estado.perfil.tipo] || ABAS.aluno;
  $('#abas').innerHTML = lista.map(([id, nome]) => `<button class="aba" data-aba="${id}">${esc(nome)}</button>`).join('');
  $$('#abas .aba').forEach((b) => (b.onclick = () => { location.hash = b.dataset.aba; }));
}

function abrirDoHash() {
  const lista = ABAS[estado.perfil.tipo] || ABAS.aluno;
  const pedida = location.hash.replace('#', '').split('/')[0];
  const aba = lista.some(([id]) => id === pedida) ? pedida : lista[0][0];
  abrir(aba);
}

export async function abrir(aba) {
  abaAtual = aba;
  $$('#abas .aba').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === aba));
  const nome = (ABAS[estado.perfil.tipo] || []).find(([id]) => id === aba)?.[1] || '';
  $('#sub-titulo').textContent = nome;
  const raiz = $('#conteudo');
  raiz.innerHTML = '<div class="carregando">Carregando…</div>';
  try {
    const mod = await VIEWS[aba]();
    if (abaAtual !== aba) return;
    raiz.innerHTML = '';
    await mod.default(raiz);
  } catch (e) {
    console.error(e);
    raiz.innerHTML = `<div class="cartao"><div class="aviso aviso-erro">Não foi possível abrir esta tela: ${esc(e.message)}</div></div>`;
  }
}

// ------------------------------------------------------------ topo

function montarTopo() {
  $('#b-conta').innerHTML = avatar(estado.perfil, 38);
  $('#b-conta').onclick = (e) => { e.stopPropagation(); alternarPainel('ficha', montarFicha); };
  $('#b-sino').onclick = (e) => { e.stopPropagation(); alternarPainel('notif', montarNotificacoes); };
  document.addEventListener('click', (e) => {
    const p = $('.painel-flutuante');
    if (p && !p.contains(e.target)) p.remove();
  });
  configurarInstalacao();
  const faixa = () => $('#faixa-offline').classList.toggle('oculto', navigator.onLine);
  window.addEventListener('online', faixa);
  window.addEventListener('offline', faixa);
  faixa();
}

function alternarPainel(tipo, montar) {
  const aberto = $('.painel-flutuante');
  if (aberto) { const era = aberto.dataset.tipo; aberto.remove(); if (era === tipo) return; }
  const p = html(`<div class="painel-flutuante" data-tipo="${tipo}"></div>`);
  document.body.append(p);
  montar(p);
}

function montarFicha(p) {
  const u = estado.perfil;
  const linha = (rot, val) => (val ? `<div><small>${rot}</small><div>${esc(val)}</div></div>` : '');
  p.innerHTML = `
    <div class="ficha-topo">
      <label class="foto-troca" title="Trocar foto">${avatar(u, 64)}<span class="cam">📷</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" class="oculto"></label>
      <div><b>${esc(u.nome)}</b><span class="etiqueta">${esc(TIPOS[u.tipo])}</span>
        <div style="font-size:13px;opacity:.85">${esc(turmaNome(u.turma_id))}</div></div>
    </div>
    <div class="ficha-linha">${linha('E-mail', u.email)}</div>
    <div class="ficha-linha duas">${linha('Nascimento', dataBR(u.nascimento))}${linha('RA', u.ra)}</div>
    <div class="ficha-linha duas">${linha('CPF', u.cpf ? cpfBR(u.cpf) : '')}${linha('WhatsApp', telBR(u.telefone))}</div>
    <div class="ficha-linha disc-linha"><small>Disciplina de prática</small><div>…</div></div>
    <button class="ficha-sair">↪ Sair</button>`;
  // Disciplina vem da turma no semestre atual
  import('./dados.js').then(async ({ disciplinasDaTurma }) => {
    try {
      const ds = await disciplinasDaTurma(u.turma_id, estado.semestreAtualId);
      $('.disc-linha div', p).textContent = ds.map((d) => d.disciplina.nome).join(', ') || 'Nenhuma neste semestre';
    } catch { $('.disc-linha div', p).textContent = '—'; }
  });
  $('input[type=file]', p).onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const blob = await comprimirImagem(f, 400);
      const url = await enviarFoto(`perfis/${u.id}`, blob);
      ok(await sb.rpc('definir_minha_foto', { p_url: url }));
      u.foto_url = url;
      $('#b-conta').innerHTML = avatar(u, 38);
      $('.foto-troca', p).firstElementChild.outerHTML = avatar(u, 64);
      toast('Foto atualizada.');
    } catch (err) { erro(err); }
  };
  $('.ficha-sair', p).onclick = async () => {
    const { limparTudo } = await import('./cache.js');
    await limparTudo();
    await sb.auth.signOut();
    location.replace('index.html');
  };
}

async function montarNotificacoes(p) {
  p.innerHTML = '<div class="notif-topo"><b>Notificações</b><button class="link-btn b-lidas">Marcar todas como lidas</button></div><div class="notif-lista"><div class="carregando">Carregando…</div></div>';
  try {
    const lista = ok(await sb.from('notificacoes').select('*').order('criado_em', { ascending: false }).limit(50)) || [];
    $('.notif-lista', p).innerHTML = lista.length
      ? lista.map((n) => `<div class="notif ${n.lida ? '' : 'nova'}" ${n.link ? `data-link="${esc(n.link)}" style="cursor:pointer"` : ''}><b>${esc(n.titulo)}</b>${n.texto ? `<p>${esc(n.texto)}</p>` : ''}<small>${dataHoraBR(n.criado_em)}${n.link ? ' · toque para abrir' : ''}</small></div>`).join('')
      : '<div class="vazio">Nenhuma notificação.</div>';
  } catch (e) { $('.notif-lista', p).innerHTML = `<div class="vazio">${esc(e.message)}</div>`; }
  $$('.notif[data-link]', p).forEach((n) => (n.onclick = () => {
    p.remove();
    const alvo = n.dataset.link.replace(/^#/, '');
    if (location.hash.replace(/^#/, '') === alvo) abrir(alvo.split('/')[0]); else location.hash = alvo;
  }));
  $('.b-lidas', p).onclick = async () => {
    try { ok(await sb.rpc('marcar_lidas')); $$('.notif.nova', p).forEach((n) => n.classList.remove('nova')); atualizarSino(); } catch (e) { erro(e); }
  };
}

export async function atualizarSino() {
  try {
    const { count } = await sb.from('notificacoes').select('id', { count: 'exact', head: true }).eq('lida', false);
    const b = $('#n-sino');
    b.textContent = count > 99 ? '99+' : String(count || 0);
    b.classList.toggle('oculto', !count);
  } catch { /* offline */ }
}

// ------------------------------------------------------------ instalar (PWA)

function configurarInstalacao() {
  const botao = $('#b-instalar');
  const instalado = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (instalado) return;
  let prompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); prompt = e; botao.classList.remove('oculto'); });
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios) botao.classList.remove('oculto');
  botao.onclick = async () => {
    if (prompt) { prompt.prompt(); await prompt.userChoice; prompt = null; botao.classList.add('oculto'); return; }
    modal({
      titulo: 'Instalar no celular',
      corpo: ios
        ? '<p>No Safari, toque em <b>Compartilhar</b> (o quadrado com a seta) e depois em <b>Adicionar à Tela de Início</b>.</p>'
        : '<p>No menu do navegador (⋮), escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p>',
      acoes: [{ rotulo: 'Entendi' }],
    });
  };
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

iniciar();
