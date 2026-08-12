import { normalizePhoneNumber } from '@/helpers/string.helper';

export function whatsAppUrl(number: string, text: string) {
	// Remove any non-numeric characters from the number and ensure no '+' sign
	const cleanNumber = normalizePhoneNumber(number);

	// Encode the text for URL
	const encodedText = encodeURIComponent(text);

	// Build the WhatsApp URL
	let whatsappUrl: string;

	if (cleanNumber) {
		// Share to specific number
		whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedText}`;
	} else {
		// Share without specific number (just pre-filled message)
		whatsappUrl = `https://wa.me/?text=${encodedText}`;
	}

	return whatsappUrl;
}

export function WhatsAppContact({
	phone,
	message,
}: {
	phone: string;
	message: string;
}) {
	return (
		<a
			href={whatsAppUrl(phone, message)}
			target="_blank"
			rel="noopener noreferrer"
			className="cursor-pointer "
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="28"
				height="28"
				viewBox="0 0 32 32"
				fill="none"
			>
				<title>WhatsApp</title>
				<path
					d="M16 3C8.82 3 3 8.82 3 16c0 2.54.73 4.91 1.99 6.92L3 29l6.26-1.94A12.94 12.94 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3Z"
					fill="#25D366"
				/>
				<path
					d="M22.26 18.97c-.34-.17-2.01-.99-2.32-1.1-.31-.11-.54-.17-.77.17-.23.34-.88 1.1-1.08 1.32-.2.23-.4.26-.74.09-.34-.17-1.43-.53-2.73-1.68-1.01-.9-1.7-2.01-1.9-2.35-.2-.34-.02-.52.15-.69.15-.15.34-.4.51-.6.17-.2.23-.34.34-.57.11-.23.06-.43-.03-.6-.09-.17-.77-1.86-1.06-2.55-.28-.67-.57-.58-.77-.59h-.66c-.23 0-.6.09-.91.43-.31.34-1.2 1.17-1.2 2.86s1.23 3.32 1.4 3.55c.17.23 2.41 3.68 5.83 5.16.81.35 1.45.56 1.95.72.82.26 1.56.22 2.15.13.66-.1 2.01-.82 2.29-1.61.28-.79.28-1.47.2-1.61-.08-.14-.31-.23-.66-.4Z"
					fill="white"
				/>
			</svg>
		</a>
	);
}
