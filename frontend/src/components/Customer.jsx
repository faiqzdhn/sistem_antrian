import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import logo from '../assets/logo.png';

function Customer() {
  const [ticketId, setTicketId] = useState(null);
  const [ticketNumber, setTicketNumber] = useState(null);
  const [status, setStatus] = useState('');
  const [position, setPosition] = useState(0);
  const [currentCalled, setCurrentCalled] = useState(0);
  const [loading, setLoading] = useState(false);

  // Clear ticket helper function
  const clearTicket = () => {
    localStorage.removeItem('ticketId');
    localStorage.removeItem('ticketNumber');
    setTicketId(null);
    setTicketNumber(null);
    setStatus('');
    setPosition(0);
  };

  useEffect(() => {
    // Cek localStorage untuk ticketId yang sudah ada saat pertama load
    const savedTicketId = localStorage.getItem('ticketId');
    const savedTicketNumber = localStorage.getItem('ticketNumber');
    
    if (savedTicketId && savedTicketNumber) {
      setTicketId(savedTicketId);
      setTicketNumber(parseInt(savedTicketNumber));
      setStatus('waiting'); // Set initial status
    }
  }, []);

  // REALTIME listener untuk ticket changes
  useEffect(() => {
    if (!ticketId) return;

    const ticketRef = doc(db, 'tickets', ticketId);
    const unsubscribe = onSnapshot(ticketRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setStatus(data.status);
        
        // Check if ticket is from previous day (auto-reset check)
        if (data.createdAt) {
          const ticketDate = data.createdAt.toDate();
          const today = new Date();
          
          // Compare dates only (ignore time)
          const ticketDay = new Date(ticketDate.getFullYear(), ticketDate.getMonth(), ticketDate.getDate());
          const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          
          if (ticketDay < currentDay) {
            // Ticket dari hari sebelumnya, clear otomatis
            clearTicket();
          }
        }
      } else {
        // Ticket dihapus (mungkin karena reset)
        clearTicket();
      }
    }, (error) => {
      console.error('Error listening to ticket:', error);
    });

    return () => unsubscribe();
  }, [ticketId]); // Re-run when ticketId changes

  useEffect(() => {
    // Listen to current called number changes
    const queueRef = doc(db, 'system', 'queueState');
    const unsubscribe = onSnapshot(queueRef, (doc) => {
      if (doc.exists()) {
        setCurrentCalled(doc.data().currentCalled || 0);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Calculate position
    if (ticketNumber && currentCalled >= 0) {
      if (status === 'done' || status === 'missed') {
        setPosition(0);
      } else if (currentCalled < ticketNumber) {
        // WAITING - hitung posisi
        const waitingPos = ticketNumber - currentCalled;
        setPosition(waitingPos);
      } else {
        setPosition(0);
      }
    }
  }, [currentCalled, ticketNumber, status]);

  const getTicket = async () => {
    setLoading(true);
    try {
      const functions = getFunctions();
      const generateTicket = httpsCallable(functions, 'generateTicket');
      const result = await generateTicket();

      if (result.data.success) {
        // Save to localStorage
        localStorage.setItem('ticketId', result.data.ticketId);
        localStorage.setItem('ticketNumber', result.data.ticketNumber.toString());
        
        setTicketId(result.data.ticketId);
        setTicketNumber(result.data.ticketNumber);
        setStatus('waiting');
      }
    } catch (error) {
      console.error('Error getting ticket:', error);
      alert('Gagal mengambil nomor antrian: ' + error.message);
    }
    setLoading(false);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'waiting':
        return 'bg-yellow-500';
      case 'called':
        return 'bg-green-500 animate-pulse';
      case 'done':
        return 'bg-blue-500';
      case 'missed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'waiting':
        return 'MENUNGGU';
      case 'called':
        return 'DIPANGGIL';
      case 'done':
        return 'SELESAI';
      case 'missed':
        return 'TERLEWAT';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full">
        {!ticketId ? (
          <div className="bg-white rounded-lg shadow-xl p-8 md:p-12">
            <div className="text-center">
              <div className="mb-6">
                <img src={logo} alt="Logo" className="w-40 h-auto mx-auto" />
              </div>
              
              <h1 className="text-2xl md:text-3xl font-bold text-[#2E5C8A] mb-2">
                Sistem Antrian Digital
              </h1>
              <p className="text-slate-600 mb-8">Ambil nomor antrian Anda</p>
            
              <button
                onClick={getTicket}
                disabled={loading}
                className="w-full bg-[#2E5C8A] hover:bg-[#1B3A52] text-white font-semibold py-4 px-8 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-lg hover:shadow-xl"
              >
                {loading ? 'Memproses...' : 'Ambil Nomor Antrian'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Logo di luar card */}
            <div className="flex justify-center mb-6">
              <img src={logo} alt="Logo" className="h-16 md:h-20 w-auto" />
            </div>

            <div className="bg-white rounded-lg shadow-xl">
            {/* Header */}
            <div className="bg-[#2E5C8A] p-4 md:p-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-white/90 text-xs md:text-sm font-medium mb-1">Nomor Dipanggil</p>
                  <p className="text-white text-3xl md:text-4xl font-bold">
                    A{String(currentCalled || 0).padStart(3, '0')}
                  </p>
                </div>
                
                <button
                  onClick={clearTicket}
                  className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Ticket Body */}
            <div className="p-6 md:p-10">
              {/* Queue Number */}
              <div className="text-center mb-8">
                <p className="text-slate-500 text-sm mb-4">Nomor Antrian Anda</p>
                <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-8 md:p-10 inline-block">
                  <p className="text-[#2E5C8A] text-6xl md:text-8xl font-bold tracking-tight">
                    A{String(ticketNumber).padStart(3, '0')}
                  </p>
                </div>
                <div className="mt-4">
                  <span className={`${getStatusColor()} px-5 py-2 rounded-full text-white font-medium text-sm`}>
                    {getStatusText()}
                  </span>
                </div>
              </div>

              {/* Status Info */}
              {status === 'waiting' && position > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-amber-800 text-base font-semibold">Posisi Dalam Antrian</p>
                  </div>
                  <p className="text-amber-900 text-5xl font-black mb-2">{position}</p>
                  <p className="text-amber-700 text-base">orang di depan Anda</p>
                </div>
              )}

              {status === 'called' && (
                <div className="bg-gradient-green border-2 border-green-300 rounded-xl p-6 text-center pulse-glow">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-white font-bold text-2xl mb-2">Giliran Anda!</p>
                  <p className="text-white/90 text-base">Silakan menuju loket sekarang</p>
                </div>
              )}

              {status === 'done' && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-blue-800 font-semibold text-lg">Layanan Selesai</p>
                  </div>
                  <p className="text-blue-600 text-base">Terima kasih atas kunjungan Anda</p>
                </div>
              )}

              {status === 'missed' && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-xl p-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-800 font-semibold text-lg">Nomor Terlewat</p>
                  </div>
                  <p className="text-red-600 text-base">Silakan ambil nomor antrian baru</p>
                </div>
              )}

              {/* Action Button */}
              {(status === 'done' || status === 'missed') && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <button
                    onClick={clearTicket}
                    className="w-full bg-[#2E5C8A] hover:bg-[#1B3A52] text-white font-semibold py-4 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl"
                  >
                    Ambil Nomor Baru
                  </button>
                </div>
              )}
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Customer;
