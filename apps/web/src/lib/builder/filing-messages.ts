/** English UI copy for the filing step. Rule codes and params come from core. */
export const filingMessages = {
  documentSelector: "Document to prepare",
  title: "Handelsregisteranmeldung",
  formLabel: "Handelsregisteranmeldung data",
  previewCredit: "Draft based on",
  courtTitle: "Register court",
  courtDescription:
    "Enter the town of the Amtsgericht responsible for the registered seat.",
  addressTitle: "Geschäftsanschrift (business address)",
  paymentTitle: "Payment and assurances",
  paymentDescription:
    "Confirm the statements for the managing director appointed in the Musterprotokoll.",
  amountDescription: "Enter the amount already paid on the share.",
  amountFormat: "Enter an amount in euros, for example 12.500,50.",
  amountRange: "Enter an amount between 0 € and 999.999.999 €.",
  fundsDescription: "§ 8 Abs. 2 GmbHG",
  disqualificationDescription: "§ 8 Abs. 3 and § 6 Abs. 2 GmbHG",
  disclosureDescription: "§ 8 Abs. 3 GmbHG and § 53 Abs. 2 BZRG",
  attachmentsTitle: "Anlagen (attachments)",
  attachmentsDescription:
    "The Musterprotokoll also serves as the shareholder list.",
  evidenceDescription:
    "Select if a separate payment receipt accompanies the application.",
  fields: {
    "filing.registerCourt": {
      label: "Register court (Amtsgericht)",
      blank: "register court",
    },
    "filing.businessAddress.street": {
      label: "Street and number",
      blank: "street",
    },
    "filing.businessAddress.postalCode": {
      label: "German postcode",
      blank: "postcode",
    },
    "filing.businessAddress.city": { label: "Town or city", blank: "town" },
    "filing.paidCents": { label: "Amount paid", blank: "amount paid" },
    "filing.fundsAtFreeDisposal": {
      label: "The paid funds are definitively at the director’s free disposal",
      blank: "availability of funds",
    },
    "filing.noDisqualification": {
      label: "No statutory grounds disqualify the director",
      blank: "eligibility assurance",
    },
    "filing.instructedOnDisclosure": {
      label: "The director was instructed about the unlimited duty to disclose",
      blank: "disclosure instruction",
    },
    "filing.paymentEvidenceAttached": {
      label: "Payment evidence is attached",
      blank: "payment evidence",
    },
  },
} as const;
