// Import Vercel Analytics
import { inject } from '@vercel/analytics';

// Initialize Vercel Web Analytics
inject({
  mode: 'auto', // Automatically detects environment (production/development)
  debug: false  // Set to true for debugging
});
