import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, AlertTriangle } from 'lucide-react';
import { registerUser } from '../utils/firebase';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await registerUser(
        formData.email,
        formData.password,
        formData.displayName
      );
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Registration error:', err);
      
      if (err.code === 'auth/email-already-in-use') {
        setError('Email is already in use');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError('Registration failed. Please try again.');
      }
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
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link to="/login" className="font-medium text-teal-600 hover:text-teal-500">
            sign in to your account
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
              id="displayName"
              name="displayName"
              label="Full Name"
              type="text"
              value={formData.displayName}
              onChange={handleChange}
              required
              fullWidth
            />
            
            <Input
              id="email"
              name="email"
              label="Email address"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
              fullWidth
            />

            <Input
              id="password"
              name="password"
              label="Password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              fullWidth
            />

            <Input
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              fullWidth
            />

            <div>
              <Button
                type="submit"
                fullWidth
                isLoading={loading}
              >
                Register
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;