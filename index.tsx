import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App, { SyncContext } from './App';
import { AppState } from './types';

const Root = () => {
  const [userPwd, setPwd] = useState('');
  const [data, setData] = useState<AppState | null>(null);

  useEffect(() => {
    if (!userPwd) return;

    // Try to subscribe to cloud updates if firebase is available on window
    const w = window as any;
    if (w.firebaseDB && w.firebaseRef && w.firebaseOnValue) {
      try {
        const db = w.firebaseDB;
        const ref = w.firebaseRef(db, `users/${userPwd}/current_status`);
        const unsub = w.firebaseOnValue(ref, (snapshot: any) => {
          const val = snapshot.val();
          if (val) setData(val);
        });
        return () => {
             if (typeof unsub === 'function') unsub();
        };
      } catch (e) {
        console.error("Firebase subscription error", e);
      }
    }
  }, [userPwd]);

  return (
    <SyncContext.Provider value={{ data, userPwd, setPwd }}>
      <App />
    </SyncContext.Provider>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);