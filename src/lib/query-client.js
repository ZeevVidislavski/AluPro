import { QueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		// A failed save must never be silent. Mutations with their own onError
		// (e.g. Projects.jsx) keep it; all others fall back to this toast.
		mutations: {
			onError: (err) => {
				toast({
					variant: 'destructive',
					title: 'שגיאה',
					description: err?.message || 'אירעה שגיאה, נסה שוב',
				});
			},
		},
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});