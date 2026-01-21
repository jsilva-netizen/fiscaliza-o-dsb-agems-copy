import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Shield, Trash2, Loader2, Mail, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function GerenciarUsuarios() {
    const queryClient = useQueryClient();
    const [showInviteDialog, setShowInviteDialog] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('user');
    const [currentUser, setCurrentUser] = useState(null);

    const { data: usuarios = [], isLoading } = useQuery({
        queryKey: ['usuarios-admin'],
        queryFn: () => base44.entities.User.list('full_name', 500)
    });

    const { data: me } = useQuery({
        queryKey: ['current-user'],
        queryFn: async () => {
            const user = await base44.auth.me();
            setCurrentUser(user);
            return user;
        }
    });

    const convidarMutation = useMutation({
        mutationFn: (data) => base44.users.inviteUser(data.email, data.role),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['usuarios-admin'] });
            setInviteEmail('');
            setInviteRole('user');
            setShowInviteDialog(false);
            alert('Usuário convidado com sucesso!');
        },
        onError: () => {
            alert('Erro ao convidar usuário');
        }
    });

    const atualizarRoleMutation = useMutation({
        mutationFn: ({ userId, role }) => base44.entities.User.update(userId, { role }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['usuarios-admin'] });
        }
    });

    const desativarMutation = useMutation({
        mutationFn: ({ userId }) => base44.entities.User.update(userId, { ativo: false }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['usuarios-admin'] });
        }
    });

    const handleInvite = () => {
        if (!inviteEmail) {
            alert('Email é obrigatório');
            return;
        }
        convidarMutation.mutate({ email: inviteEmail, role: inviteRole });
    };

    const handleChangeRole = (userId, newRole) => {
        if (confirm(`Tem certeza que deseja alterar a permissão deste usuário?`)) {
            atualizarRoleMutation.mutate({ userId, role: newRole });
        }
    };

    const handleDeactivate = (userId, userName) => {
        if (confirm(`Desativar ${userName}?`)) {
            desativarMutation.mutate({ userId });
        }
    };

    const isAdmin = currentUser?.role === 'admin';

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-blue-900 text-white">
                <div className="max-w-6xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-3">
                        <Link to={createPageUrl('Home')}>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-4 py-6">
                {!isAdmin ? (
                    <Card>
                        <CardContent className="p-6 text-center text-gray-500">
                            <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>Apenas administradores podem gerenciar usuários.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="flex justify-end mb-6">
                            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                                <DialogTrigger asChild>
                                    <Button className="bg-blue-600 hover:bg-blue-700">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Convidar Usuário
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Convidar Novo Usuário</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                        <Input
                                            type="email"
                                            placeholder="Email do usuário"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                        />
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">Permissão</label>
                                            <Select value={inviteRole} onValueChange={setInviteRole}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="user">Usuário</SelectItem>
                                                    <SelectItem value="admin">Administrador</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={handleInvite}
                                                disabled={convidarMutation.isPending}
                                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                                            >
                                                {convidarMutation.isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : null}
                                                Convidar
                                            </Button>
                                            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                                                Cancelar
                                            </Button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            </div>
                        ) : usuarios.length === 0 ? (
                            <Card>
                                <CardContent className="p-6 text-center text-gray-500">
                                    Nenhum usuário registrado.
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-4">
                                {usuarios.map(usuario => (
                                    <Card key={usuario.id}>
                                        <CardContent className="p-6">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="font-semibold text-lg">{usuario.full_name}</h3>
                                                        <Badge className={usuario.role === 'admin' ? 'bg-purple-600' : 'bg-blue-600'}>
                                                            {usuario.role === 'admin' ? 'Admin' : 'Usuário'}
                                                        </Badge>
                                                        {usuario.ativo === false && (
                                                            <Badge variant="outline" className="bg-gray-100">Inativo</Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                                                        <Mail className="h-4 w-4" />
                                                        {usuario.email}
                                                    </div>
                                                    <p className="text-xs text-gray-500">
                                                        Criado em {new Date(usuario.created_date).toLocaleDateString('pt-BR')}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    {usuario.id !== currentUser?.id && (
                                                        <>
                                                            <Select
                                                                value={usuario.role}
                                                                onValueChange={(newRole) => handleChangeRole(usuario.id, newRole)}
                                                            >
                                                                <SelectTrigger className="w-32">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="user">Usuário</SelectItem>
                                                                    <SelectItem value="admin">Admin</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => handleDeactivate(usuario.id, usuario.full_name)}
                                                                disabled={desativarMutation.isPending}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}