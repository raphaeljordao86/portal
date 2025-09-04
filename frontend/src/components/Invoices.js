import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { 
  CreditCard, 
  Download, 
  Eye, 
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
  DollarSign,
  FileText,
  Filter,
  RefreshCw,
  Fuel,
  MapPin,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import CreditAlerts from './CreditAlerts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Tradução dos nomes dos combustíveis
const FUEL_NAMES = {
  diesel: 'Diesel S10',
  gasoline: 'Gasolina Comum',
  ethanol: 'Etanol'
};

const Invoices = () => {
  const [allInvoices, setAllInvoices] = useState([]);
  const [openInvoices, setOpenInvoices] = useState([]);
  const [creditStatus, setCreditStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('open');
  const [showDetails, setShowDetails] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchInvoices();
    fetchCreditStatus();
  }, []);

  const fetchInvoices = async () => {
    try {
      const [allInvoicesResponse, openInvoicesResponse] = await Promise.all([
        axios.get(`${API}/invoices`),
        axios.get(`${API}/invoices/open`)
      ]);
      setAllInvoices(allInvoicesResponse.data);
      setOpenInvoices(openInvoicesResponse.data);
    } catch (error) {
      toast.error('Erro ao carregar faturas');
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCreditStatus = async () => {
    try {
      const response = await axios.get(`${API}/credit-status`);
      setCreditStatus(response.data);
    } catch (error) {
      console.error('Error fetching credit status:', error);
    }
  };

  const fetchInvoiceDetails = async (invoiceId) => {
    setLoadingDetails(true);
    try {
      const response = await axios.get(`${API}/invoices/${invoiceId}/details`);
      setInvoiceDetails(response.data);
    } catch (error) {
      toast.error('Erro ao carregar detalhes da fatura');
      console.error('Error fetching invoice details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewDetails = async (invoice) => {
    setSelectedInvoice(invoice);
    setShowDetails(true);
    await fetchInvoiceDetails(invoice.id);
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
      year: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      open: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    const icons = {
      open: Clock,
      paid: CheckCircle,
      overdue: AlertCircle
    };
    const Icon = icons[status] || Clock;
    return <Icon className="w-4 h-4" />;
  };

  const getStatusLabel = (status) => {
    const labels = {
      open: 'Em Aberto',
      paid: 'Paga',
      overdue: 'Vencida'
    };
    return labels[status] || status;
  };

  const isOverdue = (dueDate) => {
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  };

  const getDaysUntilDue = (dueDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const totalOpenAmount = openInvoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);
  const overdueInvoices = openInvoices.filter(invoice => isOverdue(invoice.due_date));
  const totalOverdueAmount = overdueInvoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);

  const InvoiceCard = ({ invoice }) => {
    const daysUntilDue = getDaysUntilDue(invoice.due_date);
    const isInvoiceOverdue = isOverdue(invoice.due_date);
    
    return (
      <Card className={`hover:shadow-lg transition-shadow duration-200 ${
        isInvoiceOverdue ? 'border-red-200 bg-red-50/30' : ''
      }`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{invoice.invoice_number}</h3>
                <p className="text-sm text-gray-500">
                  Criada em {formatDate(invoice.created_at)}
                </p>
              </div>
            </div>
            <Badge className={getStatusColor(invoice.status)}>
              {getStatusIcon(invoice.status)}
              <span className="ml-1">{getStatusLabel(invoice.status)}</span>
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Valor Total</span>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(invoice.total_amount)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Vencimento</span>
              <span className={`text-sm font-medium ${
                isInvoiceOverdue ? 'text-red-600' : 
                daysUntilDue <= 7 ? 'text-yellow-600' : 'text-gray-900'
              }`}>
                {formatDate(invoice.due_date)}
                {invoice.status === 'open' && (
                  <span className="ml-2 text-xs">
                    {isInvoiceOverdue 
                      ? `(${Math.abs(daysUntilDue)} dias em atraso)`
                      : daysUntilDue === 0 
                        ? '(Vence hoje)' 
                        : `(${daysUntilDue} dias)`
                    }
                  </span>
                )}
              </span>
            </div>

            {invoice.transactions && invoice.transactions.length > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Transações</span>
                <span className="text-sm text-gray-900">
                  {invoice.transactions.length} abastecimentos
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => handleViewDetails(invoice)}
            >
              <Eye className="w-4 h-4 mr-1" />
              Detalhar
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Credit Alerts */}
      <CreditAlerts />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Faturas</h1>
          <p className="text-gray-600">Gerencie suas faturas e pagamentos</p>
        </div>
        <Button onClick={fetchInvoices} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* Credit Status Cards */}
      {creditStatus && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Limite de Crédito</p>
                  <p className="text-2xl font-bold text-blue-900">{formatCurrency(creditStatus.credit_limit)}</p>
                </div>
                <div className="p-3 rounded-full bg-blue-200">
                  <CreditCard className="w-6 h-6 text-blue-700" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${
            creditStatus.usage_percentage >= 90 ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-200' :
            creditStatus.usage_percentage >= 70 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200' :
            'bg-gradient-to-r from-green-50 to-green-100 border-green-200'
          }`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${
                    creditStatus.usage_percentage >= 90 ? 'text-red-700' :
                    creditStatus.usage_percentage >= 70 ? 'text-yellow-700' : 'text-green-700'
                  }`}>
                    Crédito Utilizado ({creditStatus.usage_percentage.toFixed(1)}%)
                  </p>
                  <p className={`text-2xl font-bold ${
                    creditStatus.usage_percentage >= 90 ? 'text-red-900' :
                    creditStatus.usage_percentage >= 70 ? 'text-yellow-900' : 'text-green-900'
                  }`}>
                    {formatCurrency(creditStatus.current_usage)}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${
                  creditStatus.usage_percentage >= 90 ? 'bg-red-200' :
                  creditStatus.usage_percentage >= 70 ? 'bg-yellow-200' : 'bg-green-200'
                }`}>
                  <DollarSign className={`w-6 h-6 ${
                    creditStatus.usage_percentage >= 90 ? 'text-red-700' :
                    creditStatus.usage_percentage >= 70 ? 'text-yellow-700' : 'text-green-700'
                  }`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Crédito Disponível</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(creditStatus.available_credit)}</p>
                </div>
                <div className="p-3 rounded-full bg-gray-200">
                  <CreditCard className="w-6 h-6 text-gray-700" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Faturas em Aberto</p>
                <p className="text-2xl font-bold text-gray-900">{openInvoices.length}</p>
                <p className="text-xs text-gray-500">Total: {formatCurrency(totalOpenAmount)}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-50">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Faturas Vencidas</p>
                <p className="text-2xl font-bold text-red-600">{overdueInvoices.length}</p>
                <p className="text-xs text-gray-500">Total: {formatCurrency(totalOverdueAmount)}</p>
              </div>
              <div className="p-3 rounded-full bg-red-50">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Faturas</p>
                <p className="text-2xl font-bold text-gray-900">{allInvoices.length}</p>
                <p className="text-xs text-gray-500">Todos os períodos</p>
              </div>
              <div className="p-3 rounded-full bg-green-50">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="open" className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Em Aberto ({openInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Todas ({allInvoices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="space-y-4">
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
          ) : openInvoices.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {openInvoices.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhuma fatura em aberto
                </h3>
                <p className="text-gray-500">
                  Parabéns! Você está em dia com todas as suas faturas.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
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
          ) : allInvoices.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allInvoices.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhuma fatura encontrada
                </h3>
                <p className="text-gray-500">
                  As faturas aparecerão aqui conforme forem geradas.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Invoice Details Modal */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {selectedInvoice?.invoice_number} - Detalhes da Fatura
            </DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="space-y-4 p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          ) : invoiceDetails ? (
            <div className="space-y-6">
              {/* Invoice Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumo da Fatura</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-gray-600">Número da Fatura</p>
                      <p className="font-semibold">{invoiceDetails.invoice.invoice_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Data de Criação</p>
                      <p className="font-semibold">{formatDate(invoiceDetails.invoice.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Data de Vencimento</p>
                      <p className="font-semibold">{formatDate(invoiceDetails.invoice.due_date)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <Badge className={getStatusColor(invoiceDetails.invoice.status)}>
                        {getStatusLabel(invoiceDetails.invoice.status)}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total de Transações</p>
                      <p className="font-semibold">{invoiceDetails.transaction_count} abastecimentos</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total de Litros</p>
                      <p className="font-semibold">{invoiceDetails.total_liters.toFixed(1)}L</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">Valor Total:</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {formatCurrency(invoiceDetails.invoice.total_amount)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Transactions List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cupons de Abastecimento ({invoiceDetails.transactions.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {invoiceDetails.transactions.map((transaction, index) => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Fuel className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900">{transaction.license_plate}</h4>
                              <Badge variant="outline" className="text-xs">
                                {transaction.fuel_type}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                <span>{transaction.station_name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{formatDateTime(transaction.transaction_date)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">
                            {formatCurrency(transaction.total_amount)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {transaction.liters.toFixed(1)}L × {formatCurrency(transaction.price_per_liter)}/L
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-500">Erro ao carregar detalhes da fatura</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Invoices;