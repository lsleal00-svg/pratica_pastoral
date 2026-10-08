// Componente de calendário mensal com os destaques do app:
// sublinhado verde = dias do semestre; círculo amarelo = dia de prática; ponto azul = evento
import { esc, html, diaLocal } from './ui.js';
import { estado } from './dados.js';

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function addDia(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Dias (AAAA-MM-DD) cobertos por um bloco de prática
export function diasDaPratica(p) {
  const a = diaLocal(p.inicio), b = diaLocal(p.fim);
  const dias = [];
  for (let d = a; d <= b && dias.length < 62; d = addDia(d, 1)) dias.push(d);
  return dias;
}

export function eventoVisivel(ev, perfil) {
  if (!ev.turmas || !ev.turmas.length) return true;
  if (!perfil || ['monitor', 'professor', 'admin'].includes(perfil.tipo)) return true;
  return ev.turmas.includes(perfil.turma_id);
}

export function criarCalendario({ aoClicarDia, inicial } = {}) {
  const hoje = diaLocal(new Date());
  let ano, mes;
  const base = inicial || hoje;
  ano = +base.slice(0, 4); mes = +base.slice(5, 7) - 1;

  const raiz = html(`<div class="cal">
    <div class="cal-topo">
      <button class="btn-icone" data-m="-1" aria-label="Mês anterior">‹</button>
      <h4></h4>
      <button class="btn-icone" data-m="1" aria-label="Próximo mês">›</button>
    </div>
    <div class="cal-grade"></div>
    <div class="legenda">
      <span><i class="lg-verde"></i> Dias do semestre</span>
      <span><i class="lg-amarelo"></i> Prática pastoral</span>
      <span><i class="lg-azul"></i> Evento</span>
    </div></div>`);

  raiz.querySelectorAll('[data-m]').forEach((b) => {
    b.onclick = () => {
      mes += +b.dataset.m;
      if (mes < 0) { mes = 11; ano--; }
      if (mes > 11) { mes = 0; ano++; }
      desenhar();
    };
  });

  function desenhar() {
    const titulo = new Date(Date.UTC(ano, mes, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    raiz.querySelector('h4').textContent = titulo.charAt(0).toUpperCase() + titulo.slice(1);

    const diasPratica = new Map();
    for (const p of estado.praticas) for (const d of diasDaPratica(p)) {
      if (!diasPratica.has(d)) diasPratica.set(d, []);
      diasPratica.get(d).push(p);
    }
    const eventos = new Map();
    for (const e of estado.eventos) {
      if (!eventoVisivel(e, estado.perfil)) continue;
      if (!eventos.has(e.data)) eventos.set(e.data, []);
      eventos.get(e.data).push(e);
    }
    const letivo = (d) => estado.semestres.some((s) => d >= s.inicio && d <= s.fim);

    const primeiro = new Date(Date.UTC(ano, mes, 1));
    const inicioGrade = addDia(primeiro.toISOString().slice(0, 10), -primeiro.getUTCDay());
    let h = SEMANA.map((s) => `<div class="cal-sem">${s}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const d = addDia(inicioGrade, i);
      const m = +d.slice(5, 7) - 1;
      if (i >= 35 && m !== mes) break;
      const cls = ['cal-dia'];
      if (m !== mes) cls.push('fora');
      if (d === hoje) cls.push('hoje');
      const pr = diasPratica.get(d);
      if (pr) cls.push('pratica'); else if (letivo(d)) cls.push('letivo');
      const ev = eventos.get(d);
      if ((pr || ev) && aoClicarDia) cls.push('clicavel');
      const dicas = [...(pr || []).map((p) => p.nome), ...(ev || []).map((e) => e.titulo)].join(' · ');
      h += `<div class="${cls.join(' ')}" data-dia="${d}" title="${esc(dicas)}">
        <span class="num">${+d.slice(8)}</span>
        ${ev ? `<span class="pontos">${ev.slice(0, 3).map(() => '<i class="ponto"></i>').join('')}</span>` : ''}
      </div>`;
    }
    const g = raiz.querySelector('.cal-grade');
    g.innerHTML = h;
    if (aoClicarDia) g.querySelectorAll('.clicavel').forEach((c) => {
      c.onclick = () => aoClicarDia(c.dataset.dia, diasPratica.get(c.dataset.dia) || [], eventos.get(c.dataset.dia) || []);
    });
  }

  desenhar();
  return { raiz, desenhar, irPara: (iso) => { ano = +iso.slice(0, 4); mes = +iso.slice(5, 7) - 1; desenhar(); } };
}
