import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { createActivity } from '../utils/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import AuthGuard from '../components/AuthGuard';

const NewActivity: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) {
      setError('Missing event ID');
      return;
    }

    try {
      setSubmitting(true);
      await createActivity({
        name,
        description,
        location,
        eventId,
      });
      navigate(`/events/${eventId}`);
    } catch (err: any) {
      console.error(err);
      setError('Failed to create activity');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthGuard>
      <Card className="max-w-xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>Create New Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-500 mb-4">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
              />
            </div>
            <div className="flex justify-between mt-6">
              <Link to={`/events/${eventId}`}>
                <Button type="button" variant="ghost">Cancel</Button>
              </Link>
              <Button type="submit" isLoading={submitting}>Create Activity</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthGuard>
  );
};

export default NewActivity;
