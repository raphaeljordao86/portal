import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { 
  Car, 
  Plus, 
  Edit, 
  Trash2, 
  User, 
  Calendar,
  Fuel,
  Search,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Vehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFuel, setFilterFuel] = useState('all');

  const [formData, setFormData] = useState({
    license_plate: '',
    model: '',
    year: new Date().getFullYear(),
    fuel_type: 'diesel',
    driver_name: ''
  });

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const response = await axios.get(`${API}/vehicles`);
      setVehicles(response.data);
    } catch (error) {
      toast.error('Erro ao carregar veículos');
      console.error('Error fetching vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingVehicle) {
        await axios.put(`${API}/vehicles/${editingVehicle.id}`, formData);
        toast.success('Veículo atualizado com sucesso!');
      } else {
        await axios.post(`${API}/vehicles`, formData);
        toast.success('Veículo cadastrado com sucesso!');
      }
      
      await fetchVehicles();
      handleCloseDialog();
    } catch (error) {
      const message = error.response?.data?.detail || 'Erro ao salvar veículo';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      license_plate: vehicle.license_plate,
      model: vehicle.model,
      year: vehicle.year,
      fuel_type: vehicle.fuel_type,
      driver_name: vehicle.driver_name || ''
    });
    setShowDialog(true);
  };

  const handleDelete = async (vehicleId) => {
    if (!window.confirm('Tem certeza que deseja excluir este veículo?')) {
      return;
    }

    try {
      await axios.delete(`${API}/vehicles/${vehicleId}`);
      toast.success('Veículo excluído com sucesso!');
      await fetchVehicles();
    } catch (error) {
      toast.error('Erro ao excluir veículo');
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingVehicle(null);
    setFormData({
      license_plate: '',
      model: '',
      year: new Date().getFullYear(),
      fuel_type: 'diesel',
      driver_name: ''
    });
  };

  const formatLicensePlate = (value) => {
    const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length <= 7) {
      return clean.replace(/^([A-Z]{3})([0-9])([A-Z0-9])([0-9]{2})$/, '$1$2$3$4');
    }
    return value.toUpperCase();
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = vehicle.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vehicle.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (vehicle.driver_name && vehicle.driver_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFuel = filterFuel === 'all' || vehicle.fuel_type === filterFuel;
    
    return matchesSearch && matchesFuel;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Veículos</h1>
          <p className="text-gray-600">Gerencie sua frota de veículos</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Veículo
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por placa, modelo ou motorista..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Select value={filterFuel} onValueChange={setFilterFuel}>
                <SelectTrigger>
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filtrar por combustível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os combustíveis</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="gasoline">Gasolina</SelectItem>
                  <SelectItem value="ethanol">Etanol</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles Grid */}
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((vehicle) => (
            <Card key={vehicle.id} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Car className="w-5 h-5 text-blue-600" />
                    {vehicle.license_plate}
                  </CardTitle>
                  <Badge variant={vehicle.is_active ? "success" : "secondary"}>
                    {vehicle.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Car className="w-4 h-4 text-gray-500" />
                    <span className="font-medium">{vehicle.model}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>Ano: {vehicle.year}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Fuel className="w-4 h-4 text-gray-500" />
                    <span className="capitalize">{vehicle.fuel_type}</span>
                  </div>
                  {vehicle.driver_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-gray-500" />
                      <span>{vehicle.driver_name}</span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(vehicle)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(vehicle.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredVehicles.length === 0 && !loading && (
        <Card>
          <CardContent className="p-12 text-center">
            <Car className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || filterFuel !== 'all' ? 'Nenhum veículo encontrado' : 'Nenhum veículo cadastrado'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || filterFuel !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Comece adicionando seu primeiro veículo à frota'}
            </p>
            {!searchTerm && filterFuel === 'all' && (
              <Button onClick={() => setShowDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Veículo
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vehicle Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => !loading && setShowDialog(open)}>
        <DialogContent 
          className="sm:max-w-md" 
          onPointerDownOutside={(e) => loading && e.preventDefault()}
          onEscapeKeyDown={(e) => loading && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editingVehicle ? 'Editar Veículo' : 'Novo Veículo'}
            </DialogTitle>
            <DialogDescription>
              {editingVehicle 
                ? 'Atualize as informações do veículo'
                : 'Adicione um novo veículo à sua frota'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-2">
              <Label htmlFor="license_plate">Placa do Veículo *</Label>
              <Input
                id="license_plate"
                placeholder="ABC1234"
                value={formData.license_plate}
                onChange={(e) => setFormData({
                  ...formData,
                  license_plate: formatLicensePlate(e.target.value)
                })}
                maxLength="7"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo *</Label>
              <Input
                id="model"
                placeholder="Mercedes Sprinter"
                value={formData.model}
                onChange={(e) => setFormData({...formData, model: e.target.value})}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="year">Ano *</Label>
                <Input
                  id="year"
                  type="number"
                  min="1990"
                  max={new Date().getFullYear() + 1}
                  value={formData.year}
                  onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fuel_type">Combustível *</Label>
                <Select 
                  value={formData.fuel_type} 
                  onValueChange={(value) => setFormData({...formData, fuel_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="gasoline">Gasolina</SelectItem>
                    <SelectItem value="ethanol">Etanol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver_name">Motorista (Opcional)</Label>
              <Input
                id="driver_name"
                placeholder="Nome do motorista responsável"
                value={formData.driver_name}
                onChange={(e) => setFormData({...formData, driver_name: e.target.value})}
              />
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
                {loading ? 'Salvando...' : editingVehicle ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Vehicles;