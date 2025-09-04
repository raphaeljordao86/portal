import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { 
  Car, 
  Fuel, 
  CreditCard, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Activity,
  BarChart3,
  PieChart,
  Calendar as CalendarIcon,
  MapPin,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import { toast } from 'sonner';
import CreditAlerts from './CreditAlerts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Cores oficiais ANP para combustíveis
const FUEL_COLORS = {
  diesel: '#1E40AF',      // Azul (ANP)
  gasoline: '#16A34A',    // Verde (ANP)  
  ethanol: '#F59E0B'      // Amarelo/Laranja (ANP)
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardStats();
  }, [period, customStartDate, customEndDate]);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const filterData = {
        period: period,
        start_date: period === 'custom' ? customStartDate?.toISOString() : null,
        end_date: period === 'custom' ? customEndDate?.toISOString() : null
      };

      const response = await axios.post(`${API}/dashboard/stats`, filterData);
      setStats(response.data);
    } catch (error) {
      toast.error('Erro ao carregar dados do dashboard');
      console.error('Error fetching dashboard stats:', error);
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

  const getPeriodLabel = () => {
    switch(period) {
      case 'daily': return 'Hoje';
      case 'weekly': return 'Esta Semana';
      case 'monthly': return 'Este Mês';
      case 'custom': return 'Período Personalizado';
      default: return 'Este Mês';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statsCards = [
    {
      title: 'Total de Veículos',
      value: stats?.vehicles_count || 0,
      icon: Car,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Veículos ativos na frota'
    },
    {
      title: `Consumo ${getPeriodLabel()}`,
      value: `${(stats?.period_total_liters || 0).toFixed(1)}L`,
      icon: Fuel,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: `Litros consumidos no período`
    },
    {
      title: `Gastos ${getPeriodLabel()}`,
      value: formatCurrency(stats?.period_total_amount || 0),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: `Total gasto no período`
    },
    {
      title: 'Faturas Abertas',
      value: formatCurrency(stats?.total_open_amount || 0),
      icon: CreditCard,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      description: `${stats?.open_invoices_count || 0} faturas pendentes`
    }
  ];

  return (
    <div className="space-y-6">
      {/* Credit Alerts */}
      <CreditAlerts />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Visão geral da sua frota de veículos</p>
        </div>
        <Button 
          onClick={fetchDashboardStats}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Activity className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-end">
        <div className="lg:w-48">
          <Label htmlFor="period">Período</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger>
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Hoje</SelectItem>
              <SelectItem value="weekly">Esta Semana</SelectItem>
              <SelectItem value="monthly">Este Mês</SelectItem>
              <SelectItem value="custom">Período Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {period === 'custom' && (
          <>
            <div className="lg:w-48">
              <Label>Data Inicial</Label>
              <Popover open={showStartCalendar} onOpenChange={setShowStartCalendar}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customStartDate ? format(customStartDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customStartDate}
                    onSelect={setCustomStartDate}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="lg:w-48">
              <Label>Data Final</Label>
              <Popover open={showEndCalendar} onOpenChange={setShowEndCalendar}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customEndDate ? format(customEndDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customEndDate}
                    onSelect={setCustomEndDate}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </>
        )}

        {stats && (
          <div className="text-sm text-gray-600">
            <p>Período: {new Date(stats.start_date).toLocaleDateString('pt-BR')} - {new Date(stats.end_date).toLocaleDateString('pt-BR')}</p>
            <p>Total de transações: {stats.total_transactions}</p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts and Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Fuel Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Consumo por Combustível - {getPeriodLabel()}
            </CardTitle>
            <CardDescription>
              Distribuição do consumo no período selecionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.fuel_breakdown && Object.entries(stats.fuel_breakdown).map(([fuelType, data]) => (
                <div key={fuelType} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: FUEL_COLORS[fuelType] || '#6B7280' }}
                    />
                    <span className="font-medium capitalize">
                      {fuelType === 'diesel' ? 'Diesel' : 
                       fuelType === 'gasoline' ? 'Gasolina' : 
                       fuelType === 'ethanol' ? 'Etanol' : fuelType}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{data.liters.toFixed(1)}L</p>
                    <p className="text-sm text-gray-500">{formatCurrency(data.amount)}</p>
                  </div>
                </div>
              ))}
              {(!stats?.fuel_breakdown || Object.keys(stats.fuel_breakdown).length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  <PieChart className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Nenhum consumo no período</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Abastecimentos Recentes
            </CardTitle>
            <CardDescription>
              Últimas transações do período
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.recent_transactions?.slice(0, 5).map((transaction, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${FUEL_COLORS[transaction.fuel_type] || '#6B7280'}20` }}
                    >
                      <Fuel 
                        className="w-4 h-4" 
                        style={{ color: FUEL_COLORS[transaction.fuel_type] || '#6B7280' }}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{transaction.license_plate}</p>
                      <p className="text-xs text-gray-500">
                        {transaction.liters.toFixed(1)}L • {transaction.fuel_type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{formatCurrency(transaction.total_amount)}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(transaction.transaction_date)}
                    </p>
                  </div>
                </div>
              ))}
              {(!stats?.recent_transactions || stats.recent_transactions.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  <Fuel className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Nenhum abastecimento no período</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
          <CardDescription>
            Acesse as principais funcionalidades do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2 hover:bg-orange-50 hover:border-orange-200"
              onClick={() => navigate('/vehicles')}
            >
              <Car className="w-6 h-6 text-orange-600" />
              <span>Gerenciar Veículos</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2 hover:bg-yellow-50 hover:border-yellow-200"
              onClick={() => navigate('/limits')}
            >
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
              <span>Configurar Limites</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2 hover:bg-blue-50 hover:border-blue-200"
              onClick={() => navigate('/transactions')}
            >
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <span>Ver Relatórios</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2 hover:bg-red-50 hover:border-red-200"
              onClick={() => navigate('/invoices')}
            >
              <CreditCard className="w-6 h-6 text-red-600" />
              <span>Faturas Abertas</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;