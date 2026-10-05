import React, { createContext, useContext, useState, useEffect } from 'react';

const NetworkContext = createContext(null);
export const API_BASE = '/api';

export const NetworkProvider = ({ children }) => {
  const [health, setHealth] = useState({
    status: 'CHECKING',
    allHealthy: false,
    network: null,
    ipfs: null
  });

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      setHealth({
        status: data.status === 'UP' ? 'ONLINE' : 'PARTIAL',
        allHealthy: data.status === 'UP',
        network: data.network,
        ipfs: data.ipfs
      });
    } catch (err) {
      setHealth({
        status: 'OFFLINE',
        allHealthy: false,
        network: null,
        ipfs: null
      });
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <NetworkContext.Provider value={{ health, checkHealth, API_BASE }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => useContext(NetworkContext);
