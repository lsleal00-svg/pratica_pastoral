// Envio para comprovação do ancião (com fila quando não há internet)
import { sb, ok } from './supa.js';
import { esc, html, modal, toast, linkWhats, dataHoraBR } from './ui.js';
import { filaAdicionar, filaListar, filaRemover } from './cache.js';
import { estado } from './dados.js';

export function linkAnciao(token) {
  return `${location.origin}${location.pathname.replace(/[^/]*$/, '')}anciao.html?t=${token}`;
}

export function mensagemAnciao({ anciao, igreja, pratica, itens, token }) {
  const nome = estado.perfil?.nome || '';
  return `Olá, ${anciao}! Aqui é ${nome}, estudante de Teologia da FAAMA em prática pastoral na ${igreja}.\n\n`
    + `Peço, por gentileza, que confirme os requisitos que cumpri em ${pratica.nome}:\n`
    + itens.map((i) => `• ${i}`).join('\n')
    + `\n\nPara confirmar ou pedir revisão, toque no link:\n${linkAnciao(token)}\n\nPrazo: até ${dataHoraBR(pratica.fim)}. Obrigado!`;
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

// Janela com o botão do WhatsApp (precisa de um toque da pessoa para abrir)
export async function oferecerWhatsApp(resposta, pratica, enunciados) {
  const texto = mensagemAnciao({ anciao: resposta.anciao_nome, igreja: resposta.igreja, pratica, itens: enunciados, token: resposta.token });
  const corpo = html(`<div>
    <div class="aviso aviso-ok">Requisitos registrados. Agora envie o pedido de comprovação para <b>${esc(resposta.anciao_nome)}</b>.</div>
    <p class="dica">O WhatsApp vai abrir com a mensagem pronta e o link. É só tocar em enviar.</p>
    <div class="linha-botoes">
      <a class="btn btn-whats" target="_blank" rel="noopener" href="${esc(linkWhats(resposta.anciao_tel, texto))}">Abrir WhatsApp do ancião</a>
      <button class="btn btn-sec b-copiar">Copiar mensagem</button>
    </div></div>`);
  corpo.querySelector('.b-copiar').onclick = async () => {
    try { await navigator.clipboard.writeText(texto); toast('Mensagem copiada.'); } catch { toast('Não foi possível copiar.', 'erro'); }
  };
  await modal({ titulo: 'Enviar ao ancião', corpo, acoes: [{ rotulo: 'Fechar' }] });
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
