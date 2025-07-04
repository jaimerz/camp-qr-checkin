import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, AlertTriangle } from 'lucide-react';
import { loginUser } from '../utils/firebase';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await loginUser(email, password);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Calendar className="h-12 w-12 text-teal-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to CampTrack
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link to="/register" className="font-medium text-teal-600 hover:text-teal-500">
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 p-4 rounded-md flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <Input
              id="email"
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              fullWidth
            />

            <Input
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              fullWidth
            />

            <p className="mt-2 text-sm text-center">
              <Link to="/reset-password" className="font-medium text-teal-600 hover:text-teal-500">
                Forgot your password?
              </Link>
            </p>

            <div>
              <Button
                type="submit"
                fullWidth
                isLoading={loading}
              >
                Sign in
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;