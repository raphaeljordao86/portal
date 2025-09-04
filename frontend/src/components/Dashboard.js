import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
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
  Calendar,
  MapPin
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
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
      title: 'Consumo do Mês',
      value: `${(stats?.month_total_liters || 0).toFixed(1)}L`,
      icon: Fuel,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Litros consumidos este mês'
    },
    {
      title: 'Gastos do Mês',
      value: formatCurrency(stats?.month_total_amount || 0),
      icon: DollarSign,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      description: 'Total gasto em combustível'
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
              Consumo por Combustível
            </CardTitle>
            <CardDescription>
              Distribuição do consumo no mês atual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.fuel_breakdown && Object.entries(stats.fuel_breakdown).map(([fuelType, data]) => (
                <div key={fuelType} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      fuelType === 'diesel' ? 'bg-blue-500' : 
                      fuelType === 'gasoline' ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                    <span className="font-medium capitalize">{fuelType}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{data.liters.toFixed(1)}L</p>
                    <p className="text-sm text-gray-500">{formatCurrency(data.amount)}</p>
                  </div>
                </div>
              ))}
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
              Últimas transações realizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.recent_transactions?.slice(0, 5).map((transaction, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Fuel className="w-4 h-4 text-blue-600" />
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
                  <p>Nenhum abastecimento recente</p>
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
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <Car className="w-6 h-6" />
              <span>Gerenciar Veículos</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <AlertTriangle className="w-6 h-6" />
              <span>Configurar Limites</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <BarChart3 className="w-6 h-6" />
              <span>Ver Relatórios</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2">
              <CreditCard className="w-6 h-6" />
              <span>Faturas Abertas</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;