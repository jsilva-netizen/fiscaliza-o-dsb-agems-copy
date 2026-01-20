import React from 'react';
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

export default function ExportarCSV({ fiscalizacoes }) {
    const [isExporting, setIsExporting] = React.useState(false);

    const exportarCSV = async () => {
        setIsExporting(true);
        try {
            const dados = [];
            
            for (const fisc of fiscalizacoes) {
                // Buscar unidades da fiscalização
                const unidades = await base44.entities.UnidadeFiscalizada.filter({ 
                    fiscalizacao_id: fisc.id 
                });

                for (const unidade of unidades) {
                    // Buscar NCs, Determinações e Recomendações
                    const ncs = await base44.entities.NaoConformidade.filter({ 
                        unidade_fiscalizada_id: unidade.id 
                    });
                    const determinacoes = await base44.entities.Determinacao.filter({ 
                        unidade_fiscalizada_id: unidade.id 
                    });
                    const recomendacoes = await base44.entities.Recomendacao.filter({ 
                        unidade_fiscalizada_id: unidade.id 
                    });

                    // Adicionar linha para cada unidade
                    dados.push({
                        'Município': fisc.municipio_nome || '',
                        'Serviço': fisc.servico || '',
                        'Status': fisc.status === 'finalizada' ? 'Finalizada' : 'Em andamento',
                        'Data Início': format(new Date(fisc.data_inicio), 'dd/MM/yyyy HH:mm'),
                        'Data Fim': fisc.data_fim ? format(new Date(fisc.data_fim), 'dd/MM/yyyy HH:mm') : '',
                        'Fiscal': fisc.fiscal_nome || '',
                        'Tipo Unidade': unidade.tipo_unidade_nome || '',
                        'Código Unidade': unidade.codigo_unidade || '',
                        'Nome Unidade': unidade.nome_unidade || '',
                        'Total Constatações': unidade.total_constatacoes || 0,
                        'Total NCs': ncs.length,
                        'Total Determinações': determinacoes.length,
                        'Total Recomendações': recomendacoes.length,
                        'Observações': fisc.observacoes_gerais || ''
                    });
                }
            }

            // Converter para CSV
            if (dados.length === 0) {
                alert('Nenhum dado para exportar');
                return;
            }

            const headers = Object.keys(dados[0]);
            const csvContent = [
                headers.join(','),
                ...dados.map(row => 
                    headers.map(h => {
                        const value = row[h]?.toString() || '';
                        return `"${value.replace(/"/g, '""')}"`;
                    }).join(',')
                )
            ].join('\n');

            // Download
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `fiscalizacoes_${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Erro ao exportar CSV:', err);
            alert('Erro ao exportar CSV. Tente novamente.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Button 
            onClick={exportarCSV}
            disabled={isExporting || fiscalizacoes.length === 0}
            variant="outline"
            className="flex-1"
        >
            {isExporting ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Exportando...
                </>
            ) : (
                <>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Exportar CSV
                </>
            )}
        </Button>
    );
}