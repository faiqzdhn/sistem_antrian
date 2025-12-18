import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import logo from '../assets/logo.png';

function Admin() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentCalled, setCurrentCalled] = useState(0);
  const [allTickets, setAllTickets] = useState([]);
  const [totalWaiting, setTotalWaiting] = useState(0);
  const [nextTicketNumber, setNextTicketNumber] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      // Listen to current called number
      const queueRef = doc(db, 'system', 'queueState');
      const unsubscribe = onSnapshot(queueRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCurrentCalled(data.currentCalled || 0);
        } else {
          setCurrentCalled(0);
        }
      });

      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      // Listen to all tickets
      const ticketsRef = collection(db, 'tickets');
      const q = query(ticketsRef, orderBy('ticketNumber', 'asc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const tickets = [];
        snapshot.forEach((doc) => {
          tickets.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setAllTickets(tickets);
        
        // Calculate waiting count and next ticket
        const waiting = tickets.filter(t => t.status === 'waiting');
        setTotalWaiting(waiting.length);
        
        if (waiting.length > 0) {
          setNextTicketNumber(waiting[0].ticketNumber);
        } else {
          setNextTicketNumber(null);
        }
      });

      return () => unsubscribe();
    }
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login error:', error);
      alert('Login gagal: ' + error.message);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      const functions = getFunctions();
      const callNext = httpsCallable(functions, 'callNext');
      const result = await callNext();

      if (result.data.success) {
        // Success - realtime listener akan update UI
      } else {
        alert(result.data.message || 'Tidak ada antrian');
      }
    } catch (error) {
      console.error('Error calling next:', error);
      alert('Gagal memanggil nomor berikutnya: ' + error.message);
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!confirm('Apakah Anda yakin ingin mereset antrian harian? Semua tiket akan dihapus.')) {
      return;
    }

    setLoading(true);
    try {
      const functions = getFunctions();
      const resetQueue = httpsCallable(functions, 'resetQueue');
      const result = await resetQueue();

      if (result.data.success) {
        alert(result.data.message);
      }
    } catch (error) {
      console.error('Error resetting queue:', error);
      alert('Gagal mereset antrian: ' + error.message);
    }
    setLoading(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 border border-slate-200">
          <div className="text-center mb-8">
            <div className="mb-6">
              <img src={logo} alt="ANTRIANKU" className="w-48 h-auto mx-auto" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              Admin Login
            </h1>
            <p className="text-slate-600">Masuk ke dashboard</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2E5C8A] hover:bg-[#1B3A52] text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6 mb-4 md:mb-6 border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 md:p-3 bg-[#2E5C8A] rounded-lg">
                <svg className="w-6 h-6 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-800">Dashboard Admin</h1>
                <p className="text-xs md:text-sm text-slate-600">Kelola sistem antrian</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg transition-colors border border-red-200 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Keluar
            </button>
          </div>
        </div>

        {/* Nomor Dipanggil - Highlight */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg shadow-lg p-6 md:p-8 mb-4 md:mb-6 text-center border-2 border-green-400">
          <p className="text-white/90 text-sm md:text-base font-medium mb-2">NOMOR SEDANG DIPANGGIL</p>
          <p className="text-white text-6xl md:text-8xl font-bold tracking-tight">
            {currentCalled > 0 ? `A${String(currentCalled).padStart(3, '0')}` : '-'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 md:mb-6">
          <div className="bg-white rounded-lg p-4 md:p-6 shadow-md border border-slate-200">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-3 md:p-4 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 md:w-8 md:h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs md:text-sm font-medium text-slate-500 mb-1">Total Menunggu</p>
                <p className="text-2xl md:text-3xl font-bold text-slate-800">{totalWaiting}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 md:p-6 shadow-md border border-slate-200">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-3 md:p-4 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 md:w-8 md:h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs md:text-sm font-medium text-slate-500 mb-1">Nomor Berikutnya</p>
                <p className="text-2xl md:text-3xl font-bold text-slate-800">
                  {nextTicketNumber ? `A${String(nextTicketNumber).padStart(3, '0')}` : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg p-4 md:p-6 shadow-md mb-4 md:mb-6 border border-slate-200">
          <h2 className="text-base md:text-lg font-bold text-slate-800 mb-4">
            Kontrol Antrian
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <button
              onClick={handleNext}
              disabled={loading || totalWaiting === 0}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 md:py-4 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <span className="text-sm md:text-base">Panggil Berikutnya</span>
            </button>
            <button
              onClick={handleReset}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-3 md:py-4 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-2 border-red-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm md:text-base">Reset Antrian</span>
            </button>
          </div>
        </div>

        {/* Queue List */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
          <div className="p-4 md:p-6 border-b border-slate-200 bg-slate-50">
            <h2 className="text-base md:text-lg font-bold text-slate-800">
              Daftar Antrian
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-slate-700">Nomor</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs md:text-sm font-semibold text-slate-700">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {allTickets.map((ticket) => (
                  <tr key={ticket.id} className={`hover:bg-slate-50 transition-colors ${ticket.status === 'called' ? 'bg-green-50' : ''}`}>
                    <td className="px-4 md:px-6 py-3">
                      <span className="text-base md:text-lg font-bold text-slate-800">
                        A{String(ticket.ticketNumber).padStart(3, '0')}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm font-semibold ${
                        ticket.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                        ticket.status === 'called' ? 'bg-green-100 text-green-800' :
                        ticket.status === 'missed' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          ticket.status === 'waiting' ? 'bg-yellow-500' :
                          ticket.status === 'called' ? 'bg-green-500' :
                          ticket.status === 'missed' ? 'bg-red-500' :
                          'bg-blue-500'
                        }`}></span>
                        {ticket.status === 'waiting' ? 'Menunggu' :
                         ticket.status === 'called' ? 'Dipanggil' :
                         ticket.status === 'missed' ? 'Terlewat' : 'Selesai'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-3 text-xs md:text-sm text-slate-600">
                      {ticket.createdAt?.toDate?.()?.toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit'
                      }) || '-'}
                    </td>
                  </tr>
                ))}
                {allTickets.length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-4 md:px-6 py-8 md:py-12 text-center">
                      <svg className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-slate-500 font-medium text-sm md:text-base">Tidak ada antrian</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Admin;
