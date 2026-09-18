'use client';

import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { getResponseData } from '@/helpers/api.helper';
import type {
	CartAddItemParams,
	CartDeliveryChoice,
	CartWithPricingModel,
} from '@/models/cart.model';
import {
	requestAddCartItem,
	requestCart,
	requestRemoveCartItem,
	requestUpdateCartItem,
} from '@/services/cart.service';

/**
 * One cache entry for the whole app. The header badge, the product page and the basket page all
 * read this key, so a line added on one is on the others without any of them telling the others -
 * which is the reason the cart is server data in TanStack Query rather than a Zustand store.
 *
 * Checkout is the exception: a basket priced against a client - and quoted for a delivery choice -
 * is a different quote, so it holds its own entry keyed `[...CART_QUERY_KEY, clientId, method,
 * addressId]`. The base key stays this array's prefix, so invalidating it reaches those too.
 */
export const CART_QUERY_KEY = ['cart'] as const;

/**
 * The cart is never stale for long, but it is also not free: every read prices the lines against
 * the catalog. A short window keeps a page of product cards from re-fetching it per navigation
 * while still picking up a price change within the session.
 */
const STALE_TIME_MS = 30_000;

/**
 * The current cart and the three writes a storefront makes against it.
 *
 * **Reading it creates one.** `GET /public/cart` answers with a new cart when the caller has none,
 * so the header can call this unconditionally on a first visit. The handle that identifies a guest
 * never reaches this code: the Next proxy holds it as an httpOnly cookie and attaches it, the same
 * way it attaches the session.
 *
 * Every write answers with the whole priced cart, so each mutation seeds the cache from its own
 * response instead of invalidating and re-fetching - one round trip per action rather than two,
 * and no window where the badge shows the old count.
 */
export function useCart(
	clientId?: number | null,
	delivery?: CartDeliveryChoice | null,
) {
	const queryClient = useQueryClient();

	/*
	 * Naming a client asks the backend to price the basket against that buyer, which is what makes
	 * a client-scoped discount visible before the order is raised. It is a different quote of the
	 * same lines, so it gets its own entry rather than overwriting the one every other page reads -
	 * and the delivery choice is part of that quote, since the address decides the rate.
	 */
	const method = delivery?.method ?? null;
	const addressId = delivery?.addressId ?? null;

	const queryKey = useMemo(
		() =>
			clientId
				? [...CART_QUERY_KEY, clientId, method, addressId]
				: CART_QUERY_KEY,
		[clientId, method, addressId],
	);

	const query = useQuery({
		queryKey: queryKey,
		queryFn: async () =>
			getResponseData(
				await requestCart(
					clientId,
					method ? { method: method, addressId: addressId } : null,
				),
			),
		staleTime: STALE_TIME_MS,
		/*
		 * Keeps the summary on screen while a new address is re-quoted, instead of dropping the
		 * whole checkout back to its loading state for a figure that is about to move by a few lei.
		 */
		placeholderData: keepPreviousData,
	});

	const setCart = useCallback(
		(cart: CartWithPricingModel | undefined) => {
			if (cart) {
				queryClient.setQueryData(queryKey, cart);
			}
		},
		[queryClient, queryKey],
	);

	const addItem = useMutation({
		mutationFn: async (params: CartAddItemParams) =>
			getResponseData(await requestAddCartItem(params)),
		onSuccess: setCart,
	});

	const updateItem = useMutation({
		mutationFn: async ({
			id,
			quantity,
		}: {
			id: number;
			quantity: number;
		}) => getResponseData(await requestUpdateCartItem(id, { quantity })),
		onSuccess: setCart,
	});

	const removeItem = useMutation({
		mutationFn: async (id: number) =>
			getResponseData(await requestRemoveCartItem(id)),
		onSuccess: setCart,
	});

	const cart = query.data;
	const lines = cart?.pricing.lines ?? [];

	return {
		cart: cart,
		lines: lines,
		isLoading: query.isLoading,
		isFetching: query.isFetching,
		/*
		 * Units, not lines: three of one thing and one of another reads as 4 on the badge, which
		 * is what a shopper counts. Quantities are decimal on the backend - a product may be sold
		 * by weight - so this is rounded up rather than truncated, and half a kilo still shows the
		 * badge rather than a 0. A bundle's components are left out: they are what one bundle
		 * contains, and the shopper added the bundle.
		 */
		itemCount: Math.ceil(
			lines
				.filter((line) => line.parent_id === null)
				.reduce((sum, line) => sum + line.quantity, 0),
		),
		addItem: addItem,
		updateItem: updateItem,
		removeItem: removeItem,
	};
}
