import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { X, AlertTriangle, CreditCard } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CreditAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [creditStatus, setCreditStatus] = useState(null);

  useEffect(() => {
    fetchAlerts();
    fetchCreditStatus();
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await axios.get(`${API}/credit-alerts`);
      setAlerts(response.data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
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

  const dismissAlert = async (alertId) => {
    try {
      await axios.post(`${API}/credit-alerts/${alertId}/dismiss`);
      setAlerts(alerts.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getAlertConfig = (percentage) => {
    if (percentage >= 100) {
      return {
        variant: "destructive",
        bgColor: "bg-red-50 border-red-200",
        iconColor: "text-red-600",
        title: "🚨 LIMITE DE CRÉDITO EXCEDIDO!",
        description: "Seu limite foi ultrapassado. Entre em contato conosco imediatamente."
      };
    } else if (percentage >= 90) {
      return {
        variant: "destructive",
        bgColor: "bg-red-50 border-red-200",
        iconColor: "text-red-600",
        title: "⚠️ ALERTA CRÍTICO - 90% do limite atingido",
        description: "Você está muito próximo do seu limite de crédito."
      };
    } else if (percentage >= 80) {
      return {
        variant: "default",
        bgColor: "bg-orange-50 border-orange-200",
        iconColor: "text-orange-600",
        title: "⚠️ ATENÇÃO - 80% do limite atingido",
        description: "Monitore seus gastos para evitar exceder o limite."
      };
    } else {
      return {
        variant: "default",
        bgColor: "bg-yellow-50 border-yellow-200",
        iconColor: "text-yellow-600",
        title: "ℹ️ AVISO - 70% do limite atingido",
        description: "Você atingiu 70% do seu limite de crédito."
      };
    }
  };

  // Show current status alert if usage is high
  const showCurrentStatusAlert = creditStatus && creditStatus.usage_percentage >= 70;

  return (
    <div className="space-y-3">
      {/* Current Status Alert */}
      {showCurrentStatusAlert && (
        <Alert className={`${getAlertConfig(creditStatus.usage_percentage).bgColor} border-l-4`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <CreditCard className={`w-5 h-5 mt-0.5 ${getAlertConfig(creditStatus.usage_percentage).iconColor}`} />
              <div className="flex-1">
                <h4 className="font-semibold text-sm">
                  {getAlertConfig(creditStatus.usage_percentage).title}
                </h4>
                <AlertDescription className="mt-1 text-sm">
                  {getAlertConfig(creditStatus.usage_percentage).description}
                  <div className="mt-2 flex items-center gap-4 text-xs">
                    <span>💰 Limite: {formatCurrency(creditStatus.credit_limit)}</span>
                    <span>📊 Usado: {formatCurrency(creditStatus.current_usage)} ({creditStatus.usage_percentage.toFixed(1)}%)</span>
                    <span>💳 Disponível: {formatCurrency(creditStatus.available_credit)}</span>
                  </div>
                </AlertDescription>
              </div>
            </div>
          </div>
        </Alert>
      )}

      {/* Historical Alerts */}
      {alerts.map((alert) => {
        const config = getAlertConfig(alert.percentage);
        return (
          <Alert key={alert.id} className={`${config.bgColor} border-l-4`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <AlertTriangle className={`w-5 h-5 mt-0.5 ${config.iconColor}`} />
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">
                    Alerta de {alert.alert_type}% do limite de crédito
                  </h4>
                  <AlertDescription className="mt-1 text-sm">
                    Registrado em {new Date(alert.created_at).toLocaleString('pt-BR')}
                    <div className="mt-1 text-xs opacity-75">
                      Utilização: {formatCurrency(alert.current_usage)} de {formatCurrency(alert.credit_limit)}
                    </div>
                  </AlertDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissAlert(alert.id)}
                className="h-6 w-6 p-0 hover:bg-white/50"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </Alert>
        );
      })}
    </div>
  );
};

export default CreditAlerts;