import { createContext } from 'react-router';

export interface ApiContext {
  baseUrl: string;
}

export const apiContext = createContext<ApiContext>();
