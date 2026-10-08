// Tela inicial do aluno: a igreja onde pratica, a disciplina e os requisitos
import { sb, ok } from '../supa.js';
import { esc, html, telBR, linkWhats, dataHoraBR, modal, vazio } from '../ui.js';
import { estado, semestreAtual, disciplinasDaTurma, situacaoPratica } from '../dados.js';

export default async function (raiz) {
  const eu = estado.perfil;
  const sem = semestreAtual();
  if (!sem) {
    raiz.innerHTML = `<div class="cartao">${vazio('Nenhum semestre cadastrado ainda.')}</div>`;
    return;
  }
  const [vinc, discs] = await Promise.all([
    sb.from('aluno_igreja').select('igrejas(*)').eq('aluno_id', eu.id).eq('semestre_id', sem.id).maybeSingle(),
    disciplinasDaTurma(eu.turma_id, sem.id),
  ]);
  const igreja = ok(vinc)?.igrejas;

  // Bloco de prática aberto agora, ou o próximo
  const praticasSem = estado.praticas.filter((p) => p.semestre_id === sem.id);
  const aberta = praticasSem.find((p) => situacaoPratica(p) === 'aberta');
  const proxima = praticasSem.filter((p) => situacaoPratica(p) === 'futura').sort((a, b) => (a.inicio > b.inicio ? 1 : -1))[0];

  if (!igreja) {
    raiz.innerHTML = `<div class="cartao"><div class="aviso aviso-amarelo">Você ainda não está vinculado a uma igreja no semestre <b>${esc(sem.nome)}</b>. Procure o monitor ou o professor da disciplina.</div></div>`;
  } else {
    const contato = (rot, nome, tel) => nome ? `<div class="contato"><small>${rot}</small><div>${esc(nome)}</div>${tel ? `<a href="${esc(linkWhats(tel, ''))}" target="_blank" rel="noopener">${esc(telBR(tel))}</a>` : ''}</div>` : '';
    raiz.append(html(`<div class="card-igreja">
      <div class="foto" style="${igreja.foto_url ? `background-image:url('${esc(igreja.foto_url)}')` : ''}">${igreja.foto_url ? '' : '⛪'}</div>
      <div class="corpo">
        <h2>${esc(igreja.nome)}</h2>
        <div class="dica">${esc(igreja.rua)} · ${esc(igreja.bairro)} · ${esc(igreja.cidade)}</div>
        <div class="contatos">
          ${contato('Pastor', igreja.pastor_nome, igreja.pastor_tel)}
          ${contato('Ancião / anciã', igreja.anciao_nome, igreja.anciao_tel)}
          ${contato('Secretário(a)', igreja.secretario_nome, igreja.secretario_tel)}
        </div>
      </div></div>`));
  }

  // Disciplinas e botão de requisitos
  const c = html('<div class="cartao"><h3>Minha disciplina</h3><div class="lista"></div></div>');
  const lista = c.querySelector('.lista');
  if (!discs.length) {
    lista.innerHTML = vazio('Sua turma ainda não tem disciplina de prática vinculada neste semestre.');
  } else {
    for (const { disciplina, requisitos } of discs) {
      const podeAbrir = !!aberta && !!igreja;
      const motivo = !igreja ? 'Disponível depois do vínculo com uma igreja.'
        : aberta ? `Prática aberta até ${dataHoraBR(aberta.fim)}.`
        : proxima ? `Abre em ${dataHoraBR(proxima.inicio)} (${esc(proxima.nome)}).`
        : 'Nenhum bloco de prática agendado.';
      const item = html(`<div class="req-item" style="align-items:center">
        <div class="req-txt"><b>${esc(disciplina.nome)}</b><small>${requisitos.length} requisito(s) · ${motivo}</small></div>
        <button class="btn" ${podeAbrir ? '' : 'disabled'}>Abrir requisitos</button></div>`);
      item.querySelector('button').onclick = () => abrirRequisitos(disciplina, requisitos, aberta);
      lista.append(item);
    }
  }
  raiz.append(c);
}

function abrirRequisitos(disciplina, requisitos, pratica) {
  const corpo = html(`<div>
    <div class="aviso aviso-info"><b>${esc(pratica.nome)}</b><br>Aberta até ${dataHoraBR(pratica.fim)}.</div>
    ${requisitos.length ? requisitos.map((r, i) => `<div class="req-item"><span class="req-num">${i + 1}</span>
      <div class="req-txt">${esc(r.enunciado)}<small>${r.quantidade ? `Exigido ${r.quantidade} vez(es) no semestre` : 'Exigido em todos os blocos de prática'}</small></div></div>`).join('')
      : vazio('Nenhum requisito cadastrado.')}
    <p class="dica" style="margin-top:12px">A marcação dos requisitos e o envio para comprovação do ancião serão liberados na próxima atualização do app.</p>
  </div>`);
  modal({ titulo: disciplina.nome, corpo, largo: true, acoes: [{ rotulo: 'Fechar' }] });
}
