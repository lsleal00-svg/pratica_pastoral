import { sb, api, definirManter } from './supa.js';
import { $, $$, esc, lerForm, ocupado } from './ui.js';

const telas = ['f-entrar', 'f-esqueci', 'f-nova', 'f-primeiro'];
let pendente = null; // { email, codigo } enquanto cria a nova senha

function ir(id) {
  telas.forEach((t) => $('#' + t).classList.toggle('oculto', t !== id));
  $$('[id^="msg-"]').forEach((m) => (m.innerHTML = ''));
  const f = $('#' + id).querySelector('input');
  if (f) f.focus();
}
function aviso(onde, texto, tipo = 'erro') {
  $('#msg-' + onde).innerHTML = `<div class="aviso aviso-${tipo}">${esc(texto)}</div>`;
}

// Marca o aparelho em que um estudante entrou: a página do ancião se recusa a confirmar nele
function marcarAparelho(tipo) {
  try { if (tipo === 'aluno' || tipo === 'monitor') localStorage.setItem('pp_aparelho_aluno', '1'); } catch {}
}

$$('[data-ir]').forEach((b) => (b.onclick = () => ir(b.dataset.ir)));

// Já está logado? vai direto para o app
sb.auth.getSession().then(({ data }) => { if (data.session) location.replace('app.html'); });

// Turmas para o primeiro acesso
async function carregarTurmas() {
  const sel = $('#f-primeiro [name=turma_id]');
  const { data, error } = await sb.from('turmas').select('id, nome').order('nome');
  if (error) { sel.innerHTML = '<option value="">Não foi possível carregar</option>'; return; }
  sel.innerHTML = '<option value="">Selecione…</option>' + data.map((t) => `<option value="${t.id}">${esc(t.nome)}</option>`).join('');
}
carregarTurmas();

async function entrarComSenha(email, senha) {
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) {
    const m = error.message || '';
    if (/banned/i.test(m)) throw new Error('Seu acesso está inativo. Procure o administrador.');
    if (/invalid login/i.test(m)) throw new Error('E-mail ou senha incorretos.');
    if (/fetch|network/i.test(m)) throw new Error('Não foi possível falar com o Supabase (login). Detalhe: ' + m);
    throw new Error(m);
  }
  const { data: u } = await sb.auth.getUser();
  const { data: p } = await sb.from('perfis').select('ativo, tipo').eq('id', u.user.id).maybeSingle();
  marcarAparelho(p?.tipo);
  if (!p || !p.ativo) {
    await sb.auth.signOut();
    throw new Error('Seu cadastro não está ativo. Procure o administrador.');
  }
  location.replace('app.html');
}

$('#f-entrar').onsubmit = (e) => {
  e.preventDefault();
  const d = lerForm(e.target);
  definirManter(d.manter);
  ocupado(e.submitter, async () => {
    try {
      // Tenta primeiro como senha; se não servir e tiver 6 números, tenta como código
      try {
        await entrarComSenha(d.email, d.senha);
        return;
      } catch (errSenha) {
        if (!/^\d{6}$/.test(d.senha) || !/incorretos/.test(errSenha.message)) throw errSenha;
      }
      await api('validar_codigo', { email: d.email, codigo: d.senha });
      pendente = { email: d.email, codigo: d.senha };
      ir('f-nova');
    } catch (err) { aviso('entrar', err.message); }
  });
};

$('#f-nova').onsubmit = (e) => {
  e.preventDefault();
  const d = lerForm(e.target);
  if (d.senha !== d.senha2) return aviso('nova', 'As duas senhas não são iguais.');
  if (d.senha.length < 8) return aviso('nova', 'A senha deve ter pelo menos 8 caracteres.');
  if (/^\d{6}$/.test(d.senha)) return aviso('nova', 'A senha não pode ter só 6 números.');
  if (!pendente) return ir('f-entrar');
  ocupado(e.submitter, async () => {
    try {
      await api('definir_senha', { ...pendente, senha: d.senha });
      await entrarComSenha(pendente.email, d.senha);
    } catch (err) { aviso('nova', err.message); }
  });
};

$('#f-esqueci').onsubmit = (e) => {
  e.preventDefault();
  const d = lerForm(e.target);
  ocupado(e.submitter, async () => {
    try {
      await api('esqueci_senha', { email: d.email });
      ir('f-entrar');
      $('#f-entrar [name=email]').value = d.email;
      aviso('entrar', 'Se o e-mail estiver cadastrado, um código foi enviado. Digite-o no lugar da senha (vale 15 minutos).', 'ok');
      $('#f-entrar [name=senha]').focus();
    } catch (err) { aviso('esqueci', err.message); }
  });
};

$('#f-primeiro').onsubmit = (e) => {
  e.preventDefault();
  const d = lerForm(e.target);
  ocupado(e.submitter, async () => {
    try {
      await api('solicitar_acesso', d);
      e.target.reset();
      ir('f-entrar');
      aviso('entrar', 'Pedido enviado! Ele será analisado por um administrador e o código de acesso será enviado por e-mail ou WhatsApp.', 'ok');
    } catch (err) { aviso('primeiro', err.message); }
  });
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
