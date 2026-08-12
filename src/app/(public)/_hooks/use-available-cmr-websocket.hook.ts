import { useCallback, useEffect, useRef, useState } from 'react';
import { Configuration } from '@/config/settings.config';
import { logger } from '@/helpers/logger.helper';
import type { CmrModel } from '@/models/cmr.model';
import { requestWsTicket } from '@/services/driver-session.service';
import type { WsStatus } from '@/types/web-socket.type';

const MAX_RETRIES = 5;

const WS_PATH = '/cmr-available';

function getWebSocketUrl(ticket: string): string {
	const base = Configuration.get('remoteApi.wsUrl');

	// The browser can't send an Authorization header on a WebSocket, so the
	// single-use ticket (obtained server-side via the proxy) rides on the URL.
	return `${base}${WS_PATH}?ticket=${encodeURIComponent(ticket)}`;
}

function getReconnectDelay(retry: number): number {
	const baseDelay = Configuration.get('remoteApi.wsReconnectDelay');

	return Math.min(baseDelay * 2 ** (retry - 1), 30000);
}

export function useAvailableCmrWebSocket() {
	const [entries, setEntries] = useState<CmrModel[]>([]);
	const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected');
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const retryCount = useRef(0);
	const isMounted = useRef(true);

	// Schedules the next reconnect attempt (a fresh ticket is fetched on each one).
	const scheduleReconnect = useCallback(() => {
		retryCount.current += 1;
		const delay = getReconnectDelay(retryCount.current);

		logger.debug('Scheduling WebSocket reconnect', undefined, {
			delay,
			attempt: retryCount.current,
			maxRetries: MAX_RETRIES,
		});

		reconnectTimer.current = setTimeout(() => {
			void connectRef.current();
		}, delay);
	}, []);

	const connect = useCallback(async () => {
		if (!isMounted.current) {
			return;
		}

		if (retryCount.current >= MAX_RETRIES) {
			setWsStatus('terminated');
			setErrorMessage(
				'Unable to connect to real-time updates. Please refresh the page.',
			);

			logger.error('WebSocket gave up reconnecting', undefined, {
				maxRetries: MAX_RETRIES,
			});
			return;
		}

		setWsStatus('connecting');
		setErrorMessage(null);

		// A ticket is single-use, so one is fetched before every (re)connect. A
		// failure here is treated like a connection error: back off and retry.
		let ticket: string;

		try {
			ticket = await requestWsTicket();
		} catch (err) {
			if (!isMounted.current) {
				return;
			}

			logger.error('Failed to obtain a WebSocket ticket', err);

			setWsStatus('error');
			setErrorMessage('Connection error. Retrying...');
			scheduleReconnect();
			return;
		}

		if (!isMounted.current) {
			return;
		}

		try {
			const ws = new WebSocket(getWebSocketUrl(ticket));
			wsRef.current = ws;

			ws.onopen = () => {
				if (!isMounted.current) {
					return;
				}

				retryCount.current = 0;
				setWsStatus('connected');
				setErrorMessage(null);
			};

			ws.onmessage = (event) => {
				if (!isMounted.current) {
					return;
				}

				try {
					const { event: name, data } = JSON.parse(event.data);

					if (name === 'cmr:available') {
						setEntries(data);
					}
				} catch (err) {
					/*
					 * The message body is deliberately not attached. It carries CMR and
					 * client records, and log context leaves the browser once a Sentry DSN
					 * is set. The length plus the parse error — which names the offending
					 * position — is enough to tell truncation from malformed JSON from an
					 * HTML error page, and `star-api` owns the message if the content
					 * itself is ever needed.
					 */
					logger.error('Failed to parse a WebSocket message', err, {
						payloadLength:
							typeof event.data === 'string'
								? event.data.length
								: null,
					});
				}
			};

			ws.onclose = (event) => {
				if (!isMounted.current) {
					return;
				}

				logger.debug('WebSocket closed', undefined, {
					code: event.code,
					reason: event.reason,
				});

				setWsStatus('disconnected');

				if (event.code !== 1000) {
					scheduleReconnect();
				}
			};

			ws.onerror = () => {
				if (!isMounted.current) {
					return;
				}

				// Browser intentionally provides no error details in onerror (security policy)
				// The onclose handler will fire next and handle reconnect
				logger.debug(
					'WebSocket connection error — waiting for close event',
				);

				// Only update status if we haven't successfully connected yet
				if (wsStatus !== 'connected') {
					setWsStatus('error');
					setErrorMessage('Connection error. Retrying...');
				}
			};
		} catch (err) {
			logger.error('Failed to create the WebSocket', err);

			setWsStatus('error');
			setErrorMessage('Failed to establish connection');
		}
	}, [wsStatus, scheduleReconnect]);

	const connectRef = useRef(connect);

	useEffect(() => {
		connectRef.current = connect;
	}, [connect]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: empty deps, connect is stable and captured via ref below
	useEffect(() => {
		isMounted.current = true;
		void connect();

		return () => {
			isMounted.current = false;

			if (reconnectTimer.current) {
				clearTimeout(reconnectTimer.current);
				reconnectTimer.current = null;
			}

			wsRef.current?.close(1000, 'Component unmounting');
			wsRef.current = null;
		};
	}, []);

	const manualReconnect = useCallback(() => {
		if (reconnectTimer.current) {
			clearTimeout(reconnectTimer.current);
			reconnectTimer.current = null;
		}

		if (wsRef.current) {
			wsRef.current.onclose = null; // Prevent auto-reconnect from firing
			wsRef.current.close(1000, 'Manual reconnect');
			wsRef.current = null;
		}

		retryCount.current = 0;
		void connect();
	}, [connect]);

	return { entries, wsStatus, errorMessage, manualReconnect };
}
