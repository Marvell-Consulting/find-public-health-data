import { createContext, type ReactNode, useContext } from 'react';

const NonceContext = createContext<string | undefined>(undefined);

interface NonceProviderProps {
  children: ReactNode;
  value: string | undefined;
}

export function NonceProvider({ children, value }: NonceProviderProps) {
  return <NonceContext value={value}>{children}</NonceContext>;
}

export function useNonce(): string | undefined {
  return useContext(NonceContext);
}
