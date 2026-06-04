import type { SupabaseClient, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{ session: null; user: User | null }>;
		}
		interface PageData {
			user?: User | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
