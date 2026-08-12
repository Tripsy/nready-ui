import Image from 'next/image';
import Link from 'next/link';
import type React from 'react';
import { cn } from '@/helpers/css.helper';
import { formatCmrRefNumber } from '@/models/cmr.model';
import type { CompanyVehicleModel } from '@/models/company-vehicle.model';
import type { UserModel } from '@/models/user.model';

const config = {
	borderColor: 'border-gray-600',
	borderSize: 2,
};

export type DocumentCmrProps = {
	signed: boolean;
	data: {
		// Series code and padded sequential number, the reference printed on the document
		refCode: string;
		refNumber: number;
		pickupAddress: string;
		deliveryAddress: string;
		cmrVehicles: {
			id: number;
			vehicle: string;
			vin: string;
			license_plate: string | null;
			notes: string | null;
		}[];
		workSessionUsers: UserModel[];
		companyVehicleAuto: CompanyVehicleModel | null;
		companyVehicleTrailer: CompanyVehicleModel | null;
	};
};

type BoxLegendType = {
	index?: number;
	languages: {
		language: 'ro' | 'en' | 'fr';
		text: string;
		className?: string;
	}[];
};

function BoxLegend({ index, languages }: BoxLegendType) {
	return (
		<div className="flex flex-row">
			{index && (
				<div className="font-semibold text-lg leading-6 mr-2">
					{index}
				</div>
			)}
			<div className="flex flex-col">
				{languages.map((v) => {
					return (
						<div
							key={v.language}
							className={cn('text-gray-600 text-xs', v.className)}
						>
							{v.text}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function BoxText({
	className,
	children,
}: {
	className?: string;
	children?: React.ReactNode;
}) {
	return (
		<div className={cn('font-mono mt-2 ml-6', className)}>{children}</div>
	);
}

function BoxCheck({ checked, label }: { checked?: boolean; label: string }) {
	return (
		<div className="flex items-start gap-1 text-xs">
			<div
				className={`mt-0.4 flex items-center justify-center border-${config.borderSize} ${config.borderColor} w-4 h-4`}
			>
				{checked && <div className="text-md">x</div>}
			</div>
			{label}
		</div>
	);
}

export function DocumentCmr({ signed, data }: DocumentCmrProps) {
	return (
		<>
			{/*Tailwind helper to generate CSS classes*/}
			<div className="p-2 border-2 border-gray-6 hidden"></div>

			<div className="relative" style={{ width: '348mm' }}>
				{!signed && (
					<div className="absolute inset-0 bg-black/20 pointer-events-none z-10 flex items-center justify-center">
						<div className="text-6xl font-bold text-blue-400/50 -rotate-45">
							NESEMNAT / UNSIGNED / NON SIGNE
						</div>
					</div>
				)}

				<div className="flex p-4" style={{ minWidth: 'max-content' }}>
					<div
						className={`flex items-center justify-center shrink-0`}
						style={{ width: '12mm' }}
					>
						<div
							style={{
								writingMode: 'vertical-rl',
								transform: 'rotate(180deg)',
							}}
						>
							<div className="flex flex-nowrap items-center">
								<div className="text-xs text-muted">
									1-15, 19, 21, 22
								</div>
								<ul className="list-disc mt-6 leading-3 text-xs text-muted">
									<li className="mb-1">
										De completat sub responsabilitatea
										expeditorului
									</li>
									<li className="mb-1">
										To be completed on the sender's
										responsibility
									</li>
									<li>
										À remplir sous la responsabilité de
										l'expéditeur
									</li>
								</ul>
							</div>
						</div>
					</div>
					<div style={{ width: '320mm' }}>
						<div className="grid grid-cols-2">
							<div>
								<div
									style={{ height: '36mm' }}
									className={`p-2 border-${config.borderSize} ${config.borderColor}`}
								>
									<BoxLegend
										index={1}
										languages={[
											{
												language: 'ro',
												text: 'Expeditor (denumire, adresa, tara)',
											},
											{
												language: 'en',
												text: 'Sender (name, address, country',
											},
											{
												language: 'fr',
												text: 'Expéditeur (nom, adresse, pays)',
											},
										]}
									/>
									<BoxText />
								</div>
								<div
									style={{ height: '36mm' }}
									className={`p-2 border-${config.borderSize} border-t-0 ${config.borderColor}`}
								>
									<BoxLegend
										index={2}
										languages={[
											{
												language: 'ro',
												text: 'Destinatar (denumire, adresa, tara)',
											},
											{
												language: 'en',
												text: 'Consignee (name, address, country',
											},
											{
												language: 'fr',
												text: 'Destinataire (nom, adresse, pays)',
											},
										]}
									/>
									<BoxText />
								</div>
								<div
									style={{ height: '40mm' }}
									className={`p-2 border-${config.borderSize} border-t-0 ${config.borderColor}`}
								>
									<BoxLegend
										index={3}
										languages={[
											{
												language: 'ro',
												text: 'Locul descărcării (loc, tara)',
											},
											{
												language: 'en',
												text: 'Place of delivery of the goods (place, country)',
											},
											{
												language: 'fr',
												text: 'Lieu prévu pour la livraison de la marcandise (lieu, pays)',
											},
										]}
									/>
									<BoxText>{data.deliveryAddress}</BoxText>
								</div>
								<div
									style={{ height: '40mm' }}
									className={`p-2 border-${config.borderSize} border-t-0 ${config.borderColor}`}
								>
									<BoxLegend
										index={4}
										languages={[
											{
												language: 'ro',
												text: 'Locul încărcării (loc, tara, data)',
											},
											{
												language: 'en',
												text: 'Place and date of taking over goods (place, country, date)',
											},
											{
												language: 'fr',
												text: 'Lieu et date de la prise charge de la marchandise (lieu, pays, date)',
											},
										]}
									/>
									<BoxText>{data.pickupAddress}</BoxText>
								</div>
								<div
									style={{ height: '36mm' }}
									className={`p-2 border-${config.borderSize} border-t-0 ${config.borderColor}`}
								>
									<BoxLegend
										index={5}
										languages={[
											{
												language: 'ro',
												text: 'Documente anexate',
											},
											{
												language: 'en',
												text: 'Documents attached',
											},
											{
												language: 'fr',
												text: 'Documents annexés',
											},
										]}
									/>
								</div>
							</div>
							<div>
								<div
									style={{ height: '48mm' }}
									className={`p-2 border-${config.borderSize} border-l-0 ${config.borderColor}`}
								>
									<div className="grid grid-cols-2">
										<BoxLegend
											languages={[
												{
													language: 'ro',
													text: 'Scrisoare de transport',
													className:
														'font-bold uppercase',
												},
												{
													language: 'en',
													text: 'Consignment note',
													className:
														'font-bold uppercase',
												},
												{
													language: 'fr',
													text: 'Lettre de voiture',
													className:
														'font-bold uppercase',
												},
											]}
										/>
										<div className="flex justify-end">
											<div>
												<div>
													<Link
														href="https://www.112tractări.ro"
														className="font-bold text-xl text-green-900"
													>
														www.112tractări.ro
													</Link>
												</div>
												<div className="font-bold text-xl text-green-900 tracking-[1.5mm]">
													0750 112 112
												</div>
											</div>
										</div>
									</div>
									<div className="flex flex-col justify-center gap-y-4 mt-2">
										<div className="font-bold text-3xl text-center">
											(CMR)
										</div>
										<div className="flex flex-nowrap justify-center gap-x-4">
											<div>
												SERIE:{' '}
												<span className="font-semibold">
													{data.refCode}
												</span>
											</div>
											<div>
												CMR:{' '}
												<span className="font-semibold">
													{formatCmrRefNumber(
														data.refNumber,
													)}
												</span>
											</div>
										</div>
									</div>
								</div>
								<div
									className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor}`}
									style={{ height: '50mm' }}
								>
									<BoxLegend
										index={16}
										languages={[
											{
												language: 'ro',
												text: 'Operator de transport (denumire, adresa, tara)',
											},
											{
												language: 'en',
												text: 'Carrier (name, address, country)',
											},
											{
												language: 'fr',
												text: 'Transporteur (nom, adresse, pays)',
											},
										]}
									/>
									<Image
										src="/images/star-stamp.png"
										alt="Star Office Signature"
										width={280}
										height={110}
										loading="eager"
										className="mx-auto my-2"
										style={{
											width: 'auto',
											height: 'auto',
											transform: 'rotate(-4deg)',
										}}
									/>
								</div>
								<div
									style={{ height: '36mm' }}
									className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor}`}
								>
									<BoxLegend
										index={17}
										languages={[
											{
												language: 'ro',
												text: 'Transportori succesivi (nume, adresa, tara)',
											},
											{
												language: 'en',
												text: 'Succesive carriers (name, address, country)',
											},
											{
												language: 'fr',
												text: 'Transporteurs successifs (nom, adresse, pays)',
											},
										]}
									/>
									<BoxText />
								</div>
								<div
									style={{ height: '54mm' }}
									className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} print:h-[53mm]`}
								>
									<BoxLegend
										index={18}
										languages={[
											{
												language: 'ro',
												text: 'Rezerve si observatii ale transportatorilor',
											},
											{
												language: 'en',
												text: "Carrier's reservation and observations",
											},
											{
												language: 'fr',
												text: 'Réserves et observations du transporteur',
											},
										]}
									/>
									<BoxText>
										{data.companyVehicleAuto && (
											<div>
												<span className="uppercase">
													Auto
												</span>
												:{' '}
												<span className="font-semibold">
													{
														data.companyVehicleAuto
															.vehicle.model
													}{' '}
													{
														data.companyVehicleAuto
															.license_plate
													}
												</span>
											</div>
										)}
										{data.companyVehicleTrailer && (
											<div>
												<span className="uppercase">
													Remorca
												</span>
												:{' '}
												<span className="font-semibold">
													{
														data
															.companyVehicleTrailer
															.vehicle.model
													}{' '}
													{
														data
															.companyVehicleTrailer
															.license_plate
													}
												</span>
											</div>
										)}
										<div>
											<span className="uppercase">
												Conducator/i auto
											</span>
											:{' '}
											<span className="font-semibold">
												{data.workSessionUsers
													.map((user) => user.name)
													.join(', ')}
											</span>
										</div>
									</BoxText>
								</div>
							</div>
						</div>
						<div
							style={{ height: '84mm' }}
							className={`p-2 border-${config.borderSize} border-t-0 ${config.borderColor}`}
						>
							<div className="grid grid-cols-7">
								<BoxLegend
									index={6}
									languages={[
										{
											language: 'ro',
											text: 'Mărci și numere',
										},
										{
											language: 'en',
											text: 'Marks and Nom',
										},
										{
											language: 'fr',
											text: 'Marques et numéros',
										},
									]}
								/>
								<BoxLegend
									index={7}
									languages={[
										{
											language: 'ro',
											text: 'Nr. de colete',
										},
										{
											language: 'en',
											text: 'Number of packages',
										},
										{
											language: 'fr',
											text: 'Nombre de colis',
										},
									]}
								/>
								<BoxLegend
									index={8}
									languages={[
										{
											language: 'ro',
											text: 'Mod de ambalare',
										},
										{
											language: 'en',
											text: 'Method of packing',
										},
										{
											language: 'fr',
											text: "Mode d'emballage",
										},
									]}
								/>
								<BoxLegend
									index={9}
									languages={[
										{
											language: 'ro',
											text: 'Natura mărfii',
										},
										{
											language: 'en',
											text: 'Nature of the goods',
										},
										{
											language: 'fr',
											text: 'Nature de la marchandise',
										},
									]}
								/>
								<BoxLegend
									index={10}
									languages={[
										{
											language: 'ro',
											text: 'Număr statistic',
										},
										{
											language: 'en',
											text: 'Statistical number',
										},
										{
											language: 'fr',
											text: 'No. stastique',
										},
									]}
								/>
								<BoxLegend
									index={11}
									languages={[
										{
											language: 'ro',
											text: 'Greutate brută kg',
										},
										{
											language: 'en',
											text: 'Gross weight kg',
										},
										{
											language: 'fr',
											text: 'Poids brut kg',
										},
									]}
								/>
								<BoxLegend
									index={12}
									languages={[
										{ language: 'ro', text: 'Cubaj m³' },
										{ language: 'en', text: 'Volume m³' },
										{ language: 'fr', text: 'Cubage m³' },
									]}
								/>
							</div>
							<ol className="list-decimal ml-12 mt-4 space-y-2">
								{data.cmrVehicles.map((cmrVehicle) => (
									<li
										key={cmrVehicle.id}
										className="font-mono"
									>
										{cmrVehicle.vehicle}, VIN{' '}
										{cmrVehicle.vin},{' '}
										{cmrVehicle.license_plate}
										<div className="text-sm italic">
											{cmrVehicle.notes}
										</div>
									</li>
								))}
							</ol>
						</div>
						<div className="grid grid-cols-2">
							<div>
								<div
									style={{ height: '75mm' }}
									className={`p-2 border-${config.borderSize} border-t-0 ${config.borderColor}`}
								>
									<BoxLegend
										index={13}
										languages={[
											{
												language: 'ro',
												text: 'Instrucțiunile expeditorului',
											},
											{
												language: 'en',
												text: "Sender's instructions",
											},
											{
												language: 'fr',
												text: "Instructions de l'expéditeur",
											},
										]}
									/>
								</div>
								<div
									style={{ height: '32mm' }}
									className={`p-2 border-${config.borderSize} border-t-0 ${config.borderColor}`}
								>
									<BoxLegend
										index={14}
										languages={[
											{
												language: 'ro',
												text: 'Instrucțiuni de plată',
											},
											{
												language: 'en',
												text: 'Instructions as to payment for carriage',
											},
											{
												language: 'fr',
												text: "Prescriptions d'affranchissement",
											},
										]}
									/>
									<BoxText>
										<BoxCheck label="Plata la expediere / Carriage paid / Port payé" />
									</BoxText>
									<BoxText className="mt-1">
										<BoxCheck label="Plata la destinatie / Carriage forward / Port dû" />
									</BoxText>
								</div>
								<div
									style={{ height: '20.4mm' }}
									className={`p-2 border-${config.borderSize} border-t-0 ${config.borderColor}`}
								>
									<BoxLegend
										index={21}
										languages={[
											{
												language: 'ro',
												text: 'Stabilit în',
											},
											{
												language: 'en',
												text: 'Established in',
											},
											{
												language: 'fr',
												text: 'Etablie à',
											},
										]}
									/>
								</div>
							</div>
							<div>
								<div
									style={{ height: '30mm' }}
									className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor}`}
								>
									<BoxLegend
										index={19}
										languages={[
											{
												language: 'ro',
												text: 'Convenții speciale',
											},
											{
												language: 'en',
												text: 'Special agreesments',
											},
											{
												language: 'fr',
												text: 'Conventions particulières',
											},
										]}
									/>
								</div>
								<div className="grid grid-cols-[50mm_1fr_1fr_1fr]">
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor}`}
									>
										<BoxLegend
											index={20}
											languages={[
												{
													language: 'ro',
													text: 'Plata prin',
												},
												{
													language: 'en',
													text: 'To be paid by',
												},
												{
													language: 'fr',
													text: 'A payer par',
												},
											]}
										/>
									</div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor}`}
									>
										<BoxLegend
											languages={[
												{
													language: 'ro',
													text: 'Expeditor',
												},
												{
													language: 'en',
													text: 'Sender',
												},
												{
													language: 'fr',
													text: 'Expéditeur',
												},
											]}
										/>
									</div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor}`}
									>
										<BoxLegend
											languages={[
												{
													language: 'ro',
													text: 'Monedă',
												},
												{
													language: 'en',
													text: 'Currency',
												},
												{
													language: 'fr',
													text: 'Monnaie',
												},
											]}
										/>
									</div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor}`}
									>
										<BoxLegend
											languages={[
												{
													language: 'ro',
													text: 'Destinatar',
												},
												{
													language: 'en',
													text: 'Consignee',
												},
												{
													language: 'fr',
													text: 'Destinataire',
												},
											]}
										/>
									</div>
								</div>

								<div className="grid grid-cols-[50mm_1fr_1fr_1fr]">
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									>
										Pret transport / Carriage charges / Prix
										de transport
									</div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									></div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									></div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									></div>
								</div>

								<div className="grid grid-cols-[50mm_1fr_1fr_1fr]">
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									>
										Sold / Balance / Solde
									</div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									></div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									></div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									></div>
								</div>

								<div className="grid grid-cols-[50mm_1fr_1fr_1fr]">
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									>
										Taxe suplimentare / Additional charges /
										Suppléments
									</div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									></div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									></div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									></div>
								</div>

								<div className="grid grid-cols-[50mm_1fr_1fr_1fr]">
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									>
										Alte taxe / Other charges / Autres taxes
									</div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									></div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									></div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									></div>
								</div>

								<div className="grid grid-cols-[50mm_1fr_1fr_1fr]">
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									>
										Total
									</div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									></div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									></div>
									<div
										className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor} text-gray-600 text-xs`}
									></div>
								</div>

								<div
									style={{ height: '18mm' }}
									className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor}`}
								>
									<BoxLegend
										index={15}
										languages={[
											{
												language: 'ro',
												text: 'Suma de plată',
											},
											{
												language: 'en',
												text: 'Cash on delivery',
											},
											{
												language: 'fr',
												text: 'Remboursement',
											},
										]}
									/>
								</div>
							</div>
						</div>
						<div
							style={{ height: '44mm' }}
							className="grid grid-cols-3"
						>
							<div
								className={`p-2 border-${config.borderSize} border-t-0 ${config.borderColor}`}
							>
								<BoxLegend
									index={22}
									languages={[
										{
											language: 'ro',
											text: 'Semnatura și stampila expeditorului',
										},
										{
											language: 'en',
											text: 'Signature and stamp of the sender',
										},
										{
											language: 'fr',
											text: "Signature et timbre de l'expéditeur",
										},
									]}
								/>
							</div>
							<div
								className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor}`}
							>
								<BoxLegend
									index={23}
									languages={[
										{
											language: 'ro',
											text: 'Semnatura și stampila transportatorului',
										},
										{
											language: 'en',
											text: 'Signature and stamp of the carrier',
										},
										{
											language: 'fr',
											text: 'Signature et timbre du transportateur',
										},
									]}
								/>
								<Image
									src="/images/star-stamp.png"
									alt="Star Office Signature"
									width={220}
									height={100}
									loading="eager"
									className="mx-auto my-2"
									style={{
										width: 'auto',
										height: 'auto',
										transform: 'rotate(-4deg)',
									}}
								/>
							</div>
							<div
								className={`p-2 border-${config.borderSize} border-t-0 border-l-0 ${config.borderColor}`}
							>
								<div className="flex">
									<div className="font-semibold text-lg leading-6 mr-2">
										{24}
									</div>
									<div className="flex flex-col gap-y-2">
										<div className="text-gray-600 text-xs">
											Marfa primita / Goods received /
											Marchandises reçues
										</div>
										<div className="text-gray-600 text-xs">
											Locul / Place / Lieu
										</div>
										<div className="text-gray-600 text-xs">
											Data / Date
										</div>
									</div>
								</div>
								<div className="flex justify-center mt-8">
									<BoxLegend
										languages={[
											{
												language: 'ro',
												text: 'Semnatura și stampila destinatarului',
											},
											{
												language: 'en',
												text: 'Signature and stamp of the consignee',
											},
											{
												language: 'fr',
												text: 'Signature et cachet du destinataire',
											},
										]}
									/>
								</div>
							</div>
						</div>
					</div>
					<div
						className={`flex items-center justify-center shrink-0`}
						style={{ width: '12mm' }}
					>
						<div className="[writing-mode:vertical-lr]">
							<ul className="list-disc leading-3 text-xs text-muted flex flex-col-reverse">
								<li className="mb-1">
									In cazul menționării unor mărfuri
									periculoase pe lângă un eventual certificat,
									pe ultima linie din rubrică redați clasa,
									cifra și litera
								</li>
								<li className="mb-1">
									In case of dangerous goods mention, besides
									the possible certification, on the last line
									of the column write the class, the number
									and the letter, if any
								</li>
								<li>
									En cas de mention de marchandises
									dangereuses en plus d'un éventuel
									certificat, sur la dernière ligne de la
									rubrique écrivez la classe, le chiffre et la
									lettre
								</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
