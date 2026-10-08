// Armazenamento no aparelho (IndexedDB): cópia dos dados para abrir sem internet
// e fila de envios feitos offline.
const BANCO = 'pratica-pastoral';
let conexao = null;

function abrir() {
  if (conexao) return conexao;
  conexao = new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('copias')) db.createObjectStore('copias');
      if (!db.objectStoreNames.contains('fila')) db.createObjectStore('fila', { keyPath: 'chave' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return conexao;
}

async function operar(loja, modo, fn) {
  try {
    const db = await abrir();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(loja, modo);
      const r = fn(tx.objectStore(loja));
      tx.oncomplete = () => resolve(r?.result);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('IndexedDB indisponível', e);
    return undefined;
  }
}

// cópias (chave → valor), separadas por usuário
export const guardar = (chave, valor) => operar('copias', 'readwrite', (s) => s.put({ valor, em: Date.now() }, chave));
export async function ler(chave) {
  const r = await operar('copias', 'readonly', (s) => s.get(chave));
  return r?.valor;
}

// Busca na rede; se falhar, usa a última cópia guardada
export async function comCopia(chave, buscar) {
  try {
    const v = await buscar();
    guardar(chave, v);
    return v;
  } catch (e) {
    const c = await ler(chave);
    if (c !== undefined) return c;
    throw e;
  }
}

// fila de envios offline
export const filaAdicionar = (item) => operar('fila', 'readwrite', (s) => s.put(item));
export const filaRemover = (chave) => operar('fila', 'readwrite', (s) => s.delete(chave));
export async function filaListar(usuarioId) {
  const todos = (await operar('fila', 'readonly', (s) => s.getAll())) || [];
  return todos.filter((i) => i.aluno_id === usuarioId);
}

export async function limparTudo() {
  await operar('copias', 'readwrite', (s) => s.clear());
}
