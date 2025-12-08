import React from 'react';
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { base44 } from '@/api/base44Client';

export default function RelatorioFiscalizacao({ fiscalizacao }) {
    const [isGenerating, setIsGenerating] = React.useState(false);

    const gerarRelatorio = async () => {
        setIsGenerating(true);
        try {
            // Buscar dados completos
            const unidades = await base44.entities.UnidadeFiscalizada.filter(
                { fiscalizacao_id: fiscalizacao.id }, 
                'created_date', 
                100
            );

            const todasRespostas = await Promise.all(
                unidades.map(u => 
                    base44.entities.RespostaChecklist.filter({ unidade_fiscalizada_id: u.id }, 'id', 500)
                )
            );

            const todasNcs = await Promise.all(
                unidades.map(u => 
                    base44.entities.NaoConformidade.filter({ unidade_fiscalizada_id: u.id }, 'id', 200)
                )
            );

            const todasDeterminacoes = await Promise.all(
                unidades.map(u => 
                    base44.entities.Determinacao.filter({ unidade_fiscalizada_id: u.id }, 'id', 200)
                )
            );

            const todasRecomendacoes = await Promise.all(
                unidades.map(u => 
                    base44.entities.Recomendacao.filter({ unidade_fiscalizada_id: u.id }, 'id', 200)
                )
            );

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            let yPos = margin;

            const checkPageBreak = (heightNeeded) => {
                if (yPos + heightNeeded > pageHeight - margin) {
                    pdf.addPage();
                    yPos = margin;
                    return true;
                }
                return false;
            };

            // Capa
            pdf.setFillColor(30, 64, 175);
            pdf.rect(0, 0, pageWidth, 60, 'F');
            
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(20);
            pdf.setFont('helvetica', 'bold');
            pdf.text('RELATÓRIO DE FISCALIZAÇÃO', pageWidth / 2, 25, { align: 'center' });
            
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'normal');
            pdf.text(fiscalizacao.municipio_nome.toUpperCase(), pageWidth / 2, 35, { align: 'center' });
            pdf.text(fiscalizacao.servico, pageWidth / 2, 45, { align: 'center' });

            pdf.setTextColor(0, 0, 0);
            yPos = 75;

            // Informações da Fiscalização
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('INFORMAÇÕES DA FISCALIZAÇÃO', margin, yPos);
            yPos += 8;

            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Município: ${fiscalizacao.municipio_nome}`, margin + 2, yPos);
            yPos += 5;
            pdf.text(`Serviço: ${fiscalizacao.servico}`, margin + 2, yPos);
            yPos += 5;
            pdf.text(`Data Início: ${format(new Date(fiscalizacao.data_inicio), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, margin + 2, yPos);
            yPos += 5;
            if (fiscalizacao.data_fim) {
                pdf.text(`Data Fim: ${format(new Date(fiscalizacao.data_fim), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, margin + 2, yPos);
                yPos += 5;
            }
            if (fiscalizacao.fiscal_nome) {
                pdf.text(`Fiscal: ${fiscalizacao.fiscal_nome}`, margin + 2, yPos);
                yPos += 5;
            }
            yPos += 5;

            // Resumo
            checkPageBreak(25);
            pdf.setFillColor(220, 220, 220);
            pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, 'F');
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('RESUMO EXECUTIVO', margin + 2, yPos + 5);
            yPos += 10;

            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`• Unidades Vistoriadas: ${unidades.length}`, margin + 2, yPos);
            yPos += 5;
            pdf.text(`• Total de Conformidades: ${fiscalizacao.total_conformidades || 0}`, margin + 2, yPos);
            yPos += 5;
            pdf.text(`• Total de Não Conformidades: ${fiscalizacao.total_nao_conformidades || 0}`, margin + 2, yPos);
            yPos += 5;
            pdf.text(`• Total de Recomendações: ${fiscalizacao.total_recomendacoes || 0}`, margin + 2, yPos);
            yPos += 5;
            pdf.text(`• Total de Determinações: ${fiscalizacao.total_determinacoes || 0}`, margin + 2, yPos);
            yPos += 10;

            // Para cada unidade
            unidades.forEach((unidade, idx) => {
                const respostas = todasRespostas[idx] || [];
                const ncs = todasNcs[idx] || [];
                const determinacoes = todasDeterminacoes[idx] || [];
                const recomendacoes = todasRecomendacoes[idx] || [];

                checkPageBreak(30);
                pdf.addPage();
                yPos = margin;

                // Título da Unidade
                pdf.setFillColor(200, 200, 200);
                pdf.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
                pdf.setFontSize(14);
                pdf.setFont('helvetica', 'bold');
                pdf.text(`${idx + 1}. ${unidade.tipo_unidade_nome.toUpperCase()}`, pageWidth / 2, yPos + 7, { align: 'center' });
                yPos += 12;

                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                if (unidade.codigo_unidade) {
                    pdf.text(`ID: ${unidade.codigo_unidade}`, margin + 2, yPos);
                    yPos += 5;
                }
                if (unidade.nome_unidade) {
                    pdf.text(`Nome: ${unidade.nome_unidade}`, margin + 2, yPos);
                    yPos += 5;
                }
                if (unidade.endereco) {
                    pdf.text(`Endereço: ${unidade.endereco}`, margin + 2, yPos);
                    yPos += 5;
                }
                yPos += 3;

                // Constatações
                const constatacoes = respostas.filter(r => r.resposta === 'SIM' || r.resposta === 'NA');
                if (constatacoes.length > 0) {
                    checkPageBreak(15);
                    pdf.setFillColor(220, 220, 220);
                    pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, 'F');
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('Constatações', margin + 2, yPos + 5);
                    yPos += 9;

                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(9);
                    constatacoes.forEach((resp, i) => {
                        checkPageBreak(8);
                        const texto = `C${i + 1}. ${resp.pergunta}`;
                        const linhas = pdf.splitTextToSize(texto, pageWidth - 2 * margin - 4);
                        pdf.text(linhas, margin + 2, yPos);
                        yPos += linhas.length * 4 + 2;
                    });
                    yPos += 3;
                }

                // Não Conformidades
                if (ncs.length > 0) {
                    checkPageBreak(15);
                    pdf.setFontSize(10);
                    pdf.setFillColor(220, 220, 220);
                    pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, 'F');
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('Não Conformidades', margin + 2, yPos + 5);
                    yPos += 9;

                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(9);
                    ncs.forEach((nc) => {
                        checkPageBreak(10);
                        const texto = `${nc.numero_nc}. ${nc.descricao}`;
                        const linhas = pdf.splitTextToSize(texto, pageWidth - 2 * margin - 4);
                        pdf.text(linhas, margin + 2, yPos);
                        yPos += linhas.length * 4 + 2;
                    });
                    yPos += 3;
                }

                // Determinações
                if (determinacoes.length > 0) {
                    checkPageBreak(15);
                    pdf.setFontSize(10);
                    pdf.setFillColor(220, 220, 220);
                    pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, 'F');
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('Determinações', margin + 2, yPos + 5);
                    yPos += 9;

                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(9);
                    determinacoes.forEach((det) => {
                        checkPageBreak(10);
                        const texto = `${det.numero_determinacao}. ${det.descricao} Prazo: ${det.prazo_dias} dias.`;
                        const linhas = pdf.splitTextToSize(texto, pageWidth - 2 * margin - 4);
                        pdf.text(linhas, margin + 2, yPos);
                        yPos += linhas.length * 4 + 2;
                    });
                    yPos += 3;
                }

                // Recomendações
                if (recomendacoes.length > 0) {
                    checkPageBreak(15);
                    pdf.setFontSize(10);
                    pdf.setFillColor(220, 220, 220);
                    pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, 'F');
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('Recomendações', margin + 2, yPos + 5);
                    yPos += 9;

                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(9);
                    recomendacoes.forEach((rec) => {
                        checkPageBreak(8);
                        const texto = `${rec.numero_recomendacao}. ${rec.descricao}`;
                        const linhas = pdf.splitTextToSize(texto, pageWidth - 2 * margin - 4);
                        pdf.text(linhas, margin + 2, yPos);
                        yPos += linhas.length * 4 + 2;
                    });
                }
            });

            // Salvar
            const nomeArquivo = `Relatorio_Fiscalizacao_${fiscalizacao.municipio_nome}_${format(new Date(), 'yyyyMMdd-HHmmss')}.pdf`;
            pdf.save(nomeArquivo);

        } catch (err) {
            console.error('Erro ao gerar relatório:', err);
            alert('Erro ao gerar relatório. Tente novamente.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Button 
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                gerarRelatorio();
            }}
            disabled={isGenerating}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="sm"
        >
            {isGenerating ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Gerando...
                </>
            ) : (
                <>
                    <FileText className="h-4 w-4 mr-2" />
                    Gerar Relatório
                </>
            )}
        </Button>
    );
}