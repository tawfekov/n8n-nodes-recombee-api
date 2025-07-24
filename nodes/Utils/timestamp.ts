/*
 * Converts various timestamp inputs to Unix epoch time in integer seconds (as string).
 * - If the input is a string or number, it is passed to the Date constructor.
 * - If the input is a Date instance, it is used directly.
 * - On invalid date inputs, it falls back to the current time.
 * - Returns integer seconds since January 1, 1970 UTC as a string.
 */
export function toEpochTimestamp(value: unknown): number {
	if (value === undefined || value === null) {
		return Math.floor(Date.now() / 1000);
	}
	const date = value instanceof Date ? value : new Date(value as any);
	return isNaN(date.getTime()) ? Math.floor(Date.now() / 1000) : Math.floor(date.getTime() / 1000);
}
