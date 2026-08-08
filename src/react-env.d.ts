/// <reference types="react" />
/// <reference types="react-dom" />

interface ImportMetaEnv {
	readonly VITE_DATA_PROVIDER?: 'firebase' | 'supabase';
	readonly VITE_AUTH_PROVIDER?: 'firebase' | 'supabase';
	readonly VITE_PERMISSIONS_DATA_PROVIDER?: 'firebase' | 'supabase';
	readonly VITE_SESSIONS_DATA_PROVIDER?: 'firebase' | 'supabase';
	readonly VITE_SUPABASE_URL?: string;
	readonly VITE_SUPABASE_ANON_KEY?: string;
	readonly VITE_SUPABASE_AUTO_MIGRATE_SESSIONS?: 'true' | 'false';
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
