import type { RestCommand } from '../../types.js';

// TODO better options for ouput typing

/**
 * Trigger a flow
 * @param method
 * @param id
 * @param data
 * @returns Result of the flow, if any.
 */
export const triggerFlow =
	<Schema>(method: 'GET' | 'POST', id: string, data?: Record<string, any>): RestCommand<unknown, Schema> =>
	() => {
		if (method === 'GET') {
			return {
				path: `/flows/trigger/${id}`,
				params: data ?? {},
				method: 'GET',
			};
		}

		return {
			path: `/flows/trigger/${id}`,
			body: JSON.stringify(data ?? {}),
			method: 'POST',
		};
	};
