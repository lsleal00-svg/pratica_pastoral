// Relatórios para imprimir ou salvar em PDF (pela janela de impressão do navegador)
import { esc, toast } from './ui.js';
import { INSTITUICAO, NOME_APP } from './config.js';

export function imprimir(titulo, corpoHtml) {
  const w = window.open('', '_blank');
  if (!w) { toast('Permita janelas pop-up neste site para gerar o relatório.', 'erro'); return; }
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1b2333; margin: 28px; font-size: 12.5px; }
    header { border-bottom: 3px solid #0b2e6b; padding-bottom: 10px; margin-bottom: 16px; }
    header b { color: #0b2e6b; font-size: 17px; }
    header small { display: block; color: #5a6577; }
    h1 { font-size: 16px; margin: 0 0 4px; } h2 { font-size: 14px; color: #0b2e6b; margin: 18px 0 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th, td { border: 1px solid #ccd3df; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #eef1f6; font-size: 11px; text-transform: uppercase; }
    .ok { color: #12663a; font-weight: bold; } .nao { color: #8d2119; font-weight: bold; } .pend { color: #1d4fa8; font-weight: bold; }
    .meta { color: #5a6577; } footer { margin-top: 24px; color: #8b95a6; font-size: 11px; }
    @media print { body { margin: 14mm; } .sem-quebra { break-inside: avoid; } }
  </style></head><body>
  <header><b>${esc(INSTITUICAO)} · ${esc(NOME_APP)}</b><small>Bacharelado em Teologia</small></header>
  ${corpoHtml}
  <footer>Gerado em ${esc(agora)}.</footer>
  <script>window.onload = () => setTimeout(() => window.print(), 300);<\/script></body></html>`);
  w.document.close();
}

// Classe e rótulo para a célula de situação
export function situacaoCelula(status) {
  const m = {
    confirmado: ['ok', 'Confirmado pelo ancião'], aprovado_prof: ['ok', 'Aprovado pelo professor'],
    enviado: ['pend', 'Aguardando o ancião'], revisar: ['nao', 'Revisar'],
    reprovado_prof: ['nao', 'Reprovado pelo professor'],
  }[status] || ['nao', 'Não cumprido'];
  return `<span class="${m[0]}">${m[1]}</span>`;
}
