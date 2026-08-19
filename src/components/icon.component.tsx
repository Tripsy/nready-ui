import {
	Archive,
	ArchiveRestore,
	ArrowDown,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	Ban,
	BanknoteArrowDown,
	BanknoteArrowUp,
	BookText,
	Building2,
	Calendar,
	CalendarClock,
	Camera,
	Car,
	Check,
	ChevronLeft,
	CircleAlert,
	CircleCheck,
	CircleEllipsis,
	CircleSlash,
	CircleUser,
	CircleX,
	ClipboardClock,
	Clock,
	ClockFading,
	ClockPlus,
	Code,
	Coins,
	CornerRightDown,
	Cuboid,
	Ellipsis,
	Eraser,
	Expand,
	Eye,
	EyeOff,
	FileCog,
	FileDigit,
	FilePenLine,
	FileSignal,
	FileStack,
	Flag,
	FolderTree,
	GalleryVerticalEnd,
	Hammer,
	HardDrive,
	Heart,
	IdCard,
	Info,
	KeyRound,
	Laugh,
	LayoutTemplate,
	Lightbulb,
	ListOrdered,
	ListStart,
	Loader,
	Lock,
	LockKeyhole,
	LogIn,
	type LucideProps,
	Mail,
	MailCheck,
	Mails,
	MapPin,
	MapPinHouse,
	MessageCircleMore,
	Minus,
	Move,
	Newspaper,
	Package,
	PenLine,
	PiggyBank,
	Play,
	Plus,
	Printer,
	RefreshCcw,
	Route,
	Rss,
	Save,
	Search,
	Send,
	Settings,
	Share2,
	Shell,
	Shield,
	SmilePlus,
	SquareParkingOff,
	SquarePen,
	SquareX,
	Star,
	TableOfContents,
	Tag,
	Tags,
	TextSearch,
	ThumbsDown,
	ThumbsUp,
	TicketCheck,
	TicketPercent,
	Trash2,
	TrendingUp,
	TriangleAlert,
	Truck,
	Undo2,
	Upload,
	UserRound,
	Users,
	Wrench,
	X,
} from 'lucide-react';
import type React from 'react';
import { capitalizeFirstLetter } from '@/helpers/string.helper';

const createIcon = (IconComponent: React.ComponentType<LucideProps>) => {
	return ({ size = 16, ...props }: LucideProps) => (
		<IconComponent size={size} {...props} />
	);
};

/**
 * Brand marks, which lucide does not carry — it dropped its brand set — so they are inlined
 * as single-path SVGs. They are drawn with `currentColor` and sized like the lucide wrappers
 * above, so a caller cannot tell the two apart.
 */
type BrandIconProps = React.SVGProps<SVGSVGElement> & { size?: number };

const createBrandIcon = (path: string) => {
	return ({ size = 16, ...props }: BrandIconProps) => (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden="true"
			focusable="false"
			{...props}
		>
			<path d={path} />
		</svg>
	);
};

const GITHUB_PATH =
	'M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.28 0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z';

const LINKEDIN_PATH =
	'M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z';

const FACEBOOK_PATH =
	'M9.1 23.69v-7.98H6.63v-3.67H9.1v-1.58c0-4.08 1.85-5.98 5.86-5.98.4 0 .95.04 1.47.1.51.06.99.15 1.14.2v3.32a8.6 8.6 0 0 0-.65-.04 27 27 0 0 0-.74 0c-.7 0-1.25.1-1.67.31a1.7 1.7 0 0 0-.68.62c-.26.42-.37 1-.37 1.75v1.3h3.92l-.39 2.1-.29 1.57h-3.24v8.24C19.4 23.24 24 18.18 24 12.04 24 5.42 18.63.05 12 .05S0 5.42 0 12.04c0 5.63 3.87 10.35 9.1 11.65Z';

const X_PATH =
	'M18.24 2.25h3.31l-7.23 8.26L23 21.75h-6.66l-5.21-6.82-5.97 6.82H1.85l7.73-8.84L1.4 2.25h6.83l4.71 6.23 5.3-6.23Zm-1.16 17.52h1.83L7.24 4.13H5.28l11.8 15.64Z';

const WHATSAPP_PATH =
	'M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.14-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.25-.58-.49-.5-.67-.51a12.8 12.8 0 0 0-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.7.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.57-.34m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.37l-.36-.22-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.89-9.89a9.82 9.82 0 0 1 6.99 2.9 9.83 9.83 0 0 1 2.9 7c0 5.45-4.44 9.88-9.89 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.9c0 2.09.54 4.14 1.58 5.94L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45c6.55 0 11.89-5.34 11.89-11.9a11.82 11.82 0 0 0-3.48-8.41';

export const Icons = {
	Search: createIcon(Search),
	Visible: createIcon(Eye),
	Obscured: createIcon(EyeOff),
	Info: createIcon(Info),
	Clear: createIcon(Eraser),
	Minimize: createIcon(Minus),
	Close: createIcon(X),
	Expand: createIcon(Expand),
	More: createIcon(Ellipsis),
	LessLeft: createIcon(ChevronLeft),
	TextSearch: createIcon(TextSearch),

	Email: createIcon(Mail),
	Password: createIcon(KeyRound),
	Tag: createIcon(Tag),
	Calendar: createIcon(Calendar),
	Settings: createIcon(Settings),
	Security: createIcon(Shield),
	Sessions: createIcon(FileStack),
	User: createIcon(UserRound),
	Users: createIcon(Users),
	HardDrive: createIcon(HardDrive),
	History: createIcon(ClipboardClock),
	Cron: createIcon(GalleryVerticalEnd),
	List: createIcon(ListStart),
	Mails: createIcon(Mails),
	Template: createIcon(LayoutTemplate),
	DocumentSeries: createIcon(FileDigit),
	Logs: createIcon(TableOfContents),
	Account: createIcon(CircleUser),
	Permission: createIcon(Wrench),
	Content: createIcon(FileStack),
	Location: createIcon(MapPin),
	CashFlow: createIcon(PiggyBank),
	Discount: createIcon(TicketPercent),
	OperationalRecord: createIcon(BanknoteArrowUp),
	Financial: createIcon(BookText),
	Client: createIcon(IdCard),
	Address: createIcon(MapPinHouse),
	Article: createIcon(Newspaper),
	Brand: createIcon(FileSignal),
	Category: createIcon(FolderTree),
	Term: createIcon(Tags),
	City: createIcon(Building2),
	Code: createIcon(Code),
	Vendor: createIcon(Shell),
	Carrier: createIcon(Truck),
	Logistics: createIcon(Package),
	Clock: createIcon(Clock),
	Payment: createIcon(Coins),
	MapPin: createIcon(MapPin),
	Share: createIcon(Share2),
	Print: createIcon(Printer),
	Image: createIcon(Camera),
	Publishing: createIcon(Rss),
	Featured: createIcon(Star),
	Comment: createIcon(MessageCircleMore),
	Rating: createIcon(SmilePlus),
	RatingUp: createIcon(ThumbsUp),
	RatingDown: createIcon(ThumbsDown),
	RatingLike: createIcon(Star),
	RatingLove: createIcon(Heart),
	RatingInsightful: createIcon(Lightbulb),
	RatingFunny: createIcon(Laugh),

	Direction: {
		ArrowUp: createIcon(ArrowUp),
		ArrowRight: createIcon(ArrowRight),
		ArrowDown: createIcon(ArrowDown),
		ArrowLeft: createIcon(ArrowLeft),
		ArrowCurvedBottom: createIcon(CornerRightDown),
	},

	Social: {
		GitHub: createBrandIcon(GITHUB_PATH),
		LinkedIn: createBrandIcon(LINKEDIN_PATH),
		Facebook: createBrandIcon(FACEBOOK_PATH),
		X: createBrandIcon(X_PATH),
		WhatsApp: createBrandIcon(WHATSAPP_PATH),
		Email: createIcon(Mail),
	},

	Status: {
		Active: createIcon(CircleCheck),
		Pending: createIcon(Clock),
		Inactive: createIcon(CircleSlash),
		Deleted: createIcon(Ban),
		Ok: createIcon(ThumbsUp),
		Error: createIcon(CircleAlert),
		Warning: createIcon(TriangleAlert),
		Sent: createIcon(MailCheck),
		Success: createIcon(CircleCheck),
		Loading: createIcon(Loader),

		Authorized: createIcon(CircleCheck),
		Completed: createIcon(Check),
		Failed: createIcon(CircleAlert),
		Canceled: createIcon(CircleX),
		Expired: createIcon(ClockFading),
		RequiresAction: createIcon(TriangleAlert),

		Verified: createIcon(Check),
		Draft: createIcon(FilePenLine),
		Rejected: createIcon(CircleX),
		Scheduled: createIcon(CalendarClock),
		Published: createIcon(Send),
		Archived: createIcon(Archive),

		InUse: createIcon(Car),
		Damaged: createIcon(Hammer),
		Sold: createIcon(BanknoteArrowUp),
		Scrapped: createIcon(SquareParkingOff),
		Closed: createIcon(Lock),
		Assigned: createIcon(TicketCheck),
		Returned: createIcon(Undo2),

		Ordered: createIcon(Play),
		Preparing: createIcon(CircleEllipsis),
		Transit: createIcon(Route),
		Delivered: createIcon(Cuboid),
		Delayed: createIcon(ClockPlus),
	},
	Action: {
		Save: createIcon(Save),
		Submit: createIcon(Play),
		Login: createIcon(LogIn),
		Create: createIcon(Plus),
		Add: createIcon(Plus),
		Update: createIcon(SquarePen),
		Delete: createIcon(Trash2),
		Cancel: createIcon(X),
		Abort: createIcon(SquareX),
		Destroy: createIcon(CircleX),
		Confirm: createIcon(CircleCheck),
		Reset: createIcon(RefreshCcw),
		Enable: createIcon(CircleCheck),
		Disable: createIcon(LockKeyhole),
		Restore: createIcon(ArchiveRestore),
		Permissions: createIcon(Wrench),
		SetupPermissions: createIcon(Wrench),
		View: createIcon(Eye),
		Complete: createIcon(Check),
		Drop: createIcon(CircleX),
		Refund: createIcon(BanknoteArrowDown),
		Verified: createIcon(Check),
		Draft: createIcon(FilePenLine),
		StatusTransition: createIcon(TrendingUp),
		Close: createIcon(Lock),
		Setup: createIcon(FileCog),
		Return: createIcon(Undo2),
		Order: createIcon(ListOrdered),
		Tree: createIcon(FolderTree),
		Image: createIcon(Camera),
		Upload: createIcon(Upload),
		Move: createIcon(Move),
		Schedule: createIcon(CalendarClock),
		Publish: createIcon(Send),
		Approve: createIcon(CircleCheck),
		Reject: createIcon(CircleX),
		Spam: createIcon(Ban),
		Flag: createIcon(Flag),
		Revert: createIcon(PenLine),
		Archive: createIcon(Archive),
	},
};

export function getActionIcon(action: string) {
	action = capitalizeFirstLetter(action);

	if (action in Icons.Action) {
		return Icons.Action[action as keyof typeof Icons.Action];
	}

	throw new Error(`${action} is not defined in Icons.Action`);
}
