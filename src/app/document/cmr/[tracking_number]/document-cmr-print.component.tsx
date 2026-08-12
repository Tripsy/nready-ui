'use client';

import { SignaturePad, type SignaturePadRef } from '@siamf/react-signature-pad';
import { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';
import { displayCmrReference } from '@/models/cmr.model';
import { useToast } from '@/providers/toast.provider';
import { DocumentCmr, type DocumentCmrProps } from './document-cmr.component';

export function DocumentCmrPrint({
	documentProps,
}: {
	documentProps: DocumentCmrProps;
}) {
	const { showToast } = useToast();

	const [showSignature, setShowSignature] = useState(false);

	const contentRef = useRef<HTMLDivElement>(null);
	const signatureRef = useRef<SignaturePadRef>(null);

	const handlePrint = useReactToPrint({
		contentRef,
		documentTitle: displayCmrReference(
			documentProps.data.refCode,
			documentProps.data.refNumber,
		),
		pageStyle: `
            @page {
                size: 342.4mm 438mm;
            }
            @media print {
                body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            }
        `,
	});

	const handleInitSignature = () => {
		setShowSignature(true);
	};

	const handleSaveSignature = () => {
		if (signatureRef.current) {
			if (!signatureRef.current.hasContent()) {
				showToast({
					severity: 'error',
					summary: 'Error',
					detail: 'No signature provided',
				});

				return;
			}

			showToast({
				severity: 'success',
				summary: 'Success',
				detail: 'CMR has been signed with success',
			});

			// TODO: the drawn signature is not persisted — `signatureRef.export()`
			// yields the data URL, but there is no backend call to store it against
			// the CMR, so the toast above currently reports more than happened.
			setShowSignature(false);
		}
	};

	const handleCancelSignature = () => {
		setShowSignature(false);
	};

	return (
		<div className="relative">
			{documentProps.signed ? (
				// Print trigger — lives outside the printable area
				<div className="no-print fixed top-2 left-2 z-20">
					<Button variant="success" onClick={() => handlePrint()}>
						<Icons.Print />
						Print / Save PDF
					</Button>
				</div>
			) : (
				// Sign trigger — lives outside the printable area
				<div className="no-print fixed top-2 left-2 z-20">
					<Button
						variant="default"
						onClick={() => handleInitSignature()}
					>
						<Icons.Sign />
						Sign document
					</Button>
				</div>
			)}

			{showSignature && (
				<div className="fixed top-20 left-20 z-50 flex items-center justify-center bg-black/50">
					<div className="bg-white rounded-lg shadow-xl p-6">
						<h3 className="text-lg font-semibold mb-4 text-center">
							Sign Document
						</h3>
						<SignaturePad
							ref={signatureRef}
							canvasProps={{
								width: 500,
								height: 200,
								className: 'border border-gray-300 rounded',
							}}
							penColor="#000000"
							backgroundColor="#ffffff"
							showUndo={true}
							showClear={true}
						/>
						<div className="flex justify-center gap-4 mt-6">
							<Button
								variant="outline"
								onClick={handleCancelSignature}
							>
								Cancel
							</Button>
							<Button
								variant="success"
								onClick={handleSaveSignature}
							>
								Save Signature
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Printable area */}
			<div ref={contentRef}>
				<div className="print-scale-wrapper">
					<DocumentCmr
						signed={documentProps.signed}
						data={documentProps.data}
					/>
				</div>
			</div>
		</div>
	);
}
