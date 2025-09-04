import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Loader2, Fuel, Building, Shield, Mail, MessageCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Login = () => {
  const [cnpj, setCnpj] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('login'); // 'login', '2fa-method', '2fa-verify'
  const [selectedMethod, setSelectedMethod] = useState('');
  const [availableMethods, setAvailableMethods] = useState([]);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const formatCNPJ = (value) => {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length <= 14) {
      return cleanValue.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        '$1.$2.$3/$4-$5'
      );
    }
    return value;
  };

  const handleCNPJChange = (e) => {
    const formatted = formatCNPJ(e.target.value);
    setCnpj(formatted);
  };

  const handleInitialLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const cleanCnpj = cnpj.replace(/\D/g, '');
      const response = await axios.post(`${API}/auth/login`, {
        cnpj: cleanCnpj,
        password
      });

      // Check if 2FA is required
      if (response.data.requires_2fa) {
        setAvailableMethods(response.data.available_methods || ['email']);
        setStep('2fa-method');
        toast.info('Autenticação de dois fatores necessária');
      } else {
        // Direct login successful
        const { access_token, client } = response.data;
        login(access_token, client);
        toast.success('Login realizado com sucesso!');
        navigate('/dashboard');
      }
    } catch (err) {
      const message = err.response?.data?.detail || 'Erro ao fazer login. Verifique suas credenciais.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest2FA = async (method) => {
    setLoading(true);
    setError('');

    try {
      const cleanCnpj = cnpj.replace(/\D/g, '');
      const response = await axios.post(`${API}/auth/request-2fa`, {
        cnpj: cleanCnpj,
        password,
        method
      });

      setSelectedMethod(method);
      setStep('2fa-verify');
      toast.success(`Código enviado via ${method === 'email' ? 'email' : 'WhatsApp'}!`);
    } catch (err) {
      const message = err.response?.data?.detail || `Erro ao enviar código via ${method}`;
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const cleanCnpj = cnpj.replace(/\D/g, '');
      const response = await axios.post(`${API}/auth/verify-2fa`, {
        cnpj: cleanCnpj,
        code: verificationCode
      });

      const { access_token, client } = response.data;
      login(access_token, client);
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard');
    } catch (err) {
      const message = err.response?.data?.detail || 'Código inválido ou expirado';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestData = async () => {
    try {
      await axios.post(`${API}/create-test-data`);
      toast.success('Dados de teste criados! Use CNPJ: 12.345.678/9012-34 e senha: 123456');
      setCnpj('12.345.678/9012-34');
      setPassword('123456');
    } catch (err) {
      toast.error('Erro ao criar dados de teste');
    }
  };

  const resetLogin = () => {
    setStep('login');
    setError('');
    setVerificationCode('');
    setSelectedMethod('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
            <Fuel className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Portal do Cliente</h2>
            <p className="text-gray-600 mt-2">Rede de Postos de Combustível</p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-0">
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-xl font-semibold text-center">
              {step === 'login' && 'Acesse sua conta'}
              {step === '2fa-method' && 'Verificação de Segurança'}
              {step === '2fa-verify' && 'Digite o Código'}
            </CardTitle>
            <CardDescription className="text-center">
              {step === 'login' && 'Digite seu CNPJ e senha para acessar o portal'}
              {step === '2fa-method' && 'Escolha como deseja receber o código de verificação'}
              {step === '2fa-verify' && `Código enviado via ${selectedMethod === 'email' ? 'email' : 'WhatsApp'}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step 1: Initial Login */}
            {step === 'login' && (
              <form onSubmit={handleInitialLogin} className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="cnpj" className="flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    CNPJ
                  </Label>
                  <Input
                    id="cnpj"
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={cnpj}
                    onChange={handleCNPJChange}
                    maxLength="18"
                    className="h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Senha
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 transition-all duration-200 shadow-lg"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {loading ? 'Verificando...' : 'Continuar'}
                </Button>
              </form>
            )}

            {/* Step 2: Choose 2FA Method */}
            {step === '2fa-method' && (
              <div className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  {availableMethods.includes('email') && (
                    <Button
                      onClick={() => handleRequest2FA('email')}
                      disabled={loading}
                      className="w-full h-14 flex items-center justify-center gap-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                    >
                      {loading && selectedMethod === 'email' ? 
                        <Loader2 className="w-5 h-5 animate-spin" /> : 
                        <Mail className="w-5 h-5" />
                      }
                      <div className="text-left">
                        <div className="font-medium">Receber por Email</div>
                        <div className="text-xs opacity-90">Código será enviado para seu email</div>
                      </div>
                    </Button>
                  )}

                  {availableMethods.includes('whatsapp') && (
                    <Button
                      onClick={() => handleRequest2FA('whatsapp')}
                      disabled={loading}
                      className="w-full h-14 flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                    >
                      {loading && selectedMethod === 'whatsapp' ? 
                        <Loader2 className="w-5 h-5 animate-spin" /> : 
                        <MessageCircle className="w-5 h-5" />
                      }
                      <div className="text-left">
                        <div className="font-medium">Receber por WhatsApp</div>
                        <div className="text-xs opacity-90">Código será enviado para seu WhatsApp</div>
                      </div>
                    </Button>
                  )}
                </div>

                <Button
                  onClick={resetLogin}
                  variant="outline"
                  className="w-full flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </Button>
              </div>
            )}

            {/* Step 3: Verify Code */}
            {step === '2fa-verify' && (
              <form onSubmit={handleVerify2FA} className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {selectedMethod === 'email' ? <Mail className="w-5 h-5 text-blue-600" /> : <MessageCircle className="w-5 h-5 text-green-600" />}
                    <span className="font-medium">Código enviado!</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Verifique seu {selectedMethod === 'email' ? 'email' : 'WhatsApp'} e digite o código de 6 dígitos
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code" className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Código de Verificação
                  </Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="h-11 text-center text-2xl tracking-widest"
                    maxLength="6"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('2fa-method')}
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Voltar
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || verificationCode.length !== 6}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {loading ? 'Verificando...' : 'Entrar'}
                  </Button>
                </div>
              </form>
            )}

            {/* Test Data Button (Development only) */}
            {step === 'login' && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleTestData}
                >
                  Criar Dados de Teste
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <div className="text-center space-y-4">
          <div className="grid grid-cols-1 gap-3 text-sm text-gray-600">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Controle de frota em tempo real</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Gestão de limites de abastecimento</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Relatórios e histórico completo</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>Autenticação segura com 2FA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;