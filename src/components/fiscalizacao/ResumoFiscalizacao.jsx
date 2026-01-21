import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, X } from 'lucide-react';

export default function ResumoFiscalizacao({ fiscalizacao_id, prestadorNome }) {
    const [resumo, setResumo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showResumo, setShowResumo] = useState(false);
    const [erro, setErro] = useState(null);

    const gerarResumo = async () => {
        setLoading(true);
        setErro(null);
        try {
            const response = await base44.functions.invoke('gerarResumoFiscalizacao', {
                fiscalizacao_id: fiscalizacao_id
            });
            setResumo(response.data.resumo);
            setShowResumo(true);
        } catch (err) {
            setErro('Erro ao gerar resumo: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button
                variant="outline"
                onClick={gerarResumo}
                disabled={loading}
                className="gap-2 border-blue-200 hover:bg-blue-50"
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Sparkles className="h-4 w-4 text-blue-600" />
                )}
                {loading ? 'Gerando resumo...' : 'Resumo com IA'}
            </Button>

            {showResumo && resumo && (
                <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-transparent mt-4">
                    <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-blue-600" />
                                <CardTitle className="text-base">Resumo da Fiscalização</CardTitle>
                            </div>
                            <button
                                onClick={() => setShowResumo(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {resumo}
                        </p>
                        <p className="text-xs text-gray-400 mt-3">
                            Resumo gerado automaticamente por IA
                        </p>
                    </CardContent>
                </Card>
            )}

            {erro && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {erro}
                </div>
            )}
        </>
    );
}