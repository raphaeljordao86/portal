import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../App';
import { 
  Home, 
  Car, 
  AlertCircle, 
  Receipt, 
  CreditCard, 
  LogOut, 
  Fuel,
  X,
  Building,
  BarChart3,
  Settings as SettingsIcon
} from 'lucide-react';
import { Button } from './ui/button';
import { Separator } from './ui/separator';

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const { user, logout } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Veículos', href: '/vehicles', icon: Car },
    { name: 'Limites', href: '/limits', icon: AlertCircle },
    { name: 'Abastecimentos', href: '/transactions', icon: Fuel },
    { name: 'Faturas', href: '/invoices', icon: CreditCard },
    { name: 'Configurações', href: '/settings', icon: SettingsIcon },
  ];

  const handleLogout = () => {
    logout();
    setSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden bg-black bg-opacity-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl border-r border-gray-200
        transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex flex-col items-center space-y-2 w-full">
              <img 
                src="https://customer-assets.emergentagent.com/job_fuelcontrol-dash/artifacts/1q79ov19_logo%20montecarlo.PNG" 
                alt="Monte Carlo"
                className="w-20 h-16 object-contain"
              />
              <div className="text-center">
                <p className="text-xs text-gray-500">Portal do Cliente</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden absolute top-4 right-4"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* User Info */}
          <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center">
                <Building className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.company_name}
                </p>
                <p className="text-xs text-gray-500">
                  CNPJ: {user?.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <Separator className="mb-4" />
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;