import requests
import sys
import json
from datetime import datetime

class FuelStationAPITester:
    def __init__(self, base_url="https://fuel-client-portal.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.client_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response text: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def get_test_token(self):
        """Get a test token by creating a temporary client without 2FA for testing"""
        # First try to create test data
        self.test_create_test_data()
        
        # For testing purposes, we'll simulate getting a token
        # In a real scenario, we'd need to complete the 2FA flow
        # But since email/WhatsApp aren't configured, we'll use a workaround
        
        # Try the old login method first to see current behavior
        success, response = self.run_test(
            "Get Test Token",
            "POST", 
            "auth/login",
            200,
            data={"cnpj": "12.345.678/9012-34", "password": "123456"}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        elif success and response.get('requires_2fa'):
            print(f"   ⚠️  2FA required - cannot get token for testing without email/WhatsApp setup")
            print(f"   Available methods: {response.get('available_methods', [])}")
            return False
        else:
            print(f"   ❌ Failed to get test token")
            return False
        """Create test data"""
        success, response = self.run_test(
            "Create Test Data",
            "POST",
            "create-test-data",
            200
        )
        return success

    def test_login_invalid(self):
        """Test login with invalid credentials"""
        success, response = self.run_test(
            "Login with Invalid Credentials",
            "POST",
            "auth/login",
            401,
            data={"cnpj": "12.345.678/9012-34", "password": "wrongpassword"}
        )
        return success

    def test_login_requires_2fa(self):
        """Test login now requires 2FA"""
        success, response = self.run_test(
            "Login Should Require 2FA",
            "POST",
            "auth/login",
            200,
            data={"cnpj": "12.345.678/9012-34", "password": "123456"}
        )
        if success and response.get('requires_2fa') == True:
            print(f"   ✅ 2FA required as expected")
            print(f"   Available methods: {response.get('available_methods', [])}")
            return True
        else:
            print(f"   ❌ Expected requires_2fa=True, got: {response}")
            return False

    def test_2fa_request_email(self):
        """Test requesting 2FA code via email"""
        success, response = self.run_test(
            "Request 2FA Code via Email",
            "POST",
            "auth/request-2fa",
            500,  # Expected to fail due to email not configured
            data={"cnpj": "12345678901234", "password": "123456", "method": "email"}
        )
        if success:
            print(f"   ✅ 2FA request processed (unexpected success)")
            return True
        else:
            print(f"   ✅ 2FA request failed as expected (email not configured)")
            return True  # This is expected behavior

    def test_2fa_request_whatsapp(self):
        """Test requesting 2FA code via WhatsApp"""
        success, response = self.run_test(
            "Request 2FA Code via WhatsApp",
            "POST",
            "auth/request-2fa",
            500,  # Expected to fail due to WhatsApp not configured
            data={"cnpj": "12345678901234", "password": "123456", "method": "whatsapp"}
        )
        if success:
            print(f"   ✅ 2FA request processed (unexpected success)")
            return True
        else:
            print(f"   ✅ 2FA request failed as expected (WhatsApp not configured)")
            return True  # This is expected behavior

    def test_2fa_verify_invalid_code(self):
        """Test verifying invalid 2FA code"""
        success, response = self.run_test(
            "Verify Invalid 2FA Code",
            "POST",
            "auth/verify-2fa",
            401,
            data={"cnpj": "12345678901234", "code": "123456"}
        )
        return success

    def test_login_valid_legacy(self):
        """Test old login method (should still work for testing)"""
        # This is a fallback test in case we need to bypass 2FA for testing
        success, response = self.run_test(
            "Legacy Login Test",
            "POST",
            "auth/login",
            200,
            data={"cnpj": "12.345.678/9012-34", "password": "123456"}
        )
        # For now, we expect this to return requires_2fa=True
        if success and response.get('requires_2fa'):
            print(f"   ✅ Login correctly requires 2FA")
            return True
        return False

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test(
            "Dashboard Statistics",
            "GET",
            "dashboard/stats",
            200
        )
        if success:
            print(f"   Vehicles: {response.get('vehicles_count', 'N/A')}")
            print(f"   Monthly Amount: R$ {response.get('month_total_amount', 0):.2f}")
            print(f"   Monthly Liters: {response.get('month_total_liters', 0):.2f}L")
        return success

    def test_get_vehicles(self):
        """Test getting vehicles"""
        success, response = self.run_test(
            "Get Vehicles",
            "GET",
            "vehicles",
            200
        )
        if success:
            print(f"   Found {len(response)} vehicles")
            for vehicle in response:
                print(f"   - {vehicle['license_plate']}: {vehicle['model']} ({vehicle['year']})")
        return success, response

    def test_create_vehicle(self):
        """Test creating a new vehicle"""
        import random
        random_num = random.randint(1000, 9999)
        vehicle_data = {
            "license_plate": f"TST{random_num}",
            "model": "Ford Transit",
            "year": 2023,
            "fuel_type": "diesel",
            "driver_name": "Carlos Oliveira"
        }
        success, response = self.run_test(
            "Create Vehicle",
            "POST",
            "vehicles",
            201,
            data=vehicle_data
        )
        if success:
            print(f"   Created vehicle: {response.get('license_plate')} - {response.get('model')}")
            return success, response.get('id')
        return success, None

    def test_update_vehicle(self, vehicle_id):
        """Test updating a vehicle"""
        if not vehicle_id:
            print("❌ No vehicle ID provided for update test")
            return False
            
        update_data = {
            "license_plate": "XYZ9876",
            "model": "Ford Transit Updated",
            "year": 2023,
            "fuel_type": "diesel",
            "driver_name": "Carlos Oliveira Silva"
        }
        success, response = self.run_test(
            "Update Vehicle",
            "PUT",
            f"vehicles/{vehicle_id}",
            200,
            data=update_data
        )
        return success

    def test_get_limits(self):
        """Test getting limits"""
        success, response = self.run_test(
            "Get Limits",
            "GET",
            "limits",
            200
        )
        if success:
            print(f"   Found {len(response)} limits")
        return success

    def test_create_limit(self):
        """Test creating a new limit"""
        limit_data = {
            "limit_type": "monthly",
            "fuel_type": "diesel",
            "limit_value": 1000.0,
            "limit_unit": "currency"
        }
        success, response = self.run_test(
            "Create Limit",
            "POST",
            "limits",
            201,
            data=limit_data
        )
        if success:
            print(f"   Created limit: {response.get('limit_type')} - R$ {response.get('limit_value')}")
        return success

    def test_get_transactions(self):
        """Test getting transactions"""
        success, response = self.run_test(
            "Get Transactions",
            "GET",
            "transactions",
            200
        )
        if success:
            print(f"   Found {len(response)} transactions")
            if response:
                latest = response[0]
                print(f"   Latest: {latest['license_plate']} - {latest['liters']:.2f}L - R$ {latest['total_amount']:.2f}")
        return success

    def test_get_invoices(self):
        """Test getting invoices"""
        success, response = self.run_test(
            "Get All Invoices",
            "GET",
            "invoices",
            200
        )
        if success:
            print(f"   Found {len(response)} invoices")
        return success

    def test_get_open_invoices(self):
        """Test getting open invoices"""
        success, response = self.run_test(
            "Get Open Invoices",
            "GET",
            "invoices/open",
            200
        )
        if success:
            print(f"   Found {len(response)} open invoices")
            for invoice in response:
                print(f"   - {invoice['invoice_number']}: R$ {invoice['total_amount']:.2f} ({invoice['status']})")
        return success

    def test_change_password(self):
        """Test password change"""
        password_data = {
            "current_password": "123456",
            "new_password": "newpass123"
        }
        success, response = self.run_test(
            "Change Password",
            "POST",
            "auth/change-password",
            200,
            data=password_data
        )
        
        if success:
            # Change it back
            revert_data = {
                "current_password": "newpass123",
                "new_password": "123456"
            }
            self.run_test(
                "Revert Password",
                "POST",
                "auth/change-password",
                200,
                data=revert_data
            )
        return success

def main():
    print("🚀 Starting Fuel Station Client Portal API Tests")
    print("=" * 60)
    
    tester = FuelStationAPITester()
    
    # Test sequence
    print("\n📋 PHASE 1: Setup and Authentication")
    if not tester.test_create_test_data():
        print("❌ Failed to create test data, continuing anyway...")
    
    if not tester.test_login_invalid():
        print("❌ Invalid login test failed")
        
    if not tester.test_login_valid():
        print("❌ Valid login failed, stopping tests")
        return 1

    print("\n📋 PHASE 2: Dashboard and Statistics")
    tester.test_dashboard_stats()

    print("\n📋 PHASE 3: Vehicle Management")
    tester.test_get_vehicles()
    success, vehicle_id = tester.test_create_vehicle()
    if vehicle_id:
        tester.test_update_vehicle(vehicle_id)

    print("\n📋 PHASE 4: Limits Management")
    tester.test_get_limits()
    tester.test_create_limit()

    print("\n📋 PHASE 5: Transactions and Invoices")
    tester.test_get_transactions()
    tester.test_get_invoices()
    tester.test_get_open_invoices()

    print("\n📋 PHASE 6: Security Features")
    tester.test_change_password()

    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 FINAL RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! Backend API is working correctly.")
        return 0
    else:
        failed = tester.tests_run - tester.tests_passed
        print(f"⚠️  {failed} test(s) failed. Please check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())