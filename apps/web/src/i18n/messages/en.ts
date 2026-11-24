/**
 * English UI copy. It is the reference shape: `de.ts` must have exactly the
 * same keys, which the compiler and `catalogues.test.ts` enforce. German
 * terms of art stay where they are the precise term, with a short gloss.
 * Messages use ICU syntax (`{count, plural, …}`).
 */
export const en = {
  audit: {
    title: "Firm audit log",
    navLabel: "Audit log",
    intro:
      "Who changed documents and memberships in {firm}. The log records which fields changed, never their contents.",
    activity: "Activity",
    latest: "Last: {action}, {date}",
    recentOnly: "Showing the latest {count, number} entries.",
    openAudit: "View the full history in the audit log",
    emptyTitle: "No entries yet",
    emptyHelp:
      "Changes to documents and memberships in this firm will appear here.",
    emptyFiltered: "No entries match these filters",
    emptyFilteredHelp:
      "Choose another action or document, or reset the filters.",
    today: "Today",
    yesterday: "Yesterday",
    byPerson: "by {name}",
    byFormer: "by a former member",
    byNone: "by the system or a deleted account",
    former: "Former member",
    none: "System or deleted account",
    titleField: "Document title",
    fieldsLabel: "Fields:",
    moreFields: "and {count, number} more",
    member: "Member: {name}",
    statusChange: "Status: {from} → {to}",
    roleChange: "Role: {from} → {to}",
    roleNamed: "Role: {role}",
    accountDeleted: "The account was deleted.",
    exportDetails: "{document} as {format}",
    exportDocuments: {
      musterprotokoll: "Musterprotokoll",
      anmeldung: "Handelsregisteranmeldung",
    },
    importDetails:
      "{accepted, number} accepted, {edited, number} edited, {cleared, number} cleared (model {model}, prompt {version})",
    deletedDocument: "Deleted document",
    onlyDocument: "Show only this document",
    filters: "Filter the audit log",
    actionFilter: "Action",
    allActions: "All actions",
    documentFilter: "Document",
    allDocuments: "All documents",
    deletedDocumentId: "Deleted document ({id}…)",
    invalidDocument:
      "This link names no valid document. Choose a document from the list.",
    filter: "Apply filters",
    resetFilters: "Reset filters",
    entries: "Entries",
    pages: "Audit log pages",
    newer: "Newer entries",
    older: "Older entries",
    page: "Page {page, number}",
    statuses: {
      draft: "Draft",
      final: "Final",
    },
    actions: {
      document_created: "Document created",
      document_updated: "Document edited",
      document_deleted: "Document deleted",
      document_exported: "Document exported",
      document_imported: "Document imported",
      membership_added: "Member added",
      membership_role_changed: "Role changed",
      membership_removed: "Member removed",
      tenant_renamed: "Firm renamed",
    },
  },
  members: {
    title: "Members",
    intro:
      "{count, plural, one {# person has} other {# people have}} access to {firm}.",
    people: "People with access",
    you: "You",
    unknown: "Member without a display name",
    readOnlyTitle: "Only admins manage members",
    readOnlyBody:
      "You can see who has access to this firm. Ask an admin to invite someone or to change a role.",
    role: "Role",
    roleOf: "Role of {name}",
    roleHelp: {
      admin:
        "Everything an editor can do, plus members, invitations, and the audit log.",
      editor: "Creates, edits, imports, and deletes documents.",
      viewer: "Opens and downloads documents.",
    },
    email: "Invitee email address",
    create: "Create invitation",
    creating: "Creating…",
    createdTitle: "Invitation for {email} created",
    createdBody:
      "Copy the link now and send it to the invitee. It is shown only once.",
    copy: "Copy link",
    link: "Invitation link",
    copied: "Link copied to the clipboard.",
    copiedShort: "Copied",
    copyManually: "Copying failed. Select the link and copy it manually.",
    invitations: "Invitations",
    inviteHelp:
      "Urkundenwerk sends no email. Create the invitation, then copy the link and send it yourself. It is valid for seven days, works once, and only for an account with the invited email address.",
    inviteDemo: "In the hosted demo, the invitee needs an existing account.",
    pending: "Open invitations",
    pendingDetails: "{role}, valid until {date}",
    noPending: "No open invitations",
    noPendingHelp:
      "Invitations you create appear here until they are accepted, revoked, or expire.",
    revoke: "Revoke",
    revoking: "Revoking…",
    confirmRevokeTitle: "Revoke the invitation for {email}?",
    confirmRevokeBody:
      "The link stops working at once. You can create a new invitation later.",
    revoked: "Invitation revoked.",
    revokedNamed: "The invitation for {email} was revoked.",
    saveRole: "Save role",
    saving: "Saving…",
    roleSaved: "Role saved.",
    remove: "Remove",
    leave: "Leave firm",
    removing: "Removing…",
    confirmRemoveTitle: "Remove {name} from {firm}?",
    confirmRemoveBody:
      "They lose access to the firm’s documents at once. Their past activity stays in the audit log, and you can invite them again later.",
    confirmLeaveTitle: "Leave {firm}?",
    confirmLeaveBody:
      "You lose access to the firm’s documents at once. An admin has to invite you again before you can return.",
    cancel: "Cancel",
    removed: "Member removed.",
    removedNamed: "{name} was removed from the firm.",
    forbidden: "Only firm admins can manage members and invitations.",
    invalid: "Check the email address and role.",
    quota: "You can create up to ten invitations per hour. Try again later.",
    duplicate: "This person is already a member or has a pending invitation.",
    lastAdmin:
      "Assign another admin before removing or changing the role of the last admin.",
    protectedAdmin:
      "The shared demo admin keeps the admin role in the sandbox firm. The nightly reset restores all other changes.",
    failed: "The change could not be saved. Refresh the page and try again.",
  },
  invite: {
    title: "Accept firm invitation",
    body: "Accept with the account whose email address the firm invited.",
    signedInAs: "Signed in as <strong>{email}</strong>",
    redirecting: "Taking you to sign-in…",
    signIn: "Sign in to continue",
    accept: "Accept invitation",
    accepting: "Accepting…",
    invalid:
      "This invitation is unavailable for your account. Check the email address you are signed in with or ask the firm for a new link.",
    unavailableTitle: "This invitation cannot be accepted",
    reasons: {
      email:
        "You are signed in with a different email address than the one invited.",
      expired: "The invitation has expired or was revoked.",
      used: "The link has already been used.",
    },
    unavailableHelp:
      "Sign in with the invited address, or ask the firm for a new link.",
    missingTitle: "No invitation link found",
    missingBody:
      "Open the complete link the firm sent you. It ends with a long code after the # sign.",
    toDocuments: "Go to your documents",
  },
  account: {
    title: "Account",
    signedInAs: "Signed in as {email}",
    dataTitle: "Your data",
    dataHelp:
      "Download a copy of the personal data Urkundenwerk keeps about you, as a JSON file.",
    dataIncludes: "The file contains",
    dataItems: {
      profile: "Your profile",
      memberships: "Your firm memberships and roles",
      invitations: "Invitations you created",
      events: "Audit entries attributed to you",
      drafts: "IDs and titles of drafts you created",
    },
    dataExcludes:
      "Document contents are not included, because they belong to the firm.",
    download: "Download my data",
    deleteTitle: "Delete account",
    deleteHelp: "Deleting your account cannot be undone.",
    deleteEffectsTitle: "What happens",
    deleteEffects: {
      account: "Your account and sign-in details are deleted.",
      memberships: "Your memberships in all firms end.",
      drafts: "Drafts stay with firms that continue.",
      audit: "Audit entries remain, without your name.",
    },
    delete: "Delete my account",
    deleteFinal: "Delete account permanently",
    deleting: "Deleting…",
    cancel: "Cancel",
    confirmTitle: "Delete your account permanently?",
    protectedTitle: "This demo account is protected",
    protected:
      "Shared demo accounts cannot be deleted, so that every visitor finds the same sample firms. You can still download your data.",
    confirm: "I want to permanently delete my account.",
    soleFirmsTitle: "Firms that will be deleted",
    soleFirms:
      "You are the only member of these firms. Deleting your account also deletes them, with all their drafts and audit history.",
    confirmSole:
      "I also want to permanently delete these firms and their drafts.",
    confirmRequired: "Confirm that you want to delete your account.",
    confirmFirms:
      "Reload the page to review and confirm deletion of the firms where you are the only member.",
    lastAdmin:
      "You are the last admin of a firm with other members. Assign another admin on the Members page before deleting your account.",
    failed: "Your account could not be deleted. Try again.",
  },
  legal: {
    nav: "Legal information",
    privacyTitle: "Privacy notice",
    imprintTitle: "Legal notice",
    contents: "Contents",
    toImprint: "Go to the legal notice",
    toPrivacy: "Go to the privacy notice",
    provider: "Service provider",
    email: "Email:",
    unconfigured: "No legal notice has been set up yet",
    unconfiguredHelp:
      "The operator of this installation has not yet entered their provider details.",
    unconfiguredOperator:
      "Operators set <code>IMPRESSUM_NAME</code>, <code>IMPRESSUM_ADDRESS</code>, and <code>IMPRESSUM_EMAIL</code> on the server.",
    intro:
      "Urkundenwerk is a public demonstration. Use fictional case data and upload fictional documents only.",
    sections: {
      controller: {
        title: "Controller and contact",
        body: "The operator identified in the legal notice is responsible for this demonstration. Use the email address there for data protection requests.",
      },
      processing: {
        title: "What the demo processes",
        body: "The demo processes account details and firm roles to provide access. It records document and membership activity for security and accountability, and processes technical request data to operate and protect the service. The demo relies on the operator’s legitimate interests in making the demonstration available and preventing abuse (Article 6(1)(f) GDPR). People who send invitations supply the recipient email address.",
      },
      providers: {
        title: "Hosting and AI providers",
        body: "Supabase provides authentication and the database in the EU. Vercel hosts the site and runs its server functions in Frankfurt, Germany. OpenAI processes fictional contract text and selected fictional draft data when you request an AI feature. Provider processing, including AI requests, may take place outside the EU. The demo’s EU hosting settings apply to the primary database and web compute.",
      },
      cookies: {
        title: "Cookies and browser storage",
        body: "The application uses cookies for sign-in, the selected firm during the session, and your language preference. The language cookie lasts up to one year. An invitation link is kept in the current tab’s session storage until it is accepted or the tab closes. The application uses no analytics or advertising cookies.",
      },
      retention: {
        title: "Retention",
        body: "The demo resets drafts in its sample firms nightly and prunes audit events older than 90 days. Invitations expire after seven days and their records are removed 90 days after expiry. Account data is kept while the account is active. An erasure removes your account from the live database and clears the account reference from retained audit events. Drafts in continuing firms remain with the firm. Provider logs and backups follow their own retention schedules.",
      },
      rights: {
        title: "Your rights",
        body: "Under the GDPR you may request access, rectification, erasure, restriction or portability, and may object to processing where the relevant conditions apply. You can also complain to a data protection supervisory authority. In Account you can download your data or request account deletion. Contact the operator for other requests and for data outside that download.",
      },
    },
  },
  metadata: {
    description:
      "A document builder for German law firms that assembles the statutory Musterprotokoll from structured case data.",
    login: "Sign in",
    signup: "Create account",
    documents: "Documents",
    document: "Musterprotokoll",
    import: "Import from contract",
    notFound: "Page not found",
  },
  common: {
    appNavigation: "Application navigation",
    serviceUnavailable: "The server is missing valid Supabase configuration.",
    demoNotice:
      "Demonstration project. Not legal advice. Uses fictional data only.",
    demoNoticeLabel: "Demonstration notice",
    documents: "Documents",
    backToDocuments: "Back to your documents",
    optional: "Optional",
    show: "Show",
    signOut: "Sign out",
    firm: "Firm",
    switchFirm: "Switch",
  },
  language: {
    label: "Language",
    de: "Deutsch",
    en: "English",
  },
  notFound: {
    title: "Page not found",
    body: "This address does not lead to a page of Urkundenwerk.",
    home: "Go to the start page",
  },
  landing: {
    lede: "Prepare the Musterprotokoll for a single-founder GmbH or UG from structured case data, and download it ready for signature.",
    points: {
      wording: {
        title: "Statutory wording, word for word",
        body: "The deed text of {legalBasis} comes from a versioned template. The app collects data and never writes legal text.",
      },
      checks: {
        title: "Checked while you type",
        body: "Missing details and rules such as the GmbH minimum capital or a UG's full payment show up next to the field.",
      },
      exports: {
        title: "PDF and DOCX for signature",
        body: "Both exports render the same document model, set in A4 with closing and signature lines.",
      },
      firms: {
        title: "Each firm on its own",
        body: "Drafts are isolated per law firm by row-level security in Postgres. Viewers can read, editors can write.",
      },
    },
    signIn: "Sign in to the demo",
    signUp: "Create a firm account",
    disclaimer:
      "Urkundenwerk is a portfolio project, not a product. It gives no legal advice and works with fictional people and firms only.",
    excerpt: "Excerpt of a generated Musterprotokoll",
  },
  auth: {
    email: "Email address",
    password: "Password",
    firmName: "Firm name",
    login: {
      title: "Sign in",
      submit: "Sign in",
      pending: "Signing in…",
      newHere: "New here?",
      signupLink: "Create an account for your firm",
      demoAccounts: "Fictional demo accounts",
      signInAs: "Sign in as this user",
      demoPassword: "Password for all demo accounts:",
      accounts: {
        erik: "Editor, Demo-Kanzlei Nord",
        victor: "Viewer, Demo-Kanzlei Nord",
        sara: "Admin, Demo-Kanzlei Süd",
        saraSandbox: "Admin, Demo-Kanzlei West sandbox, reset nightly",
        mia: "Editor in Nord and viewer in Süd",
      },
    },
    signup: {
      title: "Create an account",
      intro:
        "You become the admin of a new firm workspace. Use fictional data only.",
      submit: "Create account",
      pending: "Creating account…",
      registered: "Already registered?",
      loginLink: "Sign in",
    },
    errors: {
      emailRequired: "Enter your email address.",
      emailInvalid: "Enter a valid email address.",
      passwordRequired: "Enter your password.",
      passwordTooLong: "The password is too long.",
      passwordChoose: "Choose a password.",
      passwordShort: "Use at least {min, number} characters.",
      passwordLong: "Use at most {max, number} characters.",
      firmRequired: "Enter the name of your firm.",
      firmShort: "The firm name needs at least {min, number} characters.",
      firmLong: "The firm name can have at most {max, number} characters.",
      invalidCredentials: "The email address or password is incorrect.",
      signInFailed: "Signing in failed. Please try again.",
      weakPassword: "Choose a stronger password.",
      signUpFailed: "We could not create an account with these details.",
      confirmEmail:
        "Confirm your email address, then sign in to finish setting up your firm.",
      firmFailed: "The firm could not be created. Please try again.",
      firmLimit: "You can create up to three firms.",
      demoFirmDisabled: "Shared demo accounts cannot create firms.",
    },
  },
  roles: {
    admin: "Admin",
    editor: "Editor",
    viewer: "Viewer",
  },
  dashboard: {
    setupTitle: "Set up your firm",
    setupFailed:
      "Your account was created, but setting up your firm failed. Please try again.",
    setupIntro:
      "You are not a member of a firm yet. Create one to start drafting. You become its admin and can invite colleagues later.",
    createFirm: "Create firm",
    creating: "Creating…",
    yourRole: "Your role: {role}.",
    canEdit: "You can create, edit, and delete documents.",
    canRead: "You can open and download documents.",
    importContract: "Import from contract",
    newDocument: "New Musterprotokoll",
    heading: "Documents",
    emptyTitle: "No documents yet",
    emptyEditor:
      "Start a Musterprotokoll for a single-founder GmbH or UG. The deed fills in as you enter the case data.",
    emptyViewer:
      "Documents that editors in this firm create will be listed here.",
    columns: {
      title: "Title",
      status: "Status",
      changed: "Last changed",
      actions: "Actions",
    },
    templateLabel: "Musterprotokoll, single founder",
    draft: "Draft",
    final: "Final",
    needsReview: "Needs review",
    ready: "Ready to export",
    outstanding:
      "{count, plural, one {# field to complete} other {# fields to complete}}",
    delete: "Delete",
    deleting: "Deleting…",
    confirmDeleteTitle: "Delete “{title}”?",
    confirmDeleteBody:
      "The draft and its case data are removed for everyone in {firm}, and this cannot be undone. The audit log keeps a record of the deletion.",
    cancel: "Cancel",
    deleted: "“{title}” was deleted.",
  },
  documents: {
    defaultTitle: "Untitled Musterprotokoll",
    errors: {
      notAllowed:
        "This document was not found, or you do not have permission to change it.",
      chooseFirm: "Choose a firm first.",
      cannotCreate: "Your role in this firm does not allow creating documents.",
      invalid: "The request is invalid.",
      titleRequired: "Enter a title.",
      titleLong: "The title can have at most {max, number} characters.",
      draftTooLarge: "The draft exceeds {size, number} KiB.",
      draftInvalid: "The draft contains values that cannot be saved.",
      notFound: "This document was not found.",
      notExplainable: "These issues cannot be explained.",
      aiOff: "AI explanations are turned off.",
      rateLimited:
        "You can ask for {count, number} explanations a minute. Try again shortly.",
    },
    notFound: {
      title: "Document not found",
      body: "This document does not exist, or it belongs to a firm you are not a member of.",
    },
  },
  builder: {
    documentTitle: "Document title",
    templateIn: "{template} in {firm}",
    documentSelector: "Document to prepare",
    documents: {
      musterprotokoll: "Musterprotokoll",
      anmeldung: "Handelsregisteranmeldung",
    },
    musterprotokollForm: "Musterprotokoll data",
    anmeldungForm: "Handelsregisteranmeldung data",
    save: {
      savedAt: "Saved at {time}",
      saved: "All changes saved",
      unsaved: "Unsaved changes",
      saving: "Saving…",
      failed: "Not saved.",
      connection: "The connection failed. Check your network and retry.",
      retry: "Retry",
      flushFirst: "Save the latest changes before downloading.",
    },
    ready: "Ready to export",
    outstanding:
      "{count, plural, one {# field to complete} other {# fields to complete}}",
    download: "Download {format}",
    panes: { form: "Form", preview: "Preview" },
    preview: "Preview",
    imported: {
      title: "Created from an imported contract",
      body: "The values you accepted are filled in. Complete the rest here; the checks below apply to imported values like any others.",
    },
    readOnly: {
      title: "Read only",
      body: "You can read and download this document. Editing needs the editor or admin role in {firm}.",
    },
    stillMissing: "Still missing",
    previewNote: {
      musterprotokoll: "Wording of {legalBasis}, version {version}.",
      anmeldung: "Draft based on {legalBasis}, version {version}.",
      values:
        "Values in blue come from the form; select one to edit it. Page breaks are set in the PDF.",
    },
    section: {
      complete: "Complete",
      outstanding: "{count, number} to complete",
    },
    sections: {
      notarisation: {
        title: "Notarisation",
        description:
          "Details you leave empty print as dotted lines, to be completed by hand at the appointment.",
      },
      founder: {
        title: "Founder (Gesellschafter)",
        description: "The Musterprotokoll allows exactly one founder.",
      },
      company: { title: "Company" },
      capital: { title: "Capital" },
      director: {
        title: "Geschäftsführer (managing director)",
        description:
          "Exempt from the restrictions of § 181 BGB, as the Musterprotokoll prescribes.",
      },
      notes: { title: "Notary's notes" },
    },
    hints: {
      video:
        "The deed adds “mittels Videokommunikation” and ends after clause 7; signing happens electronically.",
      salutation:
        "Used in the deed's wording, for example “Herrn” in clause 3.",
      entityDetails:
        "Added after the register details, for example “vertreten durch …”.",
      personDetails:
        "Added after the address, for example how the founder was identified.",
      legalForm: "Legal form: {form}.",
      legalFormMissing: "End with “GmbH” or “UG (haftungsbeschränkt)”.",
      purpose: "Completes the sentence “Gegenstand des Unternehmens ist …”.",
      capital: "Whole euros. The deed also writes the amount out in words.",
      capitalGmbh:
        "A GmbH needs at least €25,000, of which half may be paid at formation.",
      capitalUg: "A UG (haftungsbeschränkt) has €1 to €24,999, paid in full.",
      halfUg: "Not available for a UG (haftungsbeschränkt).",
      directorQuestion: "Who is appointed?",
      directorEntity: "Only possible when the founder is a natural person.",
      directorNamed: "{name} is appointed.",
      directorFounder: "Uses the founder's name, date of birth, and town.",
      notes:
        "Completes clause 7: “insbesondere auf Folgendes hingewiesen: …”. Leave empty to add the notes by hand.",
      dateFormat: "Format: {pattern}",
    },
    placeholders: {
      deedNumber: "123/2026",
      registerCourt: "Amtsgericht Musterstadt",
      registerNumber: "HRB 12345",
      companyName: "Musterlicht Software GmbH",
      seat: "Musterstadt",
      purpose: "die Entwicklung und der Vertrieb von Software",
    },
    euro: {
      wholeFormat: "Enter whole euros, for example 25,000.",
      wholeRange: "Enter an amount between €1 and €999,999,999.",
      centsFormat: "Enter an amount in euros, for example 12,500.50.",
      centsRange: "Enter an amount between €0 and €999,999,999.",
    },
    date: {
      format: "Enter the date as {pattern}, for example {example}.",
      date: "This day does not exist. Check the day and month.",
      range: "Enter a year between 1900 and 2099.",
    },
  },
  filing: {
    courtTitle: "Register court",
    courtDescription:
      "Enter the town of the Amtsgericht responsible for the registered seat.",
    addressTitle: "Geschäftsanschrift (business address)",
    paymentTitle: "Payment and assurances",
    paymentDescription:
      "Confirm the statements for the managing director appointed in the Musterprotokoll.",
    amountDescription: "Enter the amount already paid on the share.",
    fundsDescription: "§ 8 Abs. 2 GmbHG",
    disqualificationDescription: "§ 8 Abs. 3 and § 6 Abs. 2 GmbHG",
    disclosureDescription: "§ 8 Abs. 3 GmbHG and § 53 Abs. 2 BZRG",
    attachmentsTitle: "Anlagen (attachments)",
    attachmentsDescription:
      "The Musterprotokoll also serves as the shareholder list.",
    evidenceDescription:
      "Select if a separate payment receipt accompanies the application.",
  },
  fields: {
    notarisation: {
      mode: { label: "Form of notarisation", blank: "form" },
      deedNumber: { label: "Deed number (UR. Nr.)", blank: "deed no." },
      date: { label: "Date of notarisation", blank: "date" },
      notaryName: { label: "Notary", blank: "notary" },
      notarySeat: { label: "Official seat (Amtssitz)", blank: "Amtssitz" },
    },
    founder: {
      kind: { label: "The founder is", blank: "founder" },
      salutation: { label: "Salutation", blank: "salutation" },
      firstName: { label: "First name", blank: "first name" },
      lastName: { label: "Last name", blank: "last name" },
      birthDate: { label: "Date of birth", blank: "date of birth" },
      address: {
        street: { label: "Street and number", blank: "street" },
        postalCode: { label: "Postcode", blank: "postcode" },
        city: { label: "Town or city", blank: "town" },
      },
      name: { label: "Name of the entity", blank: "entity" },
      registerCourt: { label: "Register court", blank: "register court" },
      registerNumber: { label: "Register number", blank: "register no." },
      seat: { label: "Seat of the entity", blank: "seat" },
      identificationDetails: {
        label: "Identification details",
        blank: "identification",
      },
    },
    company: {
      name: { label: "Firma (company name)", blank: "Firma" },
      seat: { label: "Sitz (registered seat)", blank: "Sitz" },
      purpose: {
        label: "Unternehmensgegenstand (business purpose)",
        blank: "Unternehmensgegenstand",
      },
    },
    shareCapitalCents: {
      label: "Stammkapital (share capital)",
      blank: "Stammkapital",
    },
    contribution: { label: "Payment of the contribution", blank: "payment" },
    managingDirector: {
      kind: {
        label: "Geschäftsführer (managing director)",
        blank: "Geschäftsführer",
      },
      salutation: { label: "Salutation", blank: "salutation" },
      firstName: { label: "First name", blank: "first name" },
      lastName: { label: "Last name", blank: "last name" },
      birthDate: { label: "Date of birth", blank: "date of birth" },
      residence: { label: "Place of residence", blank: "residence" },
    },
    notaryNotes: { label: "Notary's notes (Hinweise)", blank: "notes" },
    filing: {
      registerCourt: {
        label: "Register court (Amtsgericht)",
        blank: "register court",
      },
      businessAddress: {
        street: { label: "Street and number", blank: "street" },
        postalCode: { label: "German postcode", blank: "postcode" },
        city: { label: "Town or city", blank: "town" },
      },
      paidCents: { label: "Amount paid", blank: "amount paid" },
      fundsAtFreeDisposal: {
        label:
          "The paid funds are definitively at the director’s free disposal",
        blank: "availability of funds",
      },
      noDisqualification: {
        label: "No statutory grounds disqualify the director",
        blank: "eligibility assurance",
      },
      instructedOnDisclosure: {
        label:
          "The director was instructed about the unlimited duty to disclose",
        blank: "disclosure instruction",
      },
      paymentEvidenceAttached: {
        label: "Payment evidence is attached",
        blank: "payment evidence",
      },
    },
  },
  options: {
    // A non-breaking space keeps the paragraph sign with its number.
    mode: { in_person: "In person", video: "By video (§ 16a BeurkG)" },
    founderKind: {
      natural_person: "Natural person",
      legal_entity: "Legal entity",
    },
    salutation: { Herr: "Herr", Frau: "Frau", none: "No salutation" },
    contribution: {
      full: "In full, immediately",
      half: "50 % now, the rest when called in",
    },
    directorKind: { founder: "The founder", other: "Another person" },
  },
  preview: {
    edit: "{value}, edit {field}",
    missing: "Missing: {field}",
  },
  checks: {
    title: "Checks",
    intro: "Rules for {legalBasis}, run as you type.",
    explainAll: "Explain all",
    allPass: "All checks pass",
    groups: {
      error: { title: "To correct", description: "These block the download." },
      warning: {
        title: "Worth checking",
        description: "Registry courts may object.",
      },
      info: { title: "Notes", description: "No action needed." },
    },
    goTo: "Go to {field}",
    explain: "Explain",
    retry: "Try again",
    loading: "Writing an explanation…",
    loadFailed: "The explanation could not be loaded. Try again.",
    dailyBudget:
      "The demo has reached its daily AI limit. Try again after midnight UTC.",
    ruleSummary:
      "The rule's own summary. An AI explanation is not available right now.",
    aiLabel: "AI-generated explanation — not legal advice",
    suggestedFix: "Suggested fix:",
    modelInfo: "Model {model}, prompt {prompt}",
    unknownModel: "unknown",
    aiOff:
      "AI explanations are turned off on this server. Each check still names its legal basis.",
  },
  rules: {
    field_required: {
      required: "Required to complete the deed.",
      choice: "Choose one of the options.",
      summary:
        "The Musterprotokoll must be completed with every value its wording requires before it can be used.",
    },
    field_invalid: {
      required: "Required to complete the deed.",
      choice: "Choose one of the options.",
      amount: "Enter an amount between €1 and €999,999,999.",
      date: "Enter a valid date.",
      summary:
        "Every value in the Musterprotokoll must have the expected form, such as a valid date or an amount within range.",
    },
    company_legal_form_suffix: {
      message: "End the Firma with “GmbH” or “UG (haftungsbeschränkt)”.",
      summary:
        "The Firma must carry the legal form: “GmbH” or “Gesellschaft mit beschränkter Haftung”, or for a UG “UG (haftungsbeschränkt)” or “Unternehmergesellschaft (haftungsbeschränkt)”.",
    },
    share_capital_whole_euros: {
      message: "Use whole euros.",
      summary:
        "The nominal amount of each share must be in whole euros; the Musterprotokoll has one share covering the whole Stammkapital.",
    },
    gmbh_capital_minimum: {
      message: "A GmbH needs a Stammkapital of at least {minimum}.",
      summary:
        "A GmbH needs a Stammkapital of at least 25,000 euros; below that, the company must be founded as a UG (haftungsbeschränkt).",
    },
    ug_capital_below_gmbh_minimum: {
      message:
        "A UG (haftungsbeschränkt) has less than {minimum} Stammkapital. From {minimum} on, found a GmbH instead.",
      summary:
        "Only a company founded with less than 25,000 euros Stammkapital is a UG (haftungsbeschränkt); with more, it must be named a GmbH.",
    },
    ug_contribution_full: {
      message:
        "A UG (haftungsbeschränkt) must be paid in full before registration (§ 5a Abs. 2 GmbHG).",
      summary:
        "A UG (haftungsbeschränkt) may only be registered once its Stammkapital is paid in full.",
    },
    contribution_minimum_payment: {
      message:
        "Paying 50 % now does not reach the {required} that must be paid before registration. Choose payment in full.",
      summary:
        "Before registration, at least a quarter of each share and in total at least half of the minimum Stammkapital (12,500 euros) must be paid in cash.",
    },
    formation_costs_capped: {
      message:
        "With less than {cap} Stammkapital, the company bears formation costs only up to the Stammkapital (clause 5). The founder bears the rest.",
      summary:
        "Clause 5 lets the company bear formation costs up to 300 euros, but never more than its Stammkapital; the founder bears the rest.",
    },
    company_purpose_specific: {
      message:
        "This Unternehmensgegenstand is likely too general for the register court. Name the goods or services, for example “der Handel mit Fahrrädern und Zubehör”.",
      summary:
        "The Unternehmensgegenstand must show the main area of business; registry courts reject stock phrases that would fit any company.",
    },
    director_founder_natural_person: {
      message:
        "Only a natural person can be Geschäftsführer. Appoint another person.",
      summary:
        "Only a natural person can be Geschäftsführer, so a founder that is a legal entity must appoint someone else.",
    },
    director_full_age: {
      message:
        "The Geschäftsführer must be at least {age, number} on the date of notarisation (§ 6 Abs. 2 GmbHG).",
      summary:
        "A Geschäftsführer must have unrestricted legal capacity, which a minor never has; the person must be 18 by the date of notarisation.",
    },
    founder_minor: {
      message:
        "The founder is under {age, number}. Their legal representatives act for them, and the formation may need the family court's approval.",
      summary:
        "A founder under 18 is represented by their legal representatives, and a company agreement for running a business may need the approval of the family court.",
    },
    birth_date_not_in_future: {
      message: "A date of birth cannot lie in the future.",
      summary:
        "The deed must identify each person beyond doubt, and a date of birth in the future cannot be correct.",
    },
    notarisation_date_plausible: {
      past: "This date lies more than {days, number} days in the past. Check it.",
      future: "This date lies more than a year ahead. Check it.",
      summary:
        "The deed should state the day of notarisation; a date more than 30 days ago or more than a year ahead is probably a typing error.",
    },
    filing_court_required: {
      message: "Enter the town of the Amtsgericht.",
      summary: "Name the register court for the company's registered seat.",
    },
    filing_business_address: {
      postcode: "Enter a five-digit German postcode.",
      address: "Complete the domestic business address.",
      summary:
        "The application must state a complete domestic business address.",
    },
    filing_payment_minimum: {
      missing: "Enter the amount paid in euros.",
      below:
        "The paid amount is below the statutory minimum of {minimum} for registration.",
      summary:
        "The paid amount must meet the statutory threshold before registration.",
    },
    filing_payment_matches_deed: {
      message:
        "Enter an amount between the payment due under the deed ({due}) and the share capital ({capital}).",
      summary:
        "The paid amount must cover the immediate payment agreed in the deed and cannot exceed the subscribed capital.",
    },
    filing_director_appointed_in_deed: {
      message:
        "Complete the identity of the director appointed in the Musterprotokoll.",
      summary:
        "The filing director must be the person appointed in clause 4 of the deed.",
    },
    filing_funds_at_free_disposal: {
      message:
        "Confirm that the paid funds are definitively at the director's free disposal.",
      summary:
        "Confirm that the paid funds are definitively at the director's free disposal.",
    },
    filing_no_disqualification: {
      message:
        "Confirm that no statutory disqualification applies to the appointed director.",
      summary:
        "Confirm that no statutory disqualification applies to the appointed director.",
    },
    filing_disclosure_instruction: {
      message:
        "Confirm that the director was instructed about the unlimited duty to disclose to the court.",
      summary:
        "Confirm that the director was instructed about the unlimited duty to disclose to the court.",
    },
  },
  import: {
    title: "Import from a contract",
    unavailable: {
      roleTitle: "Importing needs the editor or admin role",
      roleBody:
        "Your role in {firm} is {role}. Ask an admin of the firm to change it if you need to import contracts.",
      noFirm: "Create or join a firm first.",
      aiTitle: "AI extraction is not configured on this server",
      aiBody:
        "Importing reads a contract with an AI model, and this server has no model set up. You can still start a new Musterprotokoll and fill it in by hand. To try the import locally, set <code>ANTHROPIC_API_KEY</code>, <code>OPENAI_API_KEY</code>, or <code>AI_PROVIDER=fake</code> in <code>apps/web/.env.local</code>.",
    },
    intro:
      "Upload an existing formation deed or articles of association. An AI model proposes values for a new Musterprotokoll in {firm} and quotes the passage each one comes from. You review every value, and nothing is saved until you create the draft.",
    reading:
      "Reading the document and extracting values. This usually takes under a minute.",
    seconds: "{seconds, number} s",
    drop: "Drop a PDF or DOCX here, or <choose>choose a file</choose>",
    dropHint:
      "A text-based PDF or a DOCX, up to {size, number} MB. Scans cannot be read yet.",
    samples: {
      title: "Try it with a fictional sample",
      musterprotokoll: "Use sample Musterprotokoll ({format})",
      articles: "Use sample articles of association ({format})",
      download: "Download sample ({format})",
    },
    privacy: {
      title: "What happens to the document",
      fake: "This server uses scripted extraction for testing. The document text does not leave the server, and no AI model reads it.",
      provider:
        "The document's text is sent to {provider}'s API, model <code>{model}</code>, to extract the values. Use fictional documents in this demo.",
      storage:
        "Urkundenwerk does not store the file or its text. Only the values you accept are saved, in a new draft.",
      accuracy:
        "The AI may be wrong. Each value shows its source passage, and our code checks that the passage exists and states the value.",
    },
    sizeKb: "{size} KB",
    sizeMb: "{size} MB",
    errors: {
      notAllowed:
        "Importing contracts needs the editor or admin role in this firm.",
      disabled: "AI extraction is not configured on this server.",
      unknownSample: "This fictional sample is unavailable.",
      rateLimited:
        "You can import {count, number} contracts every {minutes, number} minutes. Try again shortly.",
      invalidDraft:
        "Some accepted values are not valid for the Musterprotokoll.",
      network:
        "The upload did not reach the server. Check your connection and the file, then try again.",
      oneFile: "Drop one file at a time.",
    },
    upload: {
      missing: "Choose a PDF or DOCX file to import.",
      type: "Only PDF and DOCX files can be imported. Export the contract as PDF or DOCX and try again.",
      empty: "The file is empty. Choose the contract again.",
      size: "The file is larger than {size, number} MB. Upload the formation deed or the articles on their own.",
    },
    ingestion: {
      FILE_TOO_LARGE:
        "The file is larger than {size, number} MB. Upload the formation deed or the articles on their own.",
      UNSUPPORTED_FORMAT:
        "Only PDF and DOCX files can be imported. Export the contract as PDF or DOCX and try again.",
      INVALID_LIMIT: "The upload size limit must be a positive integer.",
      INVALID_PDF: "The PDF could not be read.",
      PDF_ENCRYPTED:
        "Export an unencrypted copy of the PDF and upload it again.",
      PDF_PAGE_LIMIT: "The PDF exceeds the 30-page limit.",
      PDF_NO_TEXT:
        "This PDF has no text layer, which usually means it is a scan. Scanned documents cannot be imported yet; use a PDF exported from a word processor or a DOCX.",
      INVALID_DOCX: "The DOCX could not be read.",
      DOCX_ARCHIVE_LIMIT:
        "The DOCX contains too many entries or expands beyond the size limit.",
      DOCX_NO_TEXT: "The DOCX body contains no extractable text.",
      TEXT_LIMIT: "The document contains too much text to extract.",
    },
    extraction: {
      DOCUMENT_TOO_LONG:
        "The document is too long for AI extraction. Upload the formation deed or the articles on their own.",
      timeout: "The AI took too long to answer. Try again in a moment.",
      rate_limited: "The AI service is busy. Try again in a minute.",
      daily_budget:
        "The demo has reached its daily AI limit. Try again after midnight UTC.",
      unavailable: "The AI service is unavailable. Try again later.",
      unauthorized: "The AI service is not set up correctly on this server.",
      rejected: "The AI service rejected the request.",
      refused: "The AI declined to extract data from this document.",
      truncated: "The AI's answer was cut off. Try a shorter document.",
      invalid_output:
        "The AI's answer did not have the expected form. Try again.",
      aborted: "The extraction was cancelled.",
    },
  },
  review: {
    title: "Review extracted values",
    from: "From {file}",
    progress: {
      none: "No values found",
      done: "All {count, number} values decided",
      pending: "{pending, number} of {count, number} values to decide",
    },
    acceptAll: "Accept all verified",
    create: "Create draft",
    creating: "Creating draft…",
    panes: { fields: "Values", source: "Document" },
    aiNotice: {
      title: "AI-extracted — review every value; not legal advice",
      body: "{model} proposed these values with prompt {prompt}. Urkundenwerk checked each quote against the document. Verified means the passage exists and states the value, not that it is the right value for the deed.",
    },
    suspicious: {
      title: "The document contains instructions to an AI",
      body: "Some passages read like instructions to an AI rather than contract text. Values quoted from them are not verified. Check the document's origin.",
    },
    empty: {
      title: "No values found",
      body: "The model found nothing for a Musterprotokoll in this document. Try the formation deed or the articles of association.",
      another: "Choose another file",
    },
    sections: {
      notarisation: "Notarisation",
      founder: "Founder (Gesellschafter)",
      company: "Company",
      capital: "Capital",
      director: "Geschäftsführer (managing director)",
      notes: "Notary's notes",
    },
    nothingFound: "Nothing found",
    found: "{count, number} found",
    absent:
      "Not found in the document: {fields}. You can fill these in the builder.",
    importAnother: "Import another file",
    summary:
      "{count, plural, one {The draft gets the # value you accepted or edited.} other {The draft gets the # values you accepted or edited.}} The builder then checks them against the GmbHG like any other draft.",
    oneUndecided: "{field} still needs a decision.",
    manyUndecided:
      "{count, number} values still need a decision. Accept, edit, or clear each one.",
    sourceNote:
      "The text as Urkundenwerk read it from {file}. Marked passages are the quotes behind the values; select one to go to its value.",
    sourceLabel: "Source document",
    verified: "Verified in source",
    unverified: "Unverified",
    decisions: { accepted: "Accept", edited: "Edit", cleared: "Clear" },
    decisionFor: "Decision for {field}",
    newValue: "New value for {field}",
    choose: "Choose…",
    unreadable: "(could not be read)",
    modelNote: "Model note:",
    showInDocument: "Show in document",
    showPassage: "Show the passage for {field} in the document",
    quoteMissing: "Quote not found in the document",
    edit: {
      amountMissing: "Enter an amount, or clear the value.",
      valueMissing: "Enter a value, or clear it instead.",
      date: "Enter a valid date.",
      invalid: "This value is not valid for the field.",
    },
    reasons: {
      value_unreadable: {
        text: "The value could not be read as text.",
        date: "The value could not be read as a date.",
        amount: "The value could not be read as a euro amount.",
        enum: "The value could not be read as one of the field's options.",
      },
      quote_not_found: "The quoted passage was not found in the document.",
      quote_ambiguous:
        "The quoted passage occurs more than once, so its source is unclear.",
      value_not_in_quote: "The value does not appear in the quoted passage.",
      suspicious_passage:
        "The passage reads like an instruction to an AI, not like contract text.",
      duplicate_field:
        "The model returned this field more than once; the first answer is shown.",
    },
    sheet: {
      label: "Document text",
      page: "Page {page, number}",
      warning: "Reads like an instruction to an AI",
      passage: "Passage for {fields}: {quote}",
    },
  },
} as const;

type Catalogue<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : Catalogue<T[K]>;
};

/** The shape every UI language must fill, with any wording. */
export type Messages = Catalogue<typeof en>;
