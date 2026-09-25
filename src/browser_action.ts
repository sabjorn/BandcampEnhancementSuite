import { createLogger } from './logger';
import { applyStoredTheme } from './theme';

const log = createLogger();

applyStoredTheme().catch(error => log.error(`Failed to theme the popup: ${error}`));
