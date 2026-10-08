// Painel do administrador (professor e administrador)
import { sb } from '../supa.js';
import { $, $$, esc, html } from '../ui.js';

const SUB = [
  ['usuarios', 'Cadastro e usuários', () => import('./painel-usuarios.js')],
  ['pedidos', 'Pedidos de acesso', () => import('./painel-pedidos.js')],
  ['turmas', 'Turmas', () => import('./painel-turmas.js')],
  ['semestres', 'Semestres e práticas', () => import('./painel-semestres.js')],
];

export default async function (raiz) {
  const pedida = location.hash.split('/')[1];
  const atual = SUB.find(([id]) => id === pedida) ? pedida : 'usuarios';
  const barra = html(`<div class="subabas">${SUB.map(([id, nome]) => `<button class="subaba ${id === atual ? 'ativa' : ''}" data-s="${id}">${esc(nome)}${id === 'pedidos' ? '<span class="bolha oculto"></span>' : ''}</button>`).join('')}</div>`);
  raiz.append(barra);
  $$('.subaba', barra).forEach((b) => (b.onclick = () => { location.hash = 'painel/' + b.dataset.s; }));

  // contador de pedidos pendentes
  sb.from('pedidos_acesso').select('id', { count: 'exact', head: true }).eq('status', 'pendente').then(({ count }) => {
    const bol = $('[data-s=pedidos] .bolha', barra);
    if (count) { bol.textContent = count; bol.classList.remove('oculto'); }
  });

  const area = html('<div></div>');
  raiz.append(area);
  const mod = await SUB.find(([id]) => id === atual)[2]();
  await mod.default(area);
}
