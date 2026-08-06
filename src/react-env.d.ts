/// <reference types="react" />
/// <reference types="react-dom" />

interface ImportMetaEnv {
	readonly VITE_DATA_PROVIDER?: 'firebase' | 'supabase';
	readonly VITE_SUPABASE_URL?: string;
	readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
