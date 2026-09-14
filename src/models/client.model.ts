export const ClientTypeEnum = {
	PERSON: 'person',
	COMPANY: 'company',
} as const;

export type ClientType = (typeof ClientTypeEnum)[keyof typeof ClientTypeEnum];

export const ClientStatusEnum = {
	ACTIVE: 'active',
	INACTIVE: 'inactive',
	PENDING: 'pending',
} as const;

export type ClientStatus =
	(typeof ClientStatusEnum)[keyof typeof ClientStatusEnum];

export type ClientIdentity =
	| {
			client_type: typeof ClientTypeEnum.COMPANY;

			company_name: string | null;
			company_cui: string | null;
			company_reg_com: string | null;

			person_name?: never;
			person_identification_number?: never;
	  }
	| {
			client_type: typeof ClientTypeEnum.PERSON;

			person_name: string | null;
			person_identification_number: string | null;

			company_name?: never;
			company_cui?: never;
			company_reg_com?: never;
	  };

export type ClientFinancial = {
	iban: string | null;
	bank_name: string | null;
};

export type ClientContact = {
	contact_name: string | null;
	contact_email: string | null;
	contact_phone: string | null;
};

type ClientBase<D = Date | string> = {
	id: number;

	status: ClientStatus;

	/**
	 * The account the client belongs to, or null for one typed in from the back office. One account
	 * may hold several clients; checkout accepts only the caller's own.
	 */
	user_id: number | null;
	/** Joined by the dashboard read and listing, so both can name the account. */
	user?: { id: number; name: string; email: string } | null;

	notes: string | null;

	created_at: D;
	updated_at: D;
	deleted_at: D;
};

export type ClientModel<D = Date | string> = ClientBase<D> &
	ClientIdentity &
	ClientFinancial &
	ClientContact;

/**
 * The account a client belongs to, for a listing cell. A client whose account was soft-deleted
 * keeps its `user_id` while the join answers null, so the id is all there is left to name it by.
 */
export function displayClientAccount(client: ClientModel): string {
	if (!client.user_id) {
		return '-';
	}

	return client.user
		? `${client.user.name} (#${client.user_id})`
		: `#${client.user_id}`;
}

export function displayClientLabel(client: ClientModel): string {
	if (client.client_type === ClientTypeEnum.COMPANY) {
		return client.company_name ?? '';
	}

	return client.person_name ?? '';
}
