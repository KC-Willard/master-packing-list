import { createClient } from '@supabase/supabase-js';

export const sb = createClient(
  'https://chtgebzsqnqbijujvbci.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodGdlYnpzcW5xYmlqdWp2YmNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNDI2NzAsImV4cCI6MjA5MzkxODY3MH0.QREDDJ8KU0w_tEecgnSg03faS4tVv8yRLIDh0twEW4U'
);

export const NETLIFY_URL = 'https://master-packing-list.netlify.app';
