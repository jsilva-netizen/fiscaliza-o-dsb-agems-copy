import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, Trash2, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DocumentosManager({ documentos = [], onUpload, onDelete, isUploading }) {
    const [tipoSelecionado, setTipoSelecionado] = useState('outro');

    const getTipoBadge = (tipo) => {
        const colors = {
            cnpj: 'bg-blue-600',
            alvara: 'bg-green-600',
            licenca: 'bg-purple-600',
            outro: 'bg-gray-600'
        };
        return colors[tipo] || colors.outro;
    };

    const getTipoLabel = (tipo) => {
        const labels = {
            cnpj: 'CNPJ',
            alvara: 'Alvará',
            licenca: 'Licença',
            outro: 'Outro'
        };
        return labels[tipo] || tipo;
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            onUpload(file, tipoSelecionado);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documentos
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Upload Section */}
                <div className="border-2 border-dashed rounded-lg p-4">
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <Select value={tipoSelecionado} onValueChange={setTipoSelecionado}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cnpj">CNPJ</SelectItem>
                                    <SelectItem value="alvara">Alvará</SelectItem>
                                    <SelectItem value="licenca">Licença</SelectItem>
                                    <SelectItem value="outro">Outro</SelectItem>
                                </SelectContent>
                            </Select>
                            <input
                                type="file"
                                id="doc-upload"
                                className="hidden"
                                onChange={handleFileSelect}
                                disabled={isUploading}
                            />
                            <label htmlFor="doc-upload">
                                <Button asChild disabled={isUploading} className="cursor-pointer">
                                    <span>
                                        <Upload className="h-4 w-4 mr-1" />
                                        {isUploading ? 'Enviando...' : 'Anexar'}
                                    </span>
                                </Button>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Documentos List */}
                {documentos.length > 0 ? (
                    <div className="space-y-2">
                        {documentos.map((doc, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                <div className="flex items-center gap-3 flex-1">
                                    <FileText className="h-4 w-4 text-gray-600" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{doc.nome}</p>
                                        <p className="text-xs text-gray-500">
                                            {new Date(doc.data_upload).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <Badge className={getTipoBadge(doc.tipo)}>
                                        {getTipoLabel(doc.tipo)}
                                    </Badge>
                                </div>
                                <div className="flex gap-1">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => window.open(doc.url)}
                                    >
                                        <Download className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-red-600 hover:text-red-700"
                                        onClick={() => onDelete(idx)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 text-center">Nenhum documento anexado</p>
                )}
            </CardContent>
        </Card>
    );
}