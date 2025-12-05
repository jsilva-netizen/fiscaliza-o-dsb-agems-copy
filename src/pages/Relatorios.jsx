import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    ArrowLeft, BarChart3, MapPin, CheckCircle2, AlertTriangle, 
    TrendingUp, Building2, FileText, Download
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b'];

export default function Relatorios() {
    const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear().toString());

    const { data: fiscalizacoes = [] } = useQuery({
        queryKey: ['fiscalizacoes'],
        queryFn: () => base44.entities.Fiscalizacao.list('-created_date', 500)
    });

    const { data: municipios = [] } = useQuery({
        queryKey: ['municipios'],
        queryFn: () => base44.entities.Municipio.list('nome', 100)
    });

    const { data: ncs = [] } = useQuery({
        queryKey: ['todas-ncs'],
        queryFn: () => base44.entities.NaoConformidade.list('-created_date', 1000)
    });

    // Filtrar por ano
    const fiscalizacoesAno = fiscalizacoes.filter(f => 
        new Date(f.created_date).getFullYear().toString() === anoFiltro
    );

    // Estatísticas gerais
    const totalFiscalizacoes = fiscalizacoesAno.length;
    const finalizadas = fiscalizacoesAno.filter(f => f.status === 'finalizada').length;
    const totalNCs = fiscalizacoesAno.reduce((acc, f) => acc + (f.total_nao_conformidades || 0), 0);
    const totalConformidades = fiscalizacoesAno.reduce((acc, f) => acc + (f.total_conformidades || 0), 0);

    // Dados por serviço
    const porServico = {};
    fiscalizacoesAno.forEach(f => {
        if (!porServico[f.servico]) {
            porServico[f.servico] = { servico: f.servico, quantidade: 0, ncs: 0 };
        }
        porServico[f.servico].quantidade++;
        porServico[f.servico].ncs += f.total_nao_conformidades || 0;
    });
    const dadosServico = Object.values(porServico);

    // Dados por município (top 10)
    const porMunicipio = {};
    fiscalizacoesAno.forEach(f => {
        if (!porMunicipio[f.municipio_nome]) {
            porMunicipio[f.municipio_nome] = { municipio: f.municipio_nome, fiscalizacoes: 0, ncs: 0 };
        }
        porMunicipio[f.municipio_nome].fiscalizacoes++;
        porMunicipio[f.municipio_nome].ncs += f.total_nao_conformidades || 0;
    });
    const topMunicipios = Object.values(porMunicipio)
        .sort((a, b) => b.fiscalizacoes - a.fiscalizacoes)
        .slice(0, 10);

    // Dados para gráfico de pizza
    const dadosPizza = [
        { name: 'Conformidades', value: totalConformidades },
        { name: 'Não Conformidades', value: totalNCs }
    ];

    // Municípios sem fiscalização
    const municipiosFiscalizados = new Set(fiscalizacoesAno.map(f => f.municipio_nome));
    const municipiosSemFiscalizacao = municipios.filter(m => !municipiosFiscalizados.has(m.nome));

    const anos = ['2024', '2025', '2026'];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-blue-900 text-white">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link to={createPageUrl('Home')}>
                                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold">Relatórios e Indicadores</h1>
                                <p className="text-blue-200 text-sm">Visão geral das fiscalizações</p>
                            </div>
                        </div>
                        <Select value={anoFiltro} onValueChange={setAnoFiltro}>
                            <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {anos.map(ano => (
                                    <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{totalFiscalizacoes}</p>
                                    <p className="text-xs text-gray-500">Fiscalizações</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{finalizadas}</p>
                                    <p className="text-xs text-gray-500">Finalizadas</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                                    <AlertTriangle className="h-5 w-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{totalNCs}</p>
                                    <p className="text-xs text-gray-500">Não Conformidades</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <MapPin className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{municipiosFiscalizados.size}</p>
                                    <p className="text-xs text-gray-500">Municípios</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Por Serviço */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Fiscalizações por Serviço</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {dadosServico.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={dadosServico}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="servico" tick={{ fontSize: 10 }} />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="quantidade" fill="#3b82f6" name="Fiscalizações" />
                                        <Bar dataKey="ncs" fill="#ef4444" name="NCs" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-gray-500 py-8">Sem dados para exibir</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Conformidade vs NC */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Conformidade Geral</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {(totalConformidades > 0 || totalNCs > 0) ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={dadosPizza}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {dadosPizza.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-gray-500 py-8">Sem dados para exibir</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Top Municípios */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-lg">Top 10 Municípios Fiscalizados</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {topMunicipios.length > 0 ? (
                            <div className="space-y-3">
                                {topMunicipios.map((m, index) => (
                                    <div key={m.municipio} className="flex items-center gap-3">
                                        <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-600">
                                            {index + 1}
                                        </span>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium">{m.municipio}</span>
                                                <div className="flex gap-2">
                                                    <Badge variant="secondary">{m.fiscalizacoes} fisc.</Badge>
                                                    {m.ncs > 0 && (
                                                        <Badge variant="destructive">{m.ncs} NCs</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full mt-1">
                                                <div 
                                                    className="h-full bg-blue-500 rounded-full"
                                                    style={{ width: `${(m.fiscalizacoes / topMunicipios[0].fiscalizacoes) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 py-8">Sem dados para exibir</p>
                        )}
                    </CardContent>
                </Card>

                {/* Municípios sem fiscalização */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                            Municípios sem Fiscalização em {anoFiltro}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500 mb-4">
                            {municipiosSemFiscalizacao.length} de 79 municípios ({Math.round((municipiosSemFiscalizacao.length / 79) * 100)}%)
                        </p>
                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                            {municipiosSemFiscalizacao.slice(0, 30).map(m => (
                                <Badge key={m.id} variant="outline" className="text-xs">
                                    {m.nome}
                                </Badge>
                            ))}
                            {municipiosSemFiscalizacao.length > 30 && (
                                <Badge variant="secondary">+{municipiosSemFiscalizacao.length - 30} mais</Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}