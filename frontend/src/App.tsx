import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Home from './pages/Home';
import GoalDetail from './pages/GoalDetail';
import AuthCallback from './pages/AuthCallback';
import Profile from './pages/Profile';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/goal/:id" element={<GoalDetail />} />
              <Route path="/auth-callback" element={<AuthCallback />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
