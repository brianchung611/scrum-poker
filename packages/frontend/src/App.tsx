import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';

function Loading() {
  return <p className="muted centered">…</p>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Layout />
      </Suspense>
    </BrowserRouter>
  );
}

function Layout() {
  // Subscribing here re-renders the shell when the language changes.
  useTranslation('common');

  return (
    <div className="app">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/:code" element={<RoomPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
    </div>
  );
}
