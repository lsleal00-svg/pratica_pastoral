// Utilidades de interface compartilhadas

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Cria elemento a partir de HTML
export function html(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}

export const TIPOS = { aluno: 'Aluno', monitor: 'Monitor', professor: 'Professor', admin: 'Administrador' };
export const eGestor = (p) => p && (p.tipo === 'professor' || p.tipo === 'admin');
export const eEquipe = (p) => p && ['monitor', 'professor', 'admin'].includes(p.tipo);

// ------------------------------------------------------------ datas e números

export function dataBR(iso) {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
export function dataHoraBR(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
// Data local (America/Sao_Paulo) no formato AAAA-MM-DD
export function diaLocal(iso) {
  const d = iso instanceof Date ? iso : new Date(iso);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
export function horaLocal(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
}
// Junta data (AAAA-MM-DD) e hora (HH:MM) do horário de Brasília em ISO
export function isoBrasilia(data, hora) {
  return `${data}T${hora || '00:00'}:00-03:00`;
}
export function telBR(t) {
  const d = String(t || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t || '—';
}
export function cpfBR(c) {
  const d = String(c || '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : (c || '—');
}
export function linkWhats(tel, texto) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.length <= 11) d = '55' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}
export function iniciais(nome) {
  const p = String(nome || '?').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
export function avatar(p, tam = 36) {
  if (p?.foto_url) return `<img class="avatar" style="width:${tam}px;height:${tam}px" src="${esc(p.foto_url)}" alt="">`;
  return `<span class="avatar avatar-ini" style="width:${tam}px;height:${tam}px;font-size:${Math.round(tam * 0.38)}px">${esc(iniciais(p?.nome))}</span>`;
}

// ------------------------------------------------------------ avisos

export function toast(msg, tipo = 'ok') {
  let caixa = $('#toasts');
  if (!caixa) { caixa = html('<div id="toasts"></div>'); document.body.append(caixa); }
  const t = html(`<div class="toast toast-${tipo}">${esc(msg)}</div>`);
  caixa.append(t);
  setTimeout(() => t.classList.add('sai'), tipo === 'erro' ? 5500 : 3000);
  setTimeout(() => t.remove(), tipo === 'erro' ? 6000 : 3500);
}
export const erro = (e) => toast(e?.message || String(e), 'erro');

// ------------------------------------------------------------ janelas

export function modal({ titulo, corpo, acoes = [], largo = false }) {
  return new Promise((resolve) => {
    const m = html(`<div class="modal-fundo"><div class="modal ${largo ? 'modal-largo' : ''}" role="dialog" aria-modal="true">
      <div class="modal-topo"><h3>${esc(titulo)}</h3><button class="btn-icone fechar" aria-label="Fechar">✕</button></div>
      <div class="modal-corpo"></div><div class="modal-acoes"></div></div></div>`);
    const c = $('.modal-corpo', m);
    typeof corpo === 'string' ? (c.innerHTML = corpo) : c.append(corpo);
    const fechar = (v) => { m.remove(); document.removeEventListener('keydown', tecla); resolve(v); };
    const tecla = (e) => { if (e.key === 'Escape') fechar(null); };
    document.addEventListener('keydown', tecla);
    $('.fechar', m).onclick = () => fechar(null);
    m.addEventListener('mousedown', (e) => { if (e.target === m) fechar(null); });
    for (const a of acoes) {
      const b = html(`<button class="btn ${a.classe || ''}">${esc(a.rotulo)}</button>`);
      b.onclick = async () => {
        if (a.antes) { const r = await a.antes(m); if (r === false) return; }
        fechar(a.valor ?? true);
      };
      $('.modal-acoes', m).append(b);
    }
    document.body.append(m);
    const foco = $('input,select,textarea', m);
    if (foco) foco.focus();
  });
}

// Confirmação; com exigirTexto, a pessoa precisa digitar o texto indicado
export async function confirmar(msg, { titulo = 'Confirmar', rotulo = 'Confirmar', perigo = false, exigirTexto = null } = {}) {
  const corpo = html(`<div><p>${msg}</p>${exigirTexto ? `<label class="campo"><span>Digite <b>${esc(exigirTexto)}</b> para confirmar</span><input class="conf-txt" autocomplete="off"></label>` : ''}</div>`);
  const r = await modal({
    titulo, corpo,
    acoes: [
      { rotulo: 'Cancelar', classe: 'btn-sec', valor: false },
      {
        rotulo, classe: perigo ? 'btn-perigo' : '', valor: corpo.querySelector('.conf-txt') ? 'TXT' : true,
        antes: () => {
          if (!exigirTexto) return true;
          const v = corpo.querySelector('.conf-txt').value.trim().toLowerCase();
          if (v !== exigirTexto.trim().toLowerCase()) { toast('O texto digitado não confere.', 'erro'); return false; }
          return true;
        },
      },
    ],
  });
  if (!r) return false;
  return exigirTexto ? corpo.querySelector('.conf-txt').value.trim() : true;
}

// Mostra um código de 6 dígitos com copiar / WhatsApp / e-mail
export async function mostrarCodigo({ codigo, nome, telefone, aoEnviarEmail }) {
  const texto = `Olá, ${nome}! Seu código de acesso ao app de Prática Pastoral é: ${codigo}\n\nNa tela de entrada, digite seu e-mail e coloque esse código no lugar da senha. Depois você cria a sua senha. O código vale por 7 dias.\n${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
  const corpo = html(`<div class="codigo-caixa">
    <p>Código gerado para <b>${esc(nome)}</b>:</p>
    <div class="codigo-num">${esc(codigo)}</div>
    <p class="dica">Ele vale por 7 dias e só funciona uma vez. Anote agora: depois de fechar esta janela ele não aparece de novo.</p>
    <div class="linha-botoes">
      <button class="btn btn-sec b-copiar">Copiar mensagem</button>
      ${telefone ? `<a class="btn btn-whats" target="_blank" rel="noopener" href="${esc(linkWhats(telefone, texto))}">Abrir WhatsApp</a>` : ''}
      ${aoEnviarEmail ? '<button class="btn btn-sec b-email">Enviar por e-mail</button>' : ''}
    </div></div>`);
  $('.b-copiar', corpo).onclick = async () => {
    try { await navigator.clipboard.writeText(texto); toast('Mensagem copiada.'); } catch { toast('Não foi possível copiar. Selecione o código e copie.', 'erro'); }
  };
  const be = $('.b-email', corpo);
  if (be) be.onclick = async () => {
    be.disabled = true; be.textContent = 'Enviando…';
    try { await aoEnviarEmail(); toast('E-mail enviado.'); be.textContent = 'E-mail enviado ✓'; }
    catch (e) { erro(e); be.disabled = false; be.textContent = 'Enviar por e-mail'; }
  };
  await modal({ titulo: 'Código de acesso', corpo, acoes: [{ rotulo: 'Fechar' }] });
}

// ------------------------------------------------------------ imagens

// Reduz a imagem no navegador antes de enviar
export function comprimirImagem(arquivo, lado = 600, qualidade = 0.82) {
  return new Promise((resolve, reject) => {
    if (!arquivo?.type?.startsWith('image/')) return reject(new Error('Escolha uma imagem JPEG ou PNG.'));
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível ler a imagem.'))), 'image/jpeg', qualidade);
    };
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = url;
  });
}

// Botão com estado "carregando"
export async function ocupado(botao, fn) {
  const t = botao.textContent;
  botao.disabled = true; botao.textContent = 'Aguarde…';
  try { return await fn(); } finally { botao.disabled = false; botao.textContent = t; }
}

// Lê os campos de um formulário em objeto
export function lerForm(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else o[el.name] = el.value.trim();
  }
  return o;
}
export function preencherForm(form, dados) {
  for (const el of form.elements) {
    if (!el.name || !(el.name in dados)) continue;
    if (el.type === 'checkbox') el.checked = !!dados[el.name];
    else el.value = dados[el.name] ?? '';
  }
}

export function vazio(msg) {
  return `<div class="vazio">${esc(msg)}</div>`;
}
