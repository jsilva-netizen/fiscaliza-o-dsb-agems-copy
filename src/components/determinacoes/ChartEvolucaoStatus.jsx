import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ChartEvolucaoStatus({ determinacoes, respostas }) {
    // Agrupar por data e contar status
    const dadosPorData = {};
    
    determinacoes.forEach(det => {
        const data = new Date(det.created_date).toLocaleDateString('pt-BR');
        if (!dadosPorData[data]) {
            dadosPorData[data] = { pendentes: 0, atendidas: 0, justificadas: 0, nao_atendidas: 0 };
        }
        dadosPorData[data].pendentes++;
    });

    respostas.forEach(resp => {
        const data = new Date(resp.created_date).toLocaleDateString('pt-BR');
        if (!dadosPorData[data]) {
            dadosPorData[data] = { pendentes: 0, atendidas: 0, justificadas: 0, nao_atendidas: 0 };
        }
        if (resp.status === 'atendida') dadosPorData[data].atendidas++;
        if (resp.status === 'justificada') dadosPorData[data].justificadas++;
        if (resp.status === 'nao_atendida') dadosPorData[data].nao_atendidas++;
        dadosPorData[data].pendentes--;
    });

    const dados = Object.entries(dadosPorData)
        .sort(([a], [b]) => new Date(a) - new Date(b))
        .map(([data, valores]) => ({ data, ...valores }));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Evolução de Status</CardTitle>
            </CardHeader>
            <CardContent>
                {dados.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">Sem dados</div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={dados}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="data" tick={{ fontSize: 12 }} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="pendentes" stroke="#f97316" name="Pendentes" />
                            <Line type="monotone" dataKey="atendidas" stroke="#22c55e" name="Atendidas" />
                            <Line type="monotone" dataKey="justificadas" stroke="#3b82f6" name="Justificadas" />
                            <Line type="monotone" dataKey="nao_atendidas" stroke="#ef4444" name="Não Atendidas" />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}