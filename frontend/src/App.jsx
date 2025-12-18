import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Customer from './components/Customer';
import Admin from './components/Admin';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/customer" element={<Customer />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  );
}

function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
        <h1 className="text-4xl font-bold text-center text-indigo-600 mb-4">
          Sistem Antrian
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Pilih portal yang ingin Anda akses
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/customer"
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl p-8 text-center transition duration-200 transform hover:scale-105 shadow-lg"
          >
            <div className="text-5xl mb-4">👥</div>
            <h2 className="text-2xl font-bold mb-2">Portal Pelanggan</h2>
            <p className="text-sm opacity-90">
              Ambil nomor antrian dan cek status
            </p>
          </Link>
          <Link
            to="/admin"
            className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl p-8 text-center transition duration-200 transform hover:scale-105 shadow-lg"
          >
            <div className="text-5xl mb-4">⚙️</div>
            <h2 className="text-2xl font-bold mb-2">Portal Admin</h2>
            <p className="text-sm opacity-90">
              Kelola antrian dan panggil pelanggan
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default App;
