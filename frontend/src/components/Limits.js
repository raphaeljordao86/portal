import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  AlertTriangle, 
  Plus, 
  Edit, 
  Trash2, 
  Car,
  Fuel,
  DollarSign,
  Calendar,
  Target,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Tradução dos nomes dos combustíveis
const FUEL_NAMES = {
  diesel: 'Diesel S10',
  gasoline: 'Gasolina Comum', 
  ethanol: 'Etanol'
};

const Limits = () => {
  const [limits, setLimits] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingLimit, setEditingLimit] = useState(null);

  const [formData, setFormData] = useState({
    vehicle_id: 'all',
    limit_type: 'daily',
    fuel_type: 'all',
    limit_value: '',
    limit_unit: 'currency'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [limitsResponse, vehiclesResponse] = await Promise.all([
        axios.get(`${API}/limits`),
        axios.get(`${API}/vehicles`)
      ]);
      
      // Remove duplicates from vehicles array based on id
      const uniqueVehicles = vehiclesResponse.data.filter((vehicle, index, self) => 
        index === self.findIndex(v => v.id === vehicle.id)
      );
      
      setLimits(limitsResponse.data);
      setVehicles(uniqueVehicles);
    } catch (error) {
      toast.error('Erro ao carregar dados');
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        limit_value: parseFloat(formData.limit_value),
        vehicle_id: formData.vehicle_id === "all" ? null : formData.vehicle_id || null,
        fuel_type: formData.fuel_type === "all" ? null : formData.fuel_type || null
      };

      if (editingLimit) {
        await axios.put(`${API}/limits/${editingLimit.id}`, submitData);
        toast.success('Limite atualizado com sucesso!');
      } else {
        await axios.post(`${API}/limits`, submitData);
        toast.success('Limite criado com sucesso!');
      }
      
      await fetchData();
      handleCloseDialog();
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao salvar limite';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (limit) => {
    setEditingLimit(limit);
    setFormData({
      vehicle_id: limit.vehicle_id || 'all',
      limit_type: limit.limit_type,
      fuel_type: limit.fuel_type || 'all',
      limit_value: limit.limit_value.toString(),
      limit_unit: limit.limit_unit
    });
    setShowDialog(true);
  };

  const handleDelete = async (limitId) => {
    if (!window.confirm('Tem certeza que deseja excluir este limite?')) {
      return;
    }

    try {
      await axios.delete(`${API}/limits/${limitId}`);
      toast.success('Limite excluído com sucesso!');
      await fetchData();
    } catch (error) {
      toast.error('Erro ao excluir limite');
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingLimit(null);
    setFormData({
      vehicle_id: 'all',
      limit_type: 'daily',
      fuel_type: 'all',
      limit_value: '',
      limit_unit: 'currency'
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getVehicleName = (vehicleId) => {
    if (!vehicleId) return 'Todos os veículos';
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.license_plate} - ${vehicle.model}` : 'Veículo não encontrado';
  };

  const getUsagePercentage = (current, limit) => {
    return Math.min((current / limit) * 100, 100);
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 90) return 'bg-orange-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getLimitTypeLabel = (type) => {
    const labels = {
      daily: 'Diário',
      weekly: 'Semanal',
      monthly: 'Mensal'
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Limites de Abastecimento</h1>
          <p className="text-gray-600">Configure e monitore os limites da sua frota</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Limite
        </Button>
      </div>

      {/* Limits Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : limits.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {limits.map((limit) => {
            const usagePercentage = getUsagePercentage(limit.current_usage, limit.limit_value);
            const usageColor = getUsageColor(usagePercentage);
            
            return (
              <Card key={limit.id} className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      {getLimitTypeLabel(limit.limit_type)}
                    </CardTitle>
                    <Badge 
                      variant={usagePercentage >= 100 ? "destructive" : usagePercentage >= 90 ? "warning" : "success"}
                    >
                      {usagePercentage.toFixed(0)}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Car className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{getVehicleName(limit.vehicle_id)}</span>
                    </div>
                    
                    {limit.fuel_type && (
                      <div className="flex items-center gap-2 text-sm">
                        <Fuel className="w-4 h-4 text-gray-500" />
                        <span className="capitalize">{FUEL_NAMES[limit.fuel_type] || limit.fuel_type}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      <span>
                        Limite: {limit.limit_unit === 'currency' 
                          ? formatCurrency(limit.limit_value)
                          : `${limit.limit_value}L`
                        }
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span>Reset: {formatDate(limit.reset_date)}</span>
                    </div>
                  </div>

                  {/* Usage Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Uso atual</span>
                      <span className="font-medium">
                        {limit.limit_unit === 'currency' 
                          ? formatCurrency(limit.current_usage)
                          : `${limit.current_usage.toFixed(1)}L`
                        }
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${usageColor}`}
                        style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(limit)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(limit.id);
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum limite configurado
            </h3>
            <p className="text-gray-500 mb-4">
              Configure limites de abastecimento para controlar o consumo da sua frota
            </p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Limite
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Limit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => !loading && setShowDialog(open)}>
        <DialogContent 
          className="sm:max-w-md"
          onPointerDownOutside={(e) => loading && e.preventDefault()}
          onEscapeKeyDown={(e) => loading && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editingLimit ? 'Editar Limite' : 'Novo Limite'}
            </DialogTitle>
            <DialogDescription>
              {editingLimit 
                ? 'Atualize as configurações do limite'
                : 'Configure um novo limite de abastecimento'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-2">
              <Label htmlFor="vehicle_id">Veículo (Opcional)</Label>
              <Select 
                value={formData.vehicle_id} 
                onValueChange={(value) => setFormData({...formData, vehicle_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um veículo ou deixe em branco para todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os veículos</SelectItem>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.license_plate} - {vehicle.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="limit_type">Período *</Label>
                <Select 
                  value={formData.limit_type} 
                  onValueChange={(value) => setFormData({...formData, limit_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fuel_type">Combustível (Opcional)</Label>
                <Select 
                  value={formData.fuel_type} 
                  onValueChange={(value) => setFormData({...formData, fuel_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os combustíveis</SelectItem>
                    <SelectItem value="diesel">Diesel S10</SelectItem>
                    <SelectItem value="gasoline">Gasolina Comum</SelectItem>
                    <SelectItem value="ethanol">Etanol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="limit_unit">Tipo de Limite *</Label>
                <Select 
                  value={formData.limit_unit} 
                  onValueChange={(value) => setFormData({...formData, limit_unit: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="currency">Valor (R$)</SelectItem>
                    <SelectItem value="liters">Litros (L)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="limit_value">
                  Limite * {formData.limit_unit === 'currency' ? '(R$)' : '(Litros)'}
                </Label>
                <Input
                  id="limit_value"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={formData.limit_unit === 'currency' ? '500.00' : '100'}
                  value={formData.limit_value}
                  onChange={(e) => setFormData({...formData, limit_value: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleCloseDialog} 
                className="flex-1"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading} 
                className="flex-1 relative z-10"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubmit(e);
                }}
              >
                {loading ? 'Salvando...' : editingLimit ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Limits;