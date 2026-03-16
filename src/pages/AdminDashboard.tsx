import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function AdminDashboard() {
  const [bets, setBets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    const q = query(collection(db, 'bets'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const betsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBets(betsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bets');
    });

    return () => unsubscribe();
  }, []);

  const handleStatusUpdate = async (betId: string, newStatus: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'bets', betId), {
        approvalStatus: newStatus
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bets/${betId}`);
    }
  };

  const filteredBets = bets.filter(bet => {
    const status = bet.approvalStatus || 'pending';
    return status === activeTab;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      </div>

      <div className="flex space-x-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
            activeTab === 'pending'
              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          Pending Approval ({bets.filter(b => (b.approvalStatus || 'pending') === 'pending').length})
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
            activeTab === 'approved'
              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          Approved / Active ({bets.filter(b => (b.approvalStatus || 'pending') === 'approved').length})
        </button>
        <button
          onClick={() => setActiveTab('rejected')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
            activeTab === 'rejected'
              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          Rejected ({bets.filter(b => (b.approvalStatus || 'pending') === 'rejected').length})
        </button>
      </div>

      {filteredBets.length === 0 ? (
        <Card className="bg-gray-50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center h-48 text-gray-500">
            <AlertCircle className="w-8 h-8 mb-2 text-gray-400" />
            <p>No bets found in this category.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredBets.map((bet) => (
            <Card key={bet.id} className="overflow-hidden">
              <CardHeader className="bg-gray-50 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{bet.title}</CardTitle>
                    <CardDescription className="mt-1">
                      Created by <span className="font-medium text-gray-900">{bet.creatorName}</span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {bet.status === 'resolved' ? (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-green-100 text-green-800 hover:bg-green-100">
                        Resolved: {bet.winningOption}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                        bet.status === 'open' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {bet.status.toUpperCase()}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      Pool: {bet.totalPool} pts
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-gray-600 mb-4">{bet.description}</p>
                
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Options</h4>
                  <div className="flex flex-wrap gap-2">
                    {bet.options.map((opt: string, i: number) => (
                      <span key={i} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-gray-100 text-gray-900">
                        {opt}
                      </span>
                    ))}
                  </div>
                </div>

                {activeTab === 'pending' && (
                  <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                    <Button 
                      onClick={() => handleStatusUpdate(bet.id, 'approved')}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve Bet
                    </Button>
                    <Button 
                      onClick={() => handleStatusUpdate(bet.id, 'rejected')}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject Bet
                    </Button>
                  </div>
                )}

                {activeTab === 'approved' && (
                  <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                    <Button 
                      onClick={() => handleStatusUpdate(bet.id, 'rejected')}
                      variant="outline"
                      className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Revoke Approval
                    </Button>
                  </div>
                )}
                
                {activeTab === 'rejected' && (
                  <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                    <Button 
                      onClick={() => handleStatusUpdate(bet.id, 'approved')}
                      variant="outline"
                      className="w-full text-green-600 hover:bg-green-50 hover:text-green-700 border-green-200"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Re-Approve Bet
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
