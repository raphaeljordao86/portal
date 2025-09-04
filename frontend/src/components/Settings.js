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
  Settings as SettingsIcon, 
  Mail, 
  MessageCircle, 
  Bell,
  Shield,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Star,
  StarOff
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Settings = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  
  const [newContact, setNewContact] = useState({
    type: 'email',
    value: '',
    label: '',
    is_primary: false
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`);
      setContacts(response.data.contacts || []);
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
        contacts: contacts
      });
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar configurações');
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddContact = async () => {
    if (!newContact.value.trim()) {
      toast.error('Por favor, preencha o campo de contato');
      return;
    }

    try {
      const response = await axios.post(`${API}/contacts`, newContact);
      setContacts([...contacts, response.data.contact]);
      setShowAddContact(false);
      setNewContact({
        type: 'email',
        value: '',
        label: '',
        is_primary: false
      });
      toast.success('Contato adicionado com sucesso!');
    } catch (error) {
      toast.error('Erro ao adicionar contato');
      console.error('Error adding contact:', error);
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!window.confirm('Tem certeza que deseja excluir este contato?')) {
      return;
    }

    try {
      await axios.delete(`${API}/contacts/${contactId}`);
      setContacts(contacts.filter(c => c.id !== contactId));
      toast.success('Contato excluído com sucesso!');
    } catch (error) {
      toast.error('Erro ao excluir contato');
      console.error('Error deleting contact:', error);
    }
  };

  const handleSetPrimary = async (contactId) => {
    try {
      await axios.put(`${API}/contacts/${contactId}/primary`);
      // Update local state
      const updatedContacts = contacts.map(contact => {
        if (contact.id === contactId) {
          return { ...contact, is_primary: true };
        } else if (contact.type === contacts.find(c => c.id === contactId)?.type) {
          return { ...contact, is_primary: false };
        }
        return contact;
      });
      setContacts(updatedContacts);
      toast.success('Contato principal atualizado!');
    } catch (error) {
      toast.error('Erro ao definir contato principal');
      console.error('Error setting primary contact:', error);
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
    setNewContact({...newContact, value: formatted});
  };

  const emailContacts = contacts.filter(c => c.type === 'email');
  const whatsappContacts = contacts.filter(c => c.type === 'whatsapp');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600">Gerencie seus contatos e preferências de notificação</p>
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
          {/* Email Contacts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                Emails para Notificações
              </CardTitle>
              <CardDescription>
                Configure emails para receber alertas e notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {emailContacts.length > 0 ? (
                <div className="space-y-3">
                  {emailContacts.map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-blue-600" />
                        <div>
                          <p className="font-medium">{contact.value}</p>
                          {contact.label && <p className="text-xs text-gray-500">{contact.label}</p>}
                        </div>
                        {contact.is_primary && (
                          <Badge variant="default" className="bg-blue-100 text-blue-800">
                            <Star className="w-3 h-3 mr-1" />
                            Principal
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!contact.is_primary && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetPrimary(contact.id)}
                            title="Definir como principal"
                          >
                            <StarOff className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteContact(contact.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Nenhum email configurado</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* WhatsApp Contacts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                WhatsApp para Notificações
              </CardTitle>
              <CardDescription>
                Configure números do WhatsApp para receber alertas instantâneos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {whatsappContacts.length > 0 ? (
                <div className="space-y-3">
                  {whatsappContacts.map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <MessageCircle className="w-4 h-4 text-green-600" />
                        <div>
                          <p className="font-medium">{contact.value}</p>
                          {contact.label && <p className="text-xs text-gray-500">{contact.label}</p>}
                        </div>
                        {contact.is_primary && (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <Star className="w-3 h-3 mr-1" />
                            Principal
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!contact.is_primary && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetPrimary(contact.id)}
                            title="Definir como principal"
                          >
                            <StarOff className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteContact(contact.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Nenhum WhatsApp configurado</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Contact Button */}
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Adicionar Novo Contato</p>
                  <p className="text-sm text-gray-500">
                    Configure emails e números do WhatsApp para receber notificações
                  </p>
                </div>
                <Button
                  onClick={() => setShowAddContact(true)}
                  className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Contato
                </Button>
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
        </div>
      )}

      {/* Add Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Contato</DialogTitle>
            <DialogDescription>
              Configure um novo email ou WhatsApp para receber notificações
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact_type">Tipo de Contato</Label>
              <Select 
                value={newContact.type} 
                onValueChange={(value) => setNewContact({...newContact, type: value, value: ''})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_value">
                {newContact.type === 'email' ? 'Endereço de Email' : 'Número do WhatsApp'}
              </Label>
              <Input
                id="contact_value"
                type={newContact.type === 'email' ? 'email' : 'text'}
                placeholder={newContact.type === 'email' ? 'exemplo@email.com' : '(34) 99999-9999'}
                value={newContact.value}
                onChange={newContact.type === 'email' ? 
                  (e) => setNewContact({...newContact, value: e.target.value}) : 
                  handleWhatsAppChange
                }
                maxLength={newContact.type === 'email' ? undefined : 15}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_label">Rótulo (Opcional)</Label>
              <Input
                id="contact_label"
                placeholder="Ex: Pessoal, Comercial, Financeiro"
                value={newContact.label}
                onChange={(e) => setNewContact({...newContact, label: e.target.value})}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowAddContact(false)} 
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleAddContact}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
              >
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;