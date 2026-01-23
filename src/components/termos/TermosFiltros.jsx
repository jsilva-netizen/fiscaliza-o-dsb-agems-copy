import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, X } from 'lucide-react';

export default function TermosFiltros({ onFilterChange, filtros }) {
  const handleFilterChange = (campo, valor) => {
    onFilterChange({ ...filtros, [campo]: valor });
  };

  const handleLimpar = () => {
    onFilterChange({
      camaraTecnica: '',
      status: '',
      dataInicio: '',
      dataFim: '',
      busca: ''
    });
  };

  const temFiltro = Object.values(filtros).some(v => v !== '');

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-gray-600" />
          <span className="font-semibold text-sm">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <Input
            placeholder="Buscar por número..."
            value={filtros.busca || ''}
            onChange={(e) => handleFilterChange('busca', e.target.value)}
          />
          <Select value={filtros.camaraTecnica || ''} onValueChange={(v) => handleFilterChange('camaraTecnica', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Câmara Técnica" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Todas</SelectItem>
              <SelectItem value="CATESA">CATESA</SelectItem>
              <SelectItem value="CATERS">CATERS</SelectItem>
              <SelectItem value="CRES">CRES</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtros.status || ''} onValueChange={(v) => handleFilterChange('status', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>Todos</SelectItem>
              <SelectItem value="pendente_tn">Pendente TN Assinado</SelectItem>
              <SelectItem value="pendente_protocolo">Pendente Protocolo</SelectItem>
              <SelectItem value="aguardando_resposta">Aguardando Resposta</SelectItem>
              <SelectItem value="prazo_vencido">Prazo Vencido</SelectItem>
              <SelectItem value="respondido">Respondido</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={filtros.dataInicio || ''}
            onChange={(e) => handleFilterChange('dataInicio', e.target.value)}
            placeholder="Data Início"
          />
          <Input
            type="date"
            value={filtros.dataFim || ''}
            onChange={(e) => handleFilterChange('dataFim', e.target.value)}
            placeholder="Data Fim"
          />
        </div>
        {temFiltro && (
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={handleLimpar}
              className="gap-1"
            >
              <X className="h-3 w-3" />
              Limpar Filtros
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}