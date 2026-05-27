import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
const testEnvPath = path.resolve(__dirname, '../../.env.test');
config({ path: testEnvPath });

export {}; // Empty export to make it a module