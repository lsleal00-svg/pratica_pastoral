// Envio para comprovação do ancião (com fila quando não há internet)
import { sb, ok } from './supa.js';
import { esc, html, modal, toast, linkWhats, dataHoraBR } from './ui.js';
import { filaAdicionar, filaListar, filaRemover } from './cache.js';
import { estado } from './dados.js';

// Recado curto (sem link) para avisar o ancião de que há um pedido no app dele
export function mensagemAnciao({ anciao, igreja, pratica, itens }) {
  const nome = estado.perfil?.nome || '';
  return `Olá, ${anciao}! Aqui é ${nome}, estudante de Teologia da FAAMA em prática pastoral na ${igreja}.\n\n`
    + `Enviei pelo app de Prática Pastoral ${itens.length} requisito(s) de ${pratica.nome} para a sua aprovação. `
    + `Quando puder, abra o app do ancião para aprovar ou pedir correção. O prazo é até ${dataHoraBR(pratica.fim)}. Obrigado!`;
}

async function chamarEnvio(item) {
  return ok(await sb.rpc('enviar_comprovacao', {
    p_pratica: item.pratica_id, p_requisitos: item.requisitos, p_marcado_em: item.marcado_em, p_chave: item.chave,
  }));
}

// Envia agora ou guarda na fila. Retorna { enviado, resposta } ou { guardado }
export async function enviar(pratica, requisitos) {
  const item = {
    chave: crypto.randomUUID(), aluno_id: estado.perfil.id, pratica_id: pratica.id,
    requisitos: requisitos.map((r) => r.id), enunciados: requisitos.map((r) => r.enunciado),
    marcado_em: new Date().toISOString(),
  };
  if (navigator.onLine) {
    try {
      const resposta = await chamarEnvio(item);
      return { enviado: true, resposta, item };
    } catch (e) {
      if (!/conex|fetch|network/i.test(e.message)) throw e;
    }
  }
  await filaAdicionar(item);
  return { guardado: true, item };
}

// Confirmação do envio, com um recado opcional ao ancião pelo WhatsApp (sem link)
export async function oferecerWhatsApp(resposta, pratica, enunciados) {
  const texto = mensagemAnciao({ anciao: resposta.anciao_nome, igreja: resposta.igreja, pratica, itens: enunciados });
  const prazo = resposta.prazo || pratica.fim;
  const corpo = html(`<div>
    <div class="aviso aviso-ok"><b>Enviado!</b> O pedido já aparece no app de <b>${esc(resposta.anciao_nome)}</b>, que tem até ${dataHoraBR(prazo)} para aprovar ou pedir correção.</div>
    <p class="dica">Se quiser, avise o ancião por WhatsApp. A mensagem não leva link: ele aprova pelo app dele.</p>
    <div class="linha-botoes">
      <a class="btn btn-whats" target="_blank" rel="noopener" href="${esc(linkWhats(resposta.anciao_tel, texto))}">Avisar o ancião no WhatsApp</a>
    </div></div>`);
  await modal({ titulo: 'Pedido enviado', corpo, acoes: [{ rotulo: 'Fechar' }] });
}

// Tenta mandar o que ficou guardado no aparelho. Devolve quantos foram enviados.
let sincronizando = false;
export async function sincronizarFila(aoEnviar) {
  if (sincronizando || !navigator.onLine || !estado.perfil) return 0;
  sincronizando = true;
  let n = 0;
  try {
    const itens = await filaListar(estado.perfil.id);
    for (const item of itens) {
      try {
        const resposta = await chamarEnvio(item);
        await filaRemover(item.chave);
        n++;
        if (aoEnviar) await aoEnviar(item, resposta);
      } catch (e) {
        if (/conex|fetch|network/i.test(e.message)) break;   // continua sem internet
        await filaRemover(item.chave);                         // recusado pelo servidor: avisa e descarta
        toast(`Um envio guardado no aparelho foi recusado: ${e.message}`, 'erro');
      }
    }
  } finally { sincronizando = false; }
  return n;
}
