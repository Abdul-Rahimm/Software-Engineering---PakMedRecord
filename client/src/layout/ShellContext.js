import { createContext, useContext } from 'react';

// { role, cnic, profile, reloadProfile, refreshCounts } for pages inside AppShell
export const ShellContext = createContext({});
export const useShell = () => useContext(ShellContext);
