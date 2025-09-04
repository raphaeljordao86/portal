import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { 
  Settings as SettingsIcon, 
  Mail, 
  MessageCircle, 
  Bell,
  Shield,
  CreditCard,
  Save,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Settings = () => {
  const [settings, setSettings] = useState({
    notification_email: '',
    notification_whatsapp: '',
    email_notifications: true,
    whatsapp_notifications: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setSettings(response.data);
    } catch (error) {
      toast.error('Erro ao carregar configurações');
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, {
        notification_email: settings.notification_email,
        notification_whatsapp: settings.notification_whatsapp,
        email_notifications: settings.email_notifications,
        whatsapp_notifications: settings.whatsapp_notifications
      });
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar configurações');
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const formatWhatsApp = (value) => {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length <= 11) {
      return cleanValue.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    }
    return value;
  };

  const handleWhatsAppChange = (e) => {
    const formatted = formatWhatsApp(e.target.value);
    setSettings({...settings, notification_whatsapp: formatted});
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600">Gerencie suas preferências e notificações</p>
        </div>
        <Button onClick={fetchSettings} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Email Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                Notificações por Email
              </CardTitle>
              <CardDescription>
                Configure email para receber alertas e notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notification_email">Email para notificações</Label>
                <Input
                  id="notification_email"
                  type="email"
                  placeholder="seu-email@exemplo.com"
                  value={settings.notification_email || ''}
                  onChange={(e) => setSettings({...settings, notification_email: e.target.value})}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Receber notificações por email</Label>
                  <p className="text-sm text-gray-500">
                    Alertas de limite de crédito e transações
                  </p>
                </div>
                <Switch
                  checked={settings.email_notifications}
                  onCheckedChange={(checked) => setSettings({...settings, email_notifications: checked})}
                />
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                Notificações por WhatsApp
              </CardTitle>
              <CardDescription>
                Configure WhatsApp para receber alertas instantâneos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notification_whatsapp">Número do WhatsApp</Label>
                <Input
                  id="notification_whatsapp"
                  type="text"
                  placeholder="(11) 99999-9999"
                  value={settings.notification_whatsapp || ''}
                  onChange={handleWhatsAppChange}
                  maxLength="15"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Receber notificações por WhatsApp</Label>
                  <p className="text-sm text-gray-500">
                    Alertas instantâneos de limite de crédito
                  </p>
                </div>
                <Switch
                  checked={settings.whatsapp_notifications}
                  onCheckedChange={(checked) => setSettings({...settings, whatsapp_notifications: checked})}
                />
              </div>
            </CardContent>
          </Card>

          {/* Alert Settings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-600" />
                Configurações de Alertas
              </CardTitle>
              <CardDescription>
                Você receberá alertas quando atingir os seguintes percentuais do limite de crédito
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="bg-yellow-50 p-4 rounded-lg text-center">
                  <div className="w-8 h-8 bg-yellow-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-yellow-800 font-bold text-sm">70%</span>
                  </div>
                  <p className="text-sm font-medium text-yellow-800">Primeiro Alerta</p>
                  <p className="text-xs text-yellow-600">Monitoramento</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg text-center">
                  <div className="w-8 h-8 bg-orange-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-orange-800 font-bold text-sm">80%</span>
                  </div>
                  <p className="text-sm font-medium text-orange-800">Atenção</p>
                  <p className="text-xs text-orange-600">Cuidado com gastos</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <div className="w-8 h-8 bg-red-200 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-red-800 font-bold text-sm">90%</span>
                  </div>
                  <p className="text-sm font-medium text-red-800">Crítico</p>
                  <p className="text-xs text-red-600">Próximo do limite</p>
                </div>
                <div className="bg-red-100 border-2 border-red-200 p-4 rounded-lg text-center">
                  <div className="w-8 h-8 bg-red-300 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-red-900 font-bold text-sm">100%</span>
                  </div>
                  <p className="text-sm font-medium text-red-900">Limite Atingido</p>
                  <p className="text-xs text-red-700">Contate-nos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Salvar Configurações</p>
                  <p className="text-sm text-gray-500">
                    As alterações serão aplicadas imediatamente
                  </p>
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Settings;