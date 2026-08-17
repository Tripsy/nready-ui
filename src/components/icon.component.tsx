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
	FolderTree,
	GalleryVerticalEnd,
	Hammer,
	HardDrive,
	IdCard,
	Info,
	KeyRound,
	LayoutTemplate,
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
	SquareParkingOff,
	SquarePen,
	SquareX,
	Star,
	TableOfContents,
	Tag,
	Tags,
	TextSearch,
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
		Reject: createIcon(CircleX),
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
