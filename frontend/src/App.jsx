import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import CustomerManagementPage from './pages/CustomerManagementPage';
import HomePage from './pages/HomePage';
import ConfigureServerPage from './pages/ConfigureServerPage';
const PlaceholderPage = ({ title }) => <h2>{title} - Coming Soon</h2>;

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'customers', element: <CustomerManagementPage /> },
      { path: 'configure', element: <ConfigureServerPage /> },
      { path: 'search-number', element: <PlaceholderPage title="Number Information" /> },
      { path: 'cleanup', element: <PlaceholderPage title="Gateway Cleanup" /> },
      { path: 'virtual-number', element: <PlaceholderPage title="Virtual Number" /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export const getMappingGatewayDetails = async (serverName, mgName) => {
  try {
    const response = await apiClient.get(`/servers/${serverName}/mapping-gateways/${mgName}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching MG details:', error);
    throw error;
  }
};

export const getRoutingGatewayDetails = async (serverName, rgName) => {
  try {
    const response = await apiClient.get(`/servers/${serverName}/routing-gateways/${rgName}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching RG details:', error);
    throw error;
  }
};
export default App;

