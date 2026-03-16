import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { collection, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Plus, X } from 'lucide-react';

export default function CreateBet() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(['Yes', 'No']);
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      setOptions(newOptions);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!title.trim() || !description.trim() || !deadline) {
      setError('Please fill in all required fields.');
      return;
    }

    const validOptions = options.filter(opt => opt.trim() !== '');
    if (validOptions.length < 2) {
      setError('You must provide at least two valid options.');
      return;
    }

    setLoading(true);

    try {
      const newBet = {
        creatorId: auth.currentUser!.uid,
        creatorName: auth.currentUser!.displayName || 'Anonymous',
        title: title.trim(),
        description: description.trim(),
        options: validOptions,
        deadline: Timestamp.fromDate(new Date(deadline)),
        status: 'open',
        approvalStatus: 'pending',
        totalPool: 0,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'bets'), newBet);
      navigate(`/bet/${docRef.id}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'bets');
      setError('Failed to create bet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create a New Bet</CardTitle>
          <CardDescription>Set up a prediction market for a campus event.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Bet Title</label>
              <Input 
                placeholder="e.g., Will Professor Smith cancel Friday's lecture?" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Description / Rules</label>
              <textarea 
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                placeholder="Provide context or specific conditions for this bet to be resolved..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                required
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex justify-between items-center">
                <span>Options (Min 2, Max 10)</span>
                {options.length < 10 && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleAddOption} className="h-8 text-indigo-600">
                    <Plus className="w-4 h-4 mr-1" /> Add Option
                  </Button>
                )}
              </label>
              
              {options.map((option, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input 
                    placeholder={`Option ${index + 1}`}
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    required
                  />
                  {options.length > 2 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleRemoveOption(index)}
                      className="text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Betting Deadline</label>
              <Input 
                type="datetime-local" 
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                required
              />
              <p className="text-xs text-gray-500">After this time, no more wagers can be placed.</p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create Bet'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
