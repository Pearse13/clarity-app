import React from 'react';
import { useState } from 'react';
import Landing from './pages/Landing';
import Login from './pages/Login';

function App() {
  const [showLogin, setShowLogin] = useState(false);

  return showLogin ? (
    <Login onBack={() => setShowLogin(false)} />
  ) : (
    <Landing onTryClarity={() => setShowLogin(true)} />
  );
}

export default App;