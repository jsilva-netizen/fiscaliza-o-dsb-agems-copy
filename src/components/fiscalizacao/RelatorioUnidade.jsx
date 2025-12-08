import React from 'react';
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RelatorioUnidade({ 
    unidade, 
    fiscalizacao,
    respostas = [], 
    ncs = [], 
    determinacoes = [],
    recomendacoes = [],
    fotos = []
}) {
    const [isGenerating, setIsGenerating] = React.useState(false);

    const gerarRelatorio = async () => {
        setIsGenerating(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            let yPos = margin;

            // Função para adicionar nova página se necessário
            const checkPageBreak = (heightNeeded) => {
                if (yPos + heightNeeded > pageHeight - margin) {
                    pdf.addPage();
                    yPos = margin;
                    return true;
                }
                return false;
            };

            // Cabeçalho
            pdf.setFillColor(200, 200, 200);
            pdf.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text(unidade.tipo_unidade_nome.toUpperCase(), pageWidth / 2, yPos + 7, { align: 'center' });
            yPos += 12;

            // ID e Localização
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`ID Unidade: ${unidade.codigo_unidade || unidade.nome_unidade || '-'}`, margin + 2, yPos);
            yPos += 5;
            pdf.text(`Localização: ${unidade.endereco || '-'}`, margin + 2, yPos);
            yPos += 8;

            // Município e Data
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Município: ${fiscalizacao.municipio_nome}`, margin + 2, yPos);
            yPos += 5;
            pdf.text(`Data: ${format(new Date(unidade.data_hora_vistoria || unidade.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, margin + 2, yPos);
            yPos += 10;

            // Constatações
            pdf.setFillColor(220, 220, 220);
            pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, 'F');
            pdf.setFont('helvetica', 'bold');
            pdf.text('Constatações', margin + 2, yPos + 5);
            yPos += 9;

            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            
            const constatacoes = respostas.filter(r => r.resposta === 'SIM' || r.resposta === 'NA');
            constatacoes.forEach((resp, idx) => {
                checkPageBreak(10);
                const texto = `C${idx + 1}. ${resp.pergunta}${resp.observacao ? ` - ${resp.observacao}` : ''}`;
                const linhas = pdf.splitTextToSize(texto, pageWidth - 2 * margin - 4);
                pdf.text(linhas, margin + 2, yPos);
                yPos += linhas.length * 4 + 2;
            });

            yPos += 5;

            // Não Conformidades
            if (ncs.length > 0) {
                checkPageBreak(15);
                pdf.setFillColor(220, 220, 220);
                pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, 'F');
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Não Conformidades', margin + 2, yPos + 5);
                yPos += 9;

                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9);
                
                ncs.forEach((nc) => {
                    checkPageBreak(15);
                    const texto = `${nc.numero_nc}. ${nc.descricao}${nc.artigo_portaria ? ` - ${nc.artigo_portaria}` : ''}`;
                    const linhas = pdf.splitTextToSize(texto, pageWidth - 2 * margin - 4);
                    pdf.text(linhas, margin + 2, yPos);
                    yPos += linhas.length * 4 + 2;
                });

                yPos += 5;
            }

            // Recomendações
            if (recomendacoes.length > 0) {
                checkPageBreak(15);
                pdf.setFillColor(220, 220, 220);
                pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, 'F');
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Recomendações', margin + 2, yPos + 5);
                yPos += 9;

                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9);
                
                recomendacoes.forEach((rec) => {
                    checkPageBreak(10);
                    const texto = `${rec.numero_recomendacao}. ${rec.descricao}`;
                    const linhas = pdf.splitTextToSize(texto, pageWidth - 2 * margin - 4);
                    pdf.text(linhas, margin + 2, yPos);
                    yPos += linhas.length * 4 + 2;
                });

                yPos += 5;
            }

            // Determinações
            if (determinacoes.length > 0) {
                checkPageBreak(15);
                pdf.setFillColor(220, 220, 220);
                pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, 'F');
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Determinações', margin + 2, yPos + 5);
                yPos += 9;

                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(9);
                
                determinacoes.forEach((det) => {
                    checkPageBreak(12);
                    const texto = `${det.numero_determinacao}. ${det.descricao} Prazo: ${det.prazo_dias} dias.`;
                    const linhas = pdf.splitTextToSize(texto, pageWidth - 2 * margin - 4);
                    pdf.text(linhas, margin + 2, yPos);
                    yPos += linhas.length * 4 + 2;
                });

                yPos += 5;
            }

            // Registros Fotográficos
            if (fotos.length > 0) {
                pdf.addPage();
                yPos = margin;

                pdf.setFillColor(220, 220, 220);
                pdf.rect(margin, yPos, pageWidth - 2 * margin, 7, 'F');
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Registros Fotográficos', margin + 2, yPos + 5);
                yPos += 12;

                // Adicionar fotos em grid 2x2
                const imgWidth = (pageWidth - 3 * margin) / 2;
                const imgHeight = 60;
                let col = 0;
                let row = 0;

                for (let i = 0; i < fotos.length; i++) {
                    if (yPos + imgHeight + 15 > pageHeight - margin) {
                        pdf.addPage();
                        yPos = margin;
                        col = 0;
                        row = 0;
                    }

                    const xPos = margin + col * (imgWidth + margin / 2);
                    const currentYPos = yPos + row * (imgHeight + 15);

                    try {
                        // Adicionar imagem
                        pdf.addImage(fotos[i].url, 'JPEG', xPos, currentYPos, imgWidth, imgHeight);
                        
                        // Adicionar legenda
                        pdf.setFontSize(8);
                        pdf.setFont('helvetica', 'normal');
                        const legenda = fotos[i].legenda || `Figura ${i + 1}`;
                        pdf.text(legenda, xPos + imgWidth / 2, currentYPos + imgHeight + 4, { align: 'center' });
                    } catch (err) {
                        console.error('Erro ao adicionar foto:', err);
                    }

                    col++;
                    if (col === 2) {
                        col = 0;
                        row++;
                        if (row === 2) {
                            yPos += (imgHeight + 15) * 2;
                            row = 0;
                        }
                    }
                }
            }

            // Salvar PDF
            const nomeArquivo = `Relatorio_${unidade.tipo_unidade_nome}_${unidade.codigo_unidade || 'sem-id'}_${format(new Date(), 'yyyyMMdd-HHmmss')}.pdf`;
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
            onClick={gerarRelatorio}
            disabled={isGenerating}
            className="w-full bg-blue-600 hover:bg-blue-700"
        >
            {isGenerating ? (
                <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Gerando Relatório...
                </>
            ) : (
                <>
                    <FileText className="h-5 w-5 mr-2" />
                    Gerar Relatório PDF
                </>
            )}
        </Button>
    );
}