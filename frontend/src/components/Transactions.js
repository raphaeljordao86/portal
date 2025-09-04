import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { 
  Fuel, 
  Car, 
  MapPin, 
  Calendar as CalendarIcon,
  Search,
  Filter,
  Download,
  TrendingUp,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('all');
  const [filterFuel, setFilterFuel] = useState('all');
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [transactionsResponse, vehiclesResponse] = await Promise.all([
        axios.get(`${API}/transactions`),
        axios.get(`${API}/vehicles`)
      ]);
      setTransactions(transactionsResponse.data);
      setVehicles(vehiclesResponse.data);
    } catch (error) {
      toast.error('Erro ao carregar dados');
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getVehicleName = (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    return vehicle ? `${vehicle.license_plate} - ${vehicle.model}` : 'Veículo não encontrado';
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.station_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesVehicle = filterVehicle === 'all' || transaction.vehicle_id === filterVehicle;
    const matchesFuel = filterFuel === 'all' || transaction.fuel_type === filterFuel;
    
    let matchesDate = true;
    if (dateRange.from || dateRange.to) {
      const transactionDate = new Date(transaction.transaction_date);
      if (dateRange.from && dateRange.to) {
        matchesDate = transactionDate >= dateRange.from && transactionDate <= dateRange.to;
      } else if (dateRange.from) {
        matchesDate = transactionDate >= dateRange.from;
      } else if (dateRange.to) {
        matchesDate = transactionDate <= dateRange.to;
      }
    }
    
    return matchesSearch && matchesVehicle && matchesFuel && matchesDate;
  });

  const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.total_amount, 0);
  const totalLiters = filteredTransactions.reduce((sum, t) => sum + t.liters, 0);
  const avgPricePerLiter = totalLiters > 0 ? totalAmount / totalLiters : 0;

  const clearFilters = () => {
    setSearchTerm('');
    setFilterVehicle('all');
    setFilterFuel('all');
    setDateRange({ from: null, to: null });
  };

  const getFuelTypeColor = (fuelType) => {
    const colors = {
      diesel: 'bg-blue-100 text-blue-800',
      gasoline: 'bg-green-100 text-green-800',
      ethanol: 'bg-yellow-100 text-yellow-800'
    };
    return colors[fuelType] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status) => {
    const colors = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Histórico de Abastecimentos</h1>
          <p className="text-gray-600">Acompanhe todos os abastecimentos da sua frota</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Transações</p>
                <p className="text-2xl font-bold text-gray-900">{filteredTransactions.length}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-50">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Gasto</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
              </div>
              <div className="p-3 rounded-full bg-green-50">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Litros</p>
                <p className="text-2xl font-bold text-gray-900">{totalLiters.toFixed(1)}L</p>
                <p className="text-xs text-gray-500">Média: {formatCurrency(avgPricePerLiter)}/L</p>
              </div>
              <div className="p-3 rounded-full bg-orange-50">
                <Fuel className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por placa ou posto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="lg:w-48">
              <Select value={filterVehicle} onValueChange={setFilterVehicle}>
                <SelectTrigger>
                  <Car className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Todos os veículos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os veículos</SelectItem>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.license_plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="lg:w-48">
              <Select value={filterFuel} onValueChange={setFilterFuel}>
                <SelectTrigger>
                  <Fuel className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Todos combustíveis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os combustíveis</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="gasoline">Gasolina</SelectItem>
                  <SelectItem value="ethanol">Etanol</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="lg:w-60 justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                        {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                    )
                  ) : (
                    "Selecionar período"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            <Button variant="outline" onClick={clearFilters}>
              <Filter className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredTransactions.length > 0 ? (
        <div className="space-y-4">
          {filteredTransactions.map((transaction) => (
            <Card key={transaction.id} className="hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Fuel className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{transaction.license_plate}</h3>
                        <Badge className={getFuelTypeColor(transaction.fuel_type)}>
                          {FUEL_NAMES[transaction.fuel_type] || transaction.fuel_type}
                        </Badge>
                        <Badge className={getStatusColor(transaction.status)}>
                          {transaction.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{transaction.station_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" />
                          <span>{formatDate(transaction.transaction_date)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {formatCurrency(transaction.total_amount)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {transaction.liters.toFixed(1)}L × {formatCurrency(transaction.price_per_liter)}/L
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Fuel className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || filterVehicle !== 'all' || filterFuel !== 'all' || dateRange.from || dateRange.to
                ? 'Nenhuma transação encontrada'
                : 'Nenhuma transação registrada'
              }
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || filterVehicle !== 'all' || filterFuel !== 'all' || dateRange.from || dateRange.to
                ? 'Tente ajustar os filtros de pesquisa'
                : 'As transações de abastecimento aparecerão aqui'
              }
            </p>
            {(searchTerm || filterVehicle !== 'all' || filterFuel !== 'all' || dateRange.from || dateRange.to) && (
              <Button onClick={clearFilters} variant="outline">
                Limpar Filtros
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Transactions;