import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ItemPedidoMontado, PedidoMontado } from '../types'
import { formatarMoeda } from './cotacao'

/** Agrupa itens do pedido por fornecedor. */
function agruparPorFornecedor(itens: ItemPedidoMontado[]): Map<string, { nome: string; itens: ItemPedidoMontado[] }> {
  const map = new Map<string, { nome: string; itens: ItemPedidoMontado[] }>()
  for (const item of itens) {
    const existente = map.get(item.fornecedorId)
    if (existente) {
      existente.itens.push(item)
    } else {
      map.set(item.fornecedorId, { nome: item.fornecedorNome, itens: [item] })
    }
  }
  return map
}

/**
 * Gera um PDF com uma página por fornecedor contendo a lista de itens do pedido
 * e faz o download do arquivo.
 */
export function gerarPdfPedidosPorFornecedor(pedido: PedidoMontado): void {
  const grupos = agruparPorFornecedor(pedido.itens)
  if (grupos.size === 0) return

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const dataHora = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  let primeiraPagina = true

  for (const [, { nome, itens }] of grupos) {
    if (!primeiraPagina) {
      doc.addPage()
    }
    primeiraPagina = false

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Pedal Construtivo', 14, 20)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Pedido para: ${nome}`, 14, 28)
    doc.setFontSize(9)
    doc.text(`Gerado em ${dataHora}`, 14, 34)

    const body = itens.map((item, idx) => [
      String(idx + 1),
      item.descricao,
      String(item.quantidade),
      formatarMoeda(item.precoUnitario),
      formatarMoeda(item.preco),
    ])
    const totalFornecedor = itens.reduce((s, i) => s + i.preco, 0)

    autoTable(doc, {
      startY: 42,
      head: [['#', 'Descrição', 'Qtd', 'P. unit.', 'Subtotal']],
      body,
      theme: 'grid',
      headStyles: { fillColor: [13, 148, 136], fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 16 },
        3: { cellWidth: 28 },
        4: { cellWidth: 28 },
      },
      margin: { left: 14 },
    })

    const finalY = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(`Total deste pedido: ${formatarMoeda(totalFornecedor)}`, 14, finalY)
  }

  doc.save(`pedido-fornecedores-${new Date().toISOString().slice(0, 10)}.pdf`)
}
