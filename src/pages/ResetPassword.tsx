import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../utils/firebase';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';

const ResetPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent. Please check your inbox.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4">
      <h2 className="text-2xl font-bold mb-4">Reset Password</h2>
      <form onSubmit={handleReset} className="space-y-4 w-full max-w-sm">
        <Input
          id="reset-email"
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
        />
        <Button type="submit" fullWidth isLoading={loading}>
          Send Reset Email
        </Button>
      </form>
      {message && <p className="mt-4 text-center text-sm text-gray-600">{message}</p>}
    </div>
  );
};

export default ResetPassword;
