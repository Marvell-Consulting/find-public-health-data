import type { Logger } from '@fphd/logger';
import { createContext } from 'react-router';

export const loggerContext = createContext<Logger>();
