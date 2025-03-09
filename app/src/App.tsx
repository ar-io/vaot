import { RouterProvider, createHashRouter } from 'react-router-dom';
import Layout from './components/pages/Layout';
import Home from './components/pages/Home';
import NotFound from './components/pages/NotFound';
import Dashboard from './components/pages/Dashboard';

function App() {
  const router = createHashRouter([
    {
      path: '/',
      element: <Layout />,
      errorElement: <NotFound />,
      children: [
        { index: true, element: <Home /> },
        { path: '/:id', element: <Dashboard /> },
      ],
    },
  ]);

  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

export default App;
