import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// "Manter-me conectado": com a marca, a sessão fica no localStorage (sobrevive
// a fechar o navegador); sem ela, no sessionStorage (some ao fechar a aba).
const MARCA = 'pp_manter';
function area() {
  try { return localStorage.getItem(MARCA) === '1' ? localStorage : sessionStorage; }
  catch { return sessionStorage; }
}
const armazenamento = {
  getItem: (k) => { try { return area().getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { area().setItem(k, v); } catch { /* sem armazenamento */ } },
  removeItem: (k) => {
    try { localStorage.removeItem(k); } catch {}
    try { sessionStorage.removeItem(k); } catch {}
  },
};

export function definirManter(manter) {
  try { manter ? localStorage.setItem(MARCA, '1') : localStorage.removeItem(MARCA); } catch {}
}

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: armazenamento, persistSession: true, autoRefreshToken: true, storageKey: 'pp_sessao' },
});

// Chama a Edge Function "api"
export async function api(acao, dados = {}) {
  const { data: s } = await sb.auth.getSession();
  const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY };
  headers.Authorization = 'Bearer ' + (s?.session?.access_token || SUPABASE_ANON_KEY);
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/api`, {
      method: 'POST', headers, body: JSON.stringify({ acao, dados }),
    });
  } catch {
    if (!navigator.onLine) throw new Error('Sem internet. Verifique sua conexão.');
    throw new Error('Não foi possível falar com a função do servidor (api). Confira se a Edge Function "api" foi publicada com esse nome e com "Verify JWT" desligado.');
  }
  let corpo = {};
  try { corpo = await r.json(); } catch {}
  if (!r.ok || corpo.erro) throw new Error(corpo.erro || `Erro ${r.status} no servidor.`);
  return corpo;
}

// Lança erro legível a partir de uma resposta do Supabase
export function ok({ data, error, count }) {
  if (error) {
    const m = error.message || '';
    if (m.includes('HISTORICO')) throw new Error(m.replace(/^.*HISTORICO:\s*/, ''));
    if (m.includes('duplicate key')) throw new Error('Já existe um registro com esses dados.');
    if (m.includes('row-level security')) throw new Error('Você não tem permissão para esta ação.');
    if (m.includes('Failed to fetch')) throw new Error('Sem conexão com o servidor.');
    throw new Error(m || 'Erro ao falar com o banco de dados.');
  }
  return count !== undefined && count !== null && data === null ? count : data;
}

// Envia uma imagem já comprimida para o bucket "fotos" e devolve a URL pública
export async function enviarFoto(pasta, blob) {
  const nome = `${pasta}/${crypto.randomUUID()}.jpg`;
  const { error } = await sb.storage.from('fotos').upload(nome, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error('Não foi possível enviar a foto: ' + error.message);
  return sb.storage.from('fotos').getPublicUrl(nome).data.publicUrl;
}
