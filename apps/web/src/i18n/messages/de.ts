import type { Messages } from "./en";

/**
 * Deutsche Oberfläche, im Ton einer Kanzlei oder eines Notariats: Anrede mit
 * „Sie“, die gesetzlichen Fachbegriffe des GmbHG und des BeurkG, und
 * Fundstellen unverändert.
 */
export const de: Messages = {
  audit: {
    title: "Kanzleiprotokoll",
    navLabel: "Kanzleiprotokoll",
    intro:
      "Wer in {firm} Dokumente und Mitgliedschaften geändert hat. Das Protokoll hält fest, welche Felder geändert wurden, aber nie deren Inhalt.",
    activity: "Verlauf",
    latest: "Zuletzt: {action}, {date}",
    recentOnly: "Angezeigt werden die letzten {count, number} Einträge.",
    openAudit: "Vollständigen Verlauf im Kanzleiprotokoll ansehen",
    emptyTitle: "Noch keine Einträge",
    emptyHelp:
      "Hier erscheinen Änderungen an Dokumenten und Mitgliedschaften dieser Kanzlei.",
    emptyFiltered: "Keine Einträge für diese Filter",
    emptyFilteredHelp:
      "Wählen Sie eine andere Aktion oder ein anderes Dokument oder setzen Sie die Filter zurück.",
    today: "Heute",
    yesterday: "Gestern",
    byPerson: "von {name}",
    byFormer: "von einem ehemaligen Mitglied",
    byNone: "vom System oder einem gelöschten Konto",
    former: "Ehemaliges Mitglied",
    none: "System oder gelöschtes Konto",
    titleField: "Dokumenttitel",
    fieldsLabel: "Felder:",
    moreFields: "und {count, number} weitere",
    member: "Mitglied: {name}",
    statusChange: "Status: {from} → {to}",
    roleChange: "Rolle: {from} → {to}",
    roleNamed: "Rolle: {role}",
    accountDeleted: "Das Konto wurde gelöscht.",
    exportDetails: "{document} als {format}",
    exportDocuments: {
      musterprotokoll: "Musterprotokoll",
      anmeldung: "Handelsregisteranmeldung",
    },
    importDetails:
      "{accepted, number} übernommen, {edited, number} bearbeitet, {cleared, number} geleert (Modell {model}, Prompt {version})",
    deletedDocument: "Gelöschtes Dokument",
    onlyDocument: "Nur dieses Dokument anzeigen",
    filters: "Kanzleiprotokoll filtern",
    actionFilter: "Aktion",
    allActions: "Alle Aktionen",
    documentFilter: "Dokument",
    allDocuments: "Alle Dokumente",
    deletedDocumentId: "Gelöschtes Dokument ({id}…)",
    invalidDocument:
      "Dieser Link verweist auf kein gültiges Dokument. Wählen Sie ein Dokument aus der Liste.",
    filter: "Filter anwenden",
    resetFilters: "Filter zurücksetzen",
    entries: "Einträge",
    pages: "Seiten des Kanzleiprotokolls",
    newer: "Neuere Einträge",
    older: "Ältere Einträge",
    page: "Seite {page, number}",
    statuses: {
      draft: "Entwurf",
      final: "Final",
    },
    actions: {
      document_created: "Dokument erstellt",
      document_updated: "Dokument bearbeitet",
      document_deleted: "Dokument gelöscht",
      document_exported: "Dokument exportiert",
      document_imported: "Dokument importiert",
      membership_added: "Mitglied hinzugefügt",
      membership_role_changed: "Rolle geändert",
      membership_removed: "Mitglied entfernt",
      tenant_renamed: "Kanzlei umbenannt",
    },
  },
  members: {
    title: "Mitglieder",
    intro:
      "{count, plural, one {# Person hat} other {# Personen haben}} Zugriff auf {firm}.",
    people: "Personen mit Zugriff",
    you: "Sie",
    unknown: "Mitglied ohne Anzeigenamen",
    readOnlyTitle: "Mitglieder verwaltet die Administration",
    readOnlyBody:
      "Sie sehen, wer Zugriff auf diese Kanzlei hat. Für Einladungen und Rollenänderungen wenden Sie sich an ein Mitglied mit der Rolle Administration.",
    role: "Rolle",
    roleOf: "Rolle von {name}",
    roleHelp: {
      admin:
        "Alles, was die Bearbeitung darf, dazu Mitglieder, Einladungen und das Kanzleiprotokoll.",
      editor: "Erstellt, bearbeitet, importiert und löscht Dokumente.",
      viewer: "Öffnet Dokumente und lädt sie herunter.",
    },
    email: "E-Mail-Adresse der eingeladenen Person",
    create: "Einladung erstellen",
    creating: "Wird erstellt…",
    createdTitle: "Einladung für {email} erstellt",
    createdBody:
      "Kopieren Sie den Link jetzt und senden Sie ihn der eingeladenen Person. Er wird nur einmal angezeigt.",
    copy: "Link kopieren",
    link: "Einladungslink",
    copied: "Der Link wurde in die Zwischenablage kopiert.",
    copiedShort: "Kopiert",
    copyManually:
      "Das Kopieren ist fehlgeschlagen. Markieren Sie den Link und kopieren Sie ihn von Hand.",
    invitations: "Einladungen",
    inviteHelp:
      "Urkundenwerk versendet keine E-Mails. Erstellen Sie die Einladung, kopieren Sie den Link und senden Sie ihn selbst. Er ist sieben Tage gültig, nur einmal verwendbar und nur für ein Konto mit der eingeladenen E-Mail-Adresse.",
    inviteDemo:
      "In der gehosteten Demo muss die eingeladene Person bereits ein Konto haben.",
    pending: "Offene Einladungen",
    pendingDetails: "{role}, gültig bis {date}",
    noPending: "Keine offenen Einladungen",
    noPendingHelp:
      "Erstellte Einladungen erscheinen hier, bis sie angenommen, widerrufen oder abgelaufen sind.",
    revoke: "Widerrufen",
    revoking: "Wird widerrufen…",
    confirmRevokeTitle: "Einladung für {email} widerrufen?",
    confirmRevokeBody:
      "Der Link funktioniert danach nicht mehr. Sie können später eine neue Einladung erstellen.",
    revoked: "Die Einladung wurde widerrufen.",
    revokedNamed: "Die Einladung für {email} wurde widerrufen.",
    saveRole: "Rolle speichern",
    saving: "Wird gespeichert…",
    roleSaved: "Die Rolle wurde gespeichert.",
    remove: "Entfernen",
    leave: "Kanzlei verlassen",
    removing: "Wird entfernt…",
    confirmRemoveTitle: "{name} aus {firm} entfernen?",
    confirmRemoveBody:
      "Die Person verliert sofort den Zugriff auf die Dokumente der Kanzlei. Ihre bisherigen Einträge bleiben im Kanzleiprotokoll, und Sie können sie später erneut einladen.",
    confirmLeaveTitle: "{firm} verlassen?",
    confirmLeaveBody:
      "Sie verlieren sofort den Zugriff auf die Dokumente der Kanzlei. Für eine Rückkehr muss die Administration Sie erneut einladen.",
    cancel: "Abbrechen",
    removed: "Das Mitglied wurde entfernt.",
    removedNamed: "{name} wurde aus der Kanzlei entfernt.",
    forbidden:
      "Nur Personen mit der Rolle Administration dürfen Mitglieder und Einladungen verwalten.",
    invalid: "Prüfen Sie die E-Mail-Adresse und die gewählte Rolle.",
    quota:
      "Sie können bis zu zehn Einladungen pro Stunde erstellen. Versuchen Sie es später erneut.",
    duplicate:
      "Für diese Person besteht bereits eine Mitgliedschaft oder eine offene Einladung.",
    lastAdmin:
      "Weisen Sie zuerst einem weiteren Mitglied die Rolle Administration zu.",
    failed:
      "Die Änderung konnte nicht gespeichert werden. Laden Sie die Seite neu und versuchen Sie es erneut.",
  },
  invite: {
    title: "Einladung zur Kanzlei annehmen",
    body: "Nehmen Sie die Einladung mit dem Konto an, dessen E-Mail-Adresse die Kanzlei eingeladen hat.",
    signedInAs: "Angemeldet als <strong>{email}</strong>",
    redirecting: "Sie werden zur Anmeldung weitergeleitet…",
    signIn: "Anmelden und fortfahren",
    accept: "Einladung annehmen",
    accepting: "Wird angenommen…",
    invalid:
      "Diese Einladung ist für Ihr Konto nicht verfügbar. Prüfen Sie die E-Mail-Adresse Ihres Kontos oder bitten Sie die Kanzlei um einen neuen Link.",
    unavailableTitle: "Diese Einladung kann nicht angenommen werden",
    reasons: {
      email:
        "Sie sind mit einer anderen E-Mail-Adresse angemeldet als der eingeladenen.",
      expired: "Die Einladung ist abgelaufen oder wurde widerrufen.",
      used: "Der Link wurde bereits verwendet.",
    },
    unavailableHelp:
      "Melden Sie sich mit der eingeladenen Adresse an oder bitten Sie die Kanzlei um einen neuen Link.",
    missingTitle: "Kein Einladungslink gefunden",
    missingBody:
      "Öffnen Sie den vollständigen Link, den Sie von der Kanzlei erhalten haben. Er endet mit einer langen Zeichenfolge nach dem Zeichen #.",
    toDocuments: "Zu Ihren Dokumenten",
  },
  account: {
    title: "Konto",
    signedInAs: "Angemeldet als {email}",
    dataTitle: "Ihre Daten",
    dataHelp:
      "Laden Sie eine Kopie der personenbezogenen Daten, die Urkundenwerk über Sie speichert, als JSON-Datei herunter.",
    dataIncludes: "Die Datei enthält",
    dataItems: {
      profile: "Ihr Profil",
      memberships: "Ihre Mitgliedschaften und Rollen",
      invitations: "Von Ihnen erstellte Einladungen",
      events: "Ihnen zugeordnete Protokolleinträge",
      drafts: "IDs und Titel der von Ihnen erstellten Entwürfe",
    },
    dataExcludes:
      "Inhalte von Dokumenten sind nicht enthalten, denn sie gehören der Kanzlei.",
    download: "Meine Daten herunterladen",
    deleteTitle: "Konto löschen",
    deleteHelp: "Die Löschung lässt sich nicht rückgängig machen.",
    deleteEffectsTitle: "Was dabei geschieht",
    deleteEffects: {
      account: "Ihr Konto und Ihre Anmeldedaten werden gelöscht.",
      memberships: "Ihre Mitgliedschaften in allen Kanzleien enden.",
      drafts: "Entwürfe bleiben bei den Kanzleien, die weiter bestehen.",
      audit: "Protokolleinträge bleiben erhalten, aber ohne Ihren Namen.",
    },
    delete: "Mein Konto löschen",
    deleteFinal: "Konto endgültig löschen",
    deleting: "Wird gelöscht…",
    cancel: "Abbrechen",
    confirmTitle: "Konto endgültig löschen?",
    protectedTitle: "Dieses Demokonto ist geschützt",
    protected:
      "Gemeinsam genutzte Demokonten lassen sich nicht löschen, damit alle Besucher dieselben Beispielkanzleien vorfinden. Ihre Daten können Sie trotzdem herunterladen.",
    confirm: "Ich möchte mein Konto unwiderruflich löschen.",
    soleFirmsTitle: "Diese Kanzleien werden gelöscht",
    soleFirms:
      "Sie sind das einzige Mitglied dieser Kanzleien. Mit Ihrem Konto werden auch sie mit allen Entwürfen und Protokollen gelöscht.",
    confirmSole:
      "Ich möchte auch diese Kanzleien und ihre Entwürfe unwiderruflich löschen.",
    confirmRequired: "Bestätigen Sie, dass Sie Ihr Konto löschen möchten.",
    confirmFirms:
      "Laden Sie die Seite neu. Prüfen und bestätigen Sie die Löschung der Kanzleien, in denen Sie das einzige Mitglied sind.",
    lastAdmin:
      "Sie sind die einzige Person mit der Rolle Administration in einer Kanzlei mit weiteren Mitgliedern. Weisen Sie zuerst auf der Seite „Mitglieder“ einem weiteren Mitglied diese Rolle zu.",
    failed: "Ihr Konto konnte nicht gelöscht werden. Versuchen Sie es erneut.",
  },
  legal: {
    nav: "Rechtliche Informationen",
    privacyTitle: "Datenschutzhinweise",
    imprintTitle: "Impressum",
    contents: "Inhalt",
    toImprint: "Zum Impressum",
    toPrivacy: "Zu den Datenschutzhinweisen",
    provider: "Diensteanbieter",
    email: "E-Mail:",
    unconfigured: "Noch kein Impressum hinterlegt",
    unconfiguredHelp:
      "Der Betreiber dieser Installation hat seine Anbieterangaben noch nicht eingetragen.",
    unconfiguredOperator:
      "Betreiber hinterlegen sie auf dem Server in <code>IMPRESSUM_NAME</code>, <code>IMPRESSUM_ADDRESS</code> und <code>IMPRESSUM_EMAIL</code>.",
    intro:
      "Urkundenwerk ist eine öffentliche Demonstration. Verwenden Sie ausschließlich fiktive Falldaten und laden Sie nur fiktive Dokumente hoch.",
    sections: {
      controller: {
        title: "Verantwortlicher und Kontakt",
        body: "Für diese Demonstration ist der im Impressum genannte Betreiber verantwortlich. Für Datenschutzanfragen nutzen Sie bitte die dort angegebene E-Mail-Adresse.",
      },
      processing: {
        title: "Verarbeitete Daten und Zwecke",
        body: "Die Demo verarbeitet Kontodaten und Kanzleirollen, um den Zugang zu ermöglichen. Zur Sicherheit und Nachvollziehbarkeit protokolliert sie Vorgänge an Dokumenten und Mitgliedschaften. Für Betrieb und Schutz der Demo fallen technische Anfragedaten an. Rechtsgrundlage sind die berechtigten Interessen des Betreibers am Angebot und am Schutz vor Missbrauch (Art. 6 Abs. 1 Buchst. f DSGVO). Die einladende Person gibt die E-Mail-Adresse des Empfängers an.",
      },
      providers: {
        title: "Hosting und KI-Anbieter",
        body: "Supabase stellt die Anmeldung und die Datenbank in der EU bereit. Vercel hostet die Website und führt die Serverfunktionen in Frankfurt am Main aus. Wenn Sie eine KI-Funktion aufrufen, verarbeitet OpenAI fiktive Vertragstexte oder ausgewählte fiktive Entwurfsdaten. Dienstleister können Daten, einschließlich KI-Anfragen, auch außerhalb der EU verarbeiten. Die EU-Region der Demo gilt für die primäre Datenbank und die Serverfunktionen.",
      },
      cookies: {
        title: "Cookies und Browserspeicher",
        body: "Die Anwendung verwendet Cookies für die Anmeldung, für die Kanzleiauswahl während der Sitzung und für Ihre Sprachwahl. Das Sprach-Cookie gilt bis zu einem Jahr. Eine Einladung bleibt im Sitzungsspeicher des aktuellen Browsertabs, bis sie angenommen oder der Tab geschlossen wird. Die Anwendung verwendet keine Analyse- oder Werbe-Cookies.",
      },
      retention: {
        title: "Speicherdauer",
        body: "Die Demo setzt die Entwürfe in den Beispielkanzleien jede Nacht zurück und löscht Protokolleinträge, die älter als 90 Tage sind. Einladungen laufen nach sieben Tagen ab. Ihre Datensätze werden 90 Tage nach Ablauf gelöscht. Kontodaten bleiben gespeichert, solange das Konto besteht. Bei einer Löschung wird das Konto aus der aktiven Datenbank entfernt. Der Kontobezug in aufbewahrten Protokolleinträgen entfällt. Entwürfe verbleiben bei fortbestehenden Kanzleien. Für Protokolle und Sicherungen der Dienstleister gelten deren Aufbewahrungsfristen.",
      },
      rights: {
        title: "Ihre Rechte",
        body: "Nach der DSGVO können Sie unter den jeweiligen Voraussetzungen Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung oder Datenübertragbarkeit verlangen sowie der Verarbeitung widersprechen. Sie können sich bei einer Datenschutzaufsichtsbehörde beschweren. Unter „Konto“ können Sie Ihre Daten herunterladen oder Ihr Konto löschen lassen. Wenden Sie sich für weitere Anliegen an den Betreiber.",
      },
    },
  },
  metadata: {
    description:
      "Ein Dokumentenbaukasten für deutsche Kanzleien, der das gesetzliche Musterprotokoll aus strukturierten Falldaten erstellt.",
    login: "Anmelden",
    signup: "Konto anlegen",
    documents: "Dokumente",
    document: "Musterprotokoll",
    import: "Aus Vertrag importieren",
    notFound: "Seite nicht gefunden",
  },
  common: {
    appNavigation: "Anwendungsnavigation",
    serviceUnavailable: "Dem Server fehlt eine gültige Supabase-Konfiguration.",
    demoNotice:
      "Demonstrationsprojekt. Keine Rechtsberatung. Nur fiktive Daten.",
    demoNoticeLabel: "Hinweis zum Demonstrationsprojekt",
    documents: "Dokumente",
    backToDocuments: "Zurück zu Ihren Dokumenten",
    optional: "Optional",
    show: "Anzeigen",
    signOut: "Abmelden",
    firm: "Kanzlei",
    switchFirm: "Wechseln",
  },
  language: {
    label: "Sprache",
    de: "Deutsch",
    en: "English",
  },
  notFound: {
    title: "Seite nicht gefunden",
    body: "Unter dieser Adresse gibt es keine Seite von Urkundenwerk.",
    home: "Zur Startseite",
  },
  landing: {
    lede: "Erstellen Sie das Musterprotokoll für eine Einpersonen-GmbH oder -UG aus strukturierten Falldaten und laden Sie es unterschriftsreif herunter.",
    points: {
      wording: {
        title: "Gesetzlicher Wortlaut, Wort für Wort",
        body: "Der Urkundentext nach {legalBasis} stammt aus einer versionierten Vorlage. Die Anwendung erfasst nur Daten und formuliert keinen Rechtstext.",
      },
      checks: {
        title: "Geprüft während der Eingabe",
        body: "Fehlende Angaben und Regeln wie das Mindeststammkapital der GmbH oder die Volleinzahlung bei der UG erscheinen direkt am Feld.",
      },
      exports: {
        title: "PDF und DOCX zur Unterschrift",
        body: "Beide Exporte beruhen auf demselben Dokumentmodell, gesetzt in A4 mit Schlussformel und Unterschriftszeilen.",
      },
      firms: {
        title: "Jede Kanzlei für sich",
        body: "Entwürfe sind je Kanzlei durch Row-Level Security in Postgres getrennt. Lesende können einsehen, Bearbeitende ändern.",
      },
    },
    signIn: "Zur Demo anmelden",
    signUp: "Kanzleikonto anlegen",
    disclaimer:
      "Urkundenwerk ist ein Portfolioprojekt, kein Produkt. Es bietet keine Rechtsberatung und arbeitet ausschließlich mit fiktiven Personen und Kanzleien.",
    excerpt: "Auszug aus einem erstellten Musterprotokoll",
  },
  auth: {
    email: "E-Mail-Adresse",
    password: "Passwort",
    firmName: "Name der Kanzlei",
    login: {
      title: "Anmelden",
      submit: "Anmelden",
      pending: "Anmeldung läuft …",
      newHere: "Neu hier?",
      signupLink: "Konto für Ihre Kanzlei anlegen",
      demoAccounts: "Fiktive Demokonten",
      signInAs: "Als dieser Nutzer anmelden",
      demoPassword: "Passwort für alle Demokonten:",
      accounts: {
        erik: "Bearbeitung, Demo-Kanzlei Nord",
        victor: "Lesezugriff, Demo-Kanzlei Nord",
        sara: "Administration, Demo-Kanzlei Süd",
        mia: "Bearbeitung in Nord, Lesezugriff in Süd",
      },
    },
    signup: {
      title: "Konto anlegen",
      intro:
        "Sie verwalten anschließend einen neuen Kanzleibereich. Verwenden Sie nur fiktive Daten.",
      submit: "Konto anlegen",
      pending: "Konto wird angelegt …",
      registered: "Bereits registriert?",
      loginLink: "Anmelden",
    },
    errors: {
      emailRequired: "Geben Sie Ihre E-Mail-Adresse ein.",
      emailInvalid: "Geben Sie eine gültige E-Mail-Adresse ein.",
      passwordRequired: "Geben Sie Ihr Passwort ein.",
      passwordTooLong: "Das Passwort ist zu lang.",
      passwordChoose: "Wählen Sie ein Passwort.",
      passwordShort: "Verwenden Sie mindestens {min, number} Zeichen.",
      passwordLong: "Verwenden Sie höchstens {max, number} Zeichen.",
      firmRequired: "Geben Sie den Namen Ihrer Kanzlei ein.",
      firmShort:
        "Der Name der Kanzlei braucht mindestens {min, number} Zeichen.",
      firmLong:
        "Der Name der Kanzlei darf höchstens {max, number} Zeichen haben.",
      invalidCredentials: "E-Mail-Adresse oder Passwort ist nicht korrekt.",
      signInFailed:
        "Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.",
      weakPassword: "Wählen Sie ein sichereres Passwort.",
      signUpFailed: "Mit diesen Angaben konnte kein Konto angelegt werden.",
      confirmEmail:
        "Bestätigen Sie Ihre E-Mail-Adresse und melden Sie sich dann an, um die Einrichtung Ihrer Kanzlei abzuschließen.",
      firmLimit: "Sie können bis zu drei Kanzleien anlegen.",
      demoFirmDisabled:
        "Mit gemeinsamen Demokonten können Sie keine Kanzleien anlegen.",
      firmFailed:
        "Die Kanzlei konnte nicht angelegt werden. Bitte versuchen Sie es erneut.",
    },
  },
  roles: {
    admin: "Administration",
    editor: "Bearbeitung",
    viewer: "Lesezugriff",
  },
  dashboard: {
    setupTitle: "Kanzlei einrichten",
    setupFailed:
      "Ihr Konto wurde angelegt, die Einrichtung Ihrer Kanzlei ist jedoch fehlgeschlagen. Bitte versuchen Sie es erneut.",
    setupIntro:
      "Sie gehören noch keiner Kanzlei an. Legen Sie eine an, um mit Entwürfen zu beginnen. Sie übernehmen die Administration und können später Kolleginnen und Kollegen einladen.",
    createFirm: "Kanzlei anlegen",
    creating: "Wird angelegt …",
    yourRole: "Ihre Rolle: {role}.",
    canEdit: "Sie können Dokumente anlegen, bearbeiten und löschen.",
    canRead: "Sie können Dokumente öffnen und herunterladen.",
    importContract: "Aus Vertrag importieren",
    newDocument: "Neues Musterprotokoll",
    heading: "Dokumente",
    emptyTitle: "Noch keine Dokumente",
    emptyEditor:
      "Beginnen Sie ein Musterprotokoll für eine Einpersonen-GmbH oder -UG. Die Urkunde füllt sich, während Sie die Falldaten eingeben.",
    emptyViewer:
      "Hier erscheinen die Dokumente, die Bearbeitende dieser Kanzlei anlegen.",
    columns: {
      title: "Titel",
      status: "Status",
      changed: "Zuletzt geändert",
      actions: "Aktionen",
    },
    templateLabel: "Musterprotokoll, Einpersonengründung",
    draft: "Entwurf",
    final: "Endfassung",
    needsReview: "Prüfung erforderlich",
    ready: "Bereit zum Export",
    outstanding: "{count, plural, one {# Feld offen} other {# Felder offen}}",
    delete: "Löschen",
    deleting: "Wird gelöscht …",
    confirmDelete:
      "„{title}“ löschen? Dieser Schritt kann nicht rückgängig gemacht werden.",
  },
  documents: {
    defaultTitle: "Musterprotokoll ohne Titel",
    errors: {
      notAllowed:
        "Dieses Dokument wurde nicht gefunden, oder Sie dürfen es nicht ändern.",
      chooseFirm: "Wählen Sie zuerst eine Kanzlei.",
      cannotCreate:
        "Ihre Rolle in dieser Kanzlei erlaubt es nicht, Dokumente anzulegen.",
      invalid: "Die Anfrage ist ungültig.",
      titleRequired: "Geben Sie einen Titel ein.",
      titleLong: "Der Titel darf höchstens {max, number} Zeichen haben.",
      draftTooLarge: "Der Entwurf ist größer als {size, number} KiB.",
      draftInvalid:
        "Der Entwurf enthält Werte, die nicht gespeichert werden können.",
      notFound: "Dieses Dokument wurde nicht gefunden.",
      notExplainable: "Diese Hinweise können nicht erläutert werden.",
      aiOff: "KI-Erläuterungen sind ausgeschaltet.",
      rateLimited:
        "Sie können {count, number} Erläuterungen pro Minute anfordern. Versuchen Sie es gleich noch einmal.",
    },
    notFound: {
      title: "Dokument nicht gefunden",
      body: "Dieses Dokument gibt es nicht, oder es gehört zu einer Kanzlei, der Sie nicht angehören.",
    },
  },
  builder: {
    documentTitle: "Titel des Dokuments",
    templateIn: "{template} in {firm}",
    documentSelector: "Zu erstellendes Dokument",
    documents: {
      musterprotokoll: "Musterprotokoll",
      anmeldung: "Handelsregisteranmeldung",
    },
    musterprotokollForm: "Angaben zum Musterprotokoll",
    anmeldungForm: "Angaben zur Handelsregisteranmeldung",
    save: {
      savedAt: "Gespeichert um {time} Uhr",
      saved: "Alle Änderungen gespeichert",
      unsaved: "Ungespeicherte Änderungen",
      saving: "Wird gespeichert …",
      failed: "Nicht gespeichert.",
      connection:
        "Die Verbindung ist fehlgeschlagen. Prüfen Sie Ihr Netzwerk und versuchen Sie es erneut.",
      retry: "Erneut versuchen",
      flushFirst:
        "Speichern Sie die letzten Änderungen, bevor Sie herunterladen.",
    },
    ready: "Bereit zum Export",
    outstanding: "{count, plural, one {# Feld offen} other {# Felder offen}}",
    download: "{format} herunterladen",
    panes: { form: "Formular", preview: "Vorschau" },
    preview: "Vorschau",
    imported: {
      title: "Aus einem importierten Vertrag erstellt",
      body: "Die übernommenen Werte sind eingetragen. Ergänzen Sie hier den Rest; die Prüfungen unten gelten für importierte Werte wie für alle anderen.",
    },
    readOnly: {
      title: "Nur Lesezugriff",
      body: "Sie können dieses Dokument lesen und herunterladen. Zum Bearbeiten benötigen Sie in {firm} die Rolle Bearbeitung oder Administration.",
    },
    stillMissing: "Noch offen",
    previewNote: {
      musterprotokoll: "Wortlaut nach {legalBasis}, Version {version}.",
      anmeldung: "Entwurf auf Grundlage von {legalBasis}, Version {version}.",
      values:
        "Blau gesetzte Werte stammen aus dem Formular; wählen Sie einen aus, um ihn zu bearbeiten. Seitenumbrüche legt das PDF fest.",
    },
    section: {
      complete: "Vollständig",
      outstanding: "{count, number} offen",
    },
    sections: {
      notarisation: {
        title: "Beurkundung",
        description:
          "Leer gelassene Angaben erscheinen als gepunktete Linien und werden im Termin handschriftlich ergänzt.",
      },
      founder: {
        title: "Gesellschafter",
        description: "Das Musterprotokoll lässt genau einen Gesellschafter zu.",
      },
      company: { title: "Gesellschaft" },
      capital: { title: "Stammkapital und Einlage" },
      director: {
        title: "Geschäftsführer",
        description:
          "Von den Beschränkungen des § 181 BGB befreit, wie es das Musterprotokoll vorsieht.",
      },
      notes: { title: "Hinweise des Notars" },
    },
    hints: {
      video:
        "Die Urkunde enthält dann „mittels Videokommunikation“ und endet nach Nummer 7; die Unterzeichnung erfolgt elektronisch.",
      salutation: "Wird im Urkundentext verwendet, etwa „Herrn“ in Nummer 3.",
      entityDetails:
        "Wird nach den Registerangaben eingefügt, etwa „vertreten durch …“.",
      personDetails:
        "Wird nach der Anschrift eingefügt, etwa wie sich der Gesellschafter ausgewiesen hat.",
      legalForm: "Rechtsform: {form}.",
      legalFormMissing:
        "Schließen Sie mit „GmbH“ oder „UG (haftungsbeschränkt)“.",
      purpose: "Vervollständigt den Satz „Gegenstand des Unternehmens ist …“.",
      capital: "Volle Euro. Die Urkunde nennt den Betrag zusätzlich in Worten.",
      capitalGmbh:
        "Eine GmbH benötigt mindestens 25.000 €, wovon bei Gründung die Hälfte eingezahlt sein kann.",
      capitalUg:
        "Eine UG (haftungsbeschränkt) hat 1 € bis 24.999 € Stammkapital, voll eingezahlt.",
      halfUg: "Bei einer UG (haftungsbeschränkt) nicht möglich.",
      directorQuestion: "Wer wird bestellt?",
      directorEntity:
        "Nur möglich, wenn der Gesellschafter eine natürliche Person ist.",
      directorNamed: "{name} wird bestellt.",
      directorFounder:
        "Übernimmt Name, Geburtsdatum und Wohnort des Gesellschafters.",
      notes:
        "Vervollständigt Nummer 7: „insbesondere auf Folgendes hingewiesen: …“. Leer lassen, um die Hinweise handschriftlich zu ergänzen.",
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
      wholeFormat: "Geben Sie volle Euro ein, zum Beispiel 25.000.",
      wholeRange: "Geben Sie einen Betrag zwischen 1 € und 999.999.999 € ein.",
      centsFormat:
        "Geben Sie einen Betrag in Euro ein, zum Beispiel 12.500,50.",
      centsRange: "Geben Sie einen Betrag zwischen 0 € und 999.999.999 € ein.",
    },
    date: {
      format: "Geben Sie das Datum als {pattern} ein, zum Beispiel {example}.",
      date: "Diesen Tag gibt es nicht. Prüfen Sie Tag und Monat.",
      range: "Geben Sie ein Jahr zwischen 1900 und 2099 ein.",
    },
  },
  filing: {
    courtTitle: "Registergericht",
    courtDescription:
      "Geben Sie den Ort des für den Sitz zuständigen Amtsgerichts an.",
    addressTitle: "Inländische Geschäftsanschrift",
    paymentTitle: "Einzahlung und Versicherungen",
    paymentDescription:
      "Bestätigen Sie die Erklärungen für den im Musterprotokoll bestellten Geschäftsführer.",
    amountDescription:
      "Geben Sie den auf den Geschäftsanteil bereits eingezahlten Betrag an.",
    fundsDescription: "§ 8 Abs. 2 GmbHG",
    disqualificationDescription: "§ 8 Abs. 3 und § 6 Abs. 2 GmbHG",
    disclosureDescription: "§ 8 Abs. 3 GmbHG und § 53 Abs. 2 BZRG",
    attachmentsTitle: "Anlagen",
    attachmentsDescription:
      "Das Musterprotokoll gilt zugleich als Gesellschafterliste.",
    evidenceDescription:
      "Auswählen, wenn der Anmeldung ein gesonderter Einzahlungsnachweis beiliegt.",
  },
  fields: {
    notarisation: {
      mode: { label: "Form der Beurkundung", blank: "Form" },
      deedNumber: { label: "UR-Nr.", blank: "UR-Nr." },
      date: { label: "Datum der Beurkundung", blank: "Datum" },
      notaryName: { label: "Notarin oder Notar", blank: "Notar" },
      notarySeat: { label: "Amtssitz", blank: "Amtssitz" },
    },
    founder: {
      kind: { label: "Der Gesellschafter ist", blank: "Gesellschafter" },
      salutation: { label: "Anrede", blank: "Anrede" },
      firstName: { label: "Vorname", blank: "Vorname" },
      lastName: { label: "Nachname", blank: "Nachname" },
      birthDate: { label: "Geburtsdatum", blank: "Geburtsdatum" },
      address: {
        street: { label: "Straße und Hausnummer", blank: "Straße" },
        postalCode: { label: "Postleitzahl", blank: "PLZ" },
        city: { label: "Ort", blank: "Ort" },
      },
      name: { label: "Name der Gesellschaft", blank: "Gesellschaft" },
      registerCourt: { label: "Registergericht", blank: "Registergericht" },
      registerNumber: { label: "Registernummer", blank: "Registernummer" },
      seat: { label: "Sitz der Gesellschaft", blank: "Sitz" },
      identificationDetails: {
        label: "Angaben zur Identifizierung",
        blank: "Identifizierung",
      },
    },
    company: {
      name: { label: "Firma", blank: "Firma" },
      seat: { label: "Sitz", blank: "Sitz" },
      purpose: {
        label: "Unternehmensgegenstand",
        blank: "Unternehmensgegenstand",
      },
    },
    shareCapitalCents: { label: "Stammkapital", blank: "Stammkapital" },
    contribution: { label: "Einzahlung der Einlage", blank: "Einzahlung" },
    managingDirector: {
      kind: { label: "Geschäftsführer", blank: "Geschäftsführer" },
      salutation: { label: "Anrede", blank: "Anrede" },
      firstName: { label: "Vorname", blank: "Vorname" },
      lastName: { label: "Nachname", blank: "Nachname" },
      birthDate: { label: "Geburtsdatum", blank: "Geburtsdatum" },
      residence: { label: "Wohnort", blank: "Wohnort" },
    },
    notaryNotes: { label: "Hinweise des Notars", blank: "Hinweise" },
    filing: {
      registerCourt: {
        label: "Registergericht (Amtsgericht)",
        blank: "Registergericht",
      },
      businessAddress: {
        street: { label: "Straße und Hausnummer", blank: "Straße" },
        postalCode: { label: "Postleitzahl", blank: "PLZ" },
        city: { label: "Ort", blank: "Ort" },
      },
      paidCents: { label: "Eingezahlter Betrag", blank: "eingezahlter Betrag" },
      fundsAtFreeDisposal: {
        label:
          "Der eingezahlte Betrag befindet sich endgültig in der freien Verfügung des Geschäftsführers",
        blank: "freie Verfügung",
      },
      noDisqualification: {
        label:
          "Der Bestellung des Geschäftsführers stehen keine gesetzlichen Hindernisse entgegen",
        blank: "Versicherung zur Eignung",
      },
      instructedOnDisclosure: {
        label:
          "Der Geschäftsführer wurde über seine unbeschränkte Auskunftspflicht belehrt",
        blank: "Belehrung",
      },
      paymentEvidenceAttached: {
        label: "Ein Einzahlungsnachweis liegt bei",
        blank: "Einzahlungsnachweis",
      },
    },
  },
  options: {
    mode: {
      in_person: "Präsenzbeurkundung",
      // A non-breaking space keeps the paragraph sign with its number.
      video: "Videobeurkundung (§ 16a BeurkG)",
    },
    founderKind: {
      natural_person: "Natürliche Person",
      legal_entity: "Juristische Person",
    },
    salutation: { Herr: "Herr", Frau: "Frau", none: "Ohne Anrede" },
    contribution: {
      full: "Sofort in voller Höhe",
      half: "Zu 50 % sofort, im Übrigen auf Einforderung",
    },
    directorKind: {
      founder: "Der Gesellschafter",
      other: "Eine andere Person",
    },
  },
  preview: {
    edit: "{value}, {field} bearbeiten",
    missing: "Fehlt: {field}",
  },
  checks: {
    title: "Prüfungen",
    intro: "Regeln zu {legalBasis}, laufend während der Eingabe geprüft.",
    explainAll: "Alle erläutern",
    allPass: "Alle Prüfungen bestanden",
    groups: {
      error: {
        title: "Zu korrigieren",
        description: "Diese verhindern das Herunterladen.",
      },
      warning: {
        title: "Prüfenswert",
        description: "Das Registergericht könnte beanstanden.",
      },
      info: { title: "Hinweise", description: "Kein Handlungsbedarf." },
    },
    goTo: "Zu {field}",
    explain: "Erläutern",
    retry: "Erneut versuchen",
    loading: "Erläuterung wird erstellt …",
    dailyBudget:
      "Das tägliche KI-Kontingent der Demo ist aufgebraucht. Versuchen Sie es nach Mitternacht (UTC) erneut.",
    loadFailed:
      "Die Erläuterung konnte nicht geladen werden. Versuchen Sie es erneut.",
    ruleSummary:
      "Zusammenfassung der Regel. Eine KI-Erläuterung ist derzeit nicht verfügbar.",
    aiLabel: "KI-generierte Erläuterung – keine Rechtsberatung",
    suggestedFix: "Vorschlag:",
    modelInfo: "Modell {model}, Prompt {prompt}",
    unknownModel: "unbekannt",
    aiOff:
      "KI-Erläuterungen sind auf diesem Server ausgeschaltet. Jede Prüfung nennt weiterhin ihre Rechtsgrundlage.",
  },
  rules: {
    field_required: {
      required: "Für die Urkunde erforderlich.",
      choice: "Wählen Sie eine der Optionen.",
      summary:
        "Das Musterprotokoll muss mit allen Angaben vervollständigt sein, die sein Wortlaut verlangt, bevor es verwendet werden kann.",
    },
    field_invalid: {
      required: "Für die Urkunde erforderlich.",
      choice: "Wählen Sie eine der Optionen.",
      amount: "Geben Sie einen Betrag zwischen 1 € und 999.999.999 € ein.",
      date: "Geben Sie ein gültiges Datum ein.",
      summary:
        "Jede Angabe im Musterprotokoll muss die erwartete Form haben, etwa ein gültiges Datum oder einen Betrag im zulässigen Bereich.",
    },
    company_legal_form_suffix: {
      message:
        "Die Firma muss mit „GmbH“ oder „UG (haftungsbeschränkt)“ enden.",
      summary:
        "Die Firma muss die Rechtsform enthalten: „GmbH“ oder „Gesellschaft mit beschränkter Haftung“, bei einer UG „UG (haftungsbeschränkt)“ oder „Unternehmergesellschaft (haftungsbeschränkt)“.",
    },
    share_capital_whole_euros: {
      message: "Geben Sie volle Euro an.",
      summary:
        "Der Nennbetrag jedes Geschäftsanteils muss auf volle Euro lauten; das Musterprotokoll hat einen Geschäftsanteil über das gesamte Stammkapital.",
    },
    gmbh_capital_minimum: {
      message: "Eine GmbH benötigt ein Stammkapital von mindestens {minimum}.",
      summary:
        "Eine GmbH benötigt ein Stammkapital von mindestens 25.000 Euro; darunter ist die Gesellschaft als UG (haftungsbeschränkt) zu gründen.",
    },
    ug_capital_below_gmbh_minimum: {
      message:
        "Eine UG (haftungsbeschränkt) hat ein Stammkapital von weniger als {minimum}. Ab {minimum} gründen Sie stattdessen eine GmbH.",
      summary:
        "Nur eine Gesellschaft mit einem Stammkapital unter 25.000 Euro ist eine UG (haftungsbeschränkt); bei höherem Stammkapital ist sie als GmbH zu firmieren.",
    },
    ug_contribution_full: {
      message:
        "Eine UG (haftungsbeschränkt) muss vor der Anmeldung voll eingezahlt sein (§ 5a Abs. 2 GmbHG).",
      summary:
        "Eine UG (haftungsbeschränkt) darf erst angemeldet werden, wenn das Stammkapital in voller Höhe eingezahlt ist.",
    },
    contribution_minimum_payment: {
      message:
        "Mit 50 % sofort werden die {required} nicht erreicht, die vor der Anmeldung eingezahlt sein müssen. Wählen Sie die Einzahlung in voller Höhe.",
      summary:
        "Vor der Anmeldung muss auf jeden Geschäftsanteil ein Viertel und insgesamt mindestens die Hälfte des Mindeststammkapitals (12.500 Euro) in bar eingezahlt sein.",
    },
    formation_costs_capped: {
      message:
        "Bei einem Stammkapital unter {cap} trägt die Gesellschaft die Gründungskosten nur bis zur Höhe des Stammkapitals (Nummer 5). Den Rest trägt der Gesellschafter.",
      summary:
        "Nach Nummer 5 trägt die Gesellschaft die Gründungskosten bis 300 Euro, höchstens jedoch bis zum Betrag ihres Stammkapitals; den Rest trägt der Gesellschafter.",
    },
    company_purpose_specific: {
      message:
        "Dieser Unternehmensgegenstand ist für das Registergericht vermutlich zu allgemein. Nennen Sie die Waren oder Dienstleistungen, etwa „der Handel mit Fahrrädern und Zubehör“.",
      summary:
        "Der Unternehmensgegenstand muss den Schwerpunkt der Geschäftstätigkeit erkennen lassen; Registergerichte beanstanden Leerformeln, die auf jede Gesellschaft passen.",
    },
    director_founder_natural_person: {
      message:
        "Geschäftsführer kann nur eine natürliche Person sein. Bestellen Sie eine andere Person.",
      summary:
        "Geschäftsführer kann nur eine natürliche Person sein; ist der Gesellschafter eine juristische Person, muss eine andere Person bestellt werden.",
    },
    director_full_age: {
      message:
        "Der Geschäftsführer muss am Tag der Beurkundung mindestens {age, number} Jahre alt sein (§ 6 Abs. 2 GmbHG).",
      summary:
        "Ein Geschäftsführer muss unbeschränkt geschäftsfähig sein, was ein Minderjähriger nie ist; die Person muss am Tag der Beurkundung volljährig sein.",
    },
    founder_minor: {
      message:
        "Der Gesellschafter ist jünger als {age, number} Jahre. Er wird durch seine gesetzlichen Vertreter vertreten, und die Gründung kann der Genehmigung des Familiengerichts bedürfen.",
      summary:
        "Ein minderjähriger Gesellschafter wird durch seine gesetzlichen Vertreter vertreten, und ein Gesellschaftsvertrag zum Betrieb eines Erwerbsgeschäfts kann der Genehmigung des Familiengerichts bedürfen.",
    },
    birth_date_not_in_future: {
      message: "Ein Geburtsdatum kann nicht in der Zukunft liegen.",
      summary:
        "Die Urkunde muss jede Person zweifelsfrei bezeichnen, und ein Geburtsdatum in der Zukunft kann nicht zutreffen.",
    },
    notarisation_date_plausible: {
      past: "Dieses Datum liegt mehr als {days, number} Tage zurück. Bitte prüfen.",
      future:
        "Dieses Datum liegt mehr als ein Jahr in der Zukunft. Bitte prüfen.",
      summary:
        "Die Urkunde soll den Tag der Beurkundung angeben; ein Datum, das mehr als 30 Tage zurück oder mehr als ein Jahr voraus liegt, ist vermutlich ein Tippfehler.",
    },
    filing_court_required: {
      message: "Geben Sie den Ort des Amtsgerichts an.",
      summary:
        "Geben Sie das für den Sitz der Gesellschaft zuständige Registergericht an.",
    },
    filing_business_address: {
      postcode: "Geben Sie eine fünfstellige deutsche Postleitzahl ein.",
      address: "Vervollständigen Sie die inländische Geschäftsanschrift.",
      summary:
        "Die Anmeldung muss eine vollständige inländische Geschäftsanschrift enthalten.",
    },
    filing_payment_minimum: {
      missing: "Geben Sie den eingezahlten Betrag in Euro an.",
      below:
        "Der eingezahlte Betrag liegt unter dem gesetzlichen Mindestbetrag von {minimum} für die Anmeldung.",
      summary:
        "Der eingezahlte Betrag muss vor der Anmeldung die gesetzliche Mindesthöhe erreichen.",
    },
    filing_payment_matches_deed: {
      message:
        "Geben Sie einen Betrag zwischen der nach der Urkunde sofort fälligen Einzahlung ({due}) und dem Stammkapital ({capital}) an.",
      summary:
        "Der eingezahlte Betrag muss die in der Urkunde vereinbarte sofortige Einzahlung abdecken und darf das übernommene Stammkapital nicht übersteigen.",
    },
    filing_director_appointed_in_deed: {
      message:
        "Vervollständigen Sie die Angaben zum im Musterprotokoll bestellten Geschäftsführer.",
      summary:
        "Anmeldender Geschäftsführer muss die in Nummer 4 der Urkunde bestellte Person sein.",
    },
    filing_funds_at_free_disposal: {
      message:
        "Bestätigen Sie, dass sich der eingezahlte Betrag endgültig in der freien Verfügung des Geschäftsführers befindet.",
      summary:
        "Bestätigen Sie, dass sich der eingezahlte Betrag endgültig in der freien Verfügung des Geschäftsführers befindet.",
    },
    filing_no_disqualification: {
      message:
        "Bestätigen Sie, dass der Bestellung des Geschäftsführers keine gesetzlichen Hindernisse entgegenstehen.",
      summary:
        "Bestätigen Sie, dass der Bestellung des Geschäftsführers keine gesetzlichen Hindernisse entgegenstehen.",
    },
    filing_disclosure_instruction: {
      message:
        "Bestätigen Sie, dass der Geschäftsführer über seine unbeschränkte Auskunftspflicht gegenüber dem Gericht belehrt wurde.",
      summary:
        "Bestätigen Sie, dass der Geschäftsführer über seine unbeschränkte Auskunftspflicht gegenüber dem Gericht belehrt wurde.",
    },
  },
  import: {
    title: "Aus einem Vertrag importieren",
    unavailable: {
      roleTitle:
        "Der Import erfordert die Rolle Bearbeitung oder Administration",
      roleBody:
        "Ihre Rolle in {firm} ist {role}. Wenden Sie sich an die Administration der Kanzlei, wenn Sie Verträge importieren möchten.",
      noFirm: "Legen Sie zuerst eine Kanzlei an oder treten Sie einer bei.",
      aiTitle: "Die KI-Extraktion ist auf diesem Server nicht eingerichtet",
      aiBody:
        "Der Import liest einen Vertrag mit einem KI-Modell, und auf diesem Server ist keines eingerichtet. Sie können weiterhin ein neues Musterprotokoll anlegen und von Hand ausfüllen. Um den Import lokal zu testen, setzen Sie <code>ANTHROPIC_API_KEY</code>, <code>OPENAI_API_KEY</code> oder <code>AI_PROVIDER=fake</code> in <code>apps/web/.env.local</code>.",
    },
    intro:
      "Laden Sie eine bestehende Gründungsurkunde oder Satzung hoch. Ein KI-Modell schlägt Werte für ein neues Musterprotokoll in {firm} vor und zitiert jeweils die Fundstelle. Sie prüfen jeden Wert, und gespeichert wird erst, wenn Sie den Entwurf anlegen.",
    reading:
      "Das Dokument wird gelesen und die Werte werden extrahiert. Das dauert meist weniger als eine Minute.",
    seconds: "{seconds, number} s",
    drop: "PDF oder DOCX hier ablegen oder <choose>Datei auswählen</choose>",
    dropHint:
      "Ein PDF mit Textebene oder eine DOCX-Datei, bis {size, number} MB. Scans können noch nicht gelesen werden.",
    privacy: {
      title: "Was mit dem Dokument geschieht",
      fake: "Dieser Server verwendet zu Testzwecken eine skriptgesteuerte Extraktion. Der Text verlässt den Server nicht, und kein KI-Modell liest ihn.",
      provider:
        "Der Text des Dokuments wird an die API von {provider} gesendet, Modell <code>{model}</code>, um die Werte zu extrahieren. Verwenden Sie in dieser Demo nur fiktive Dokumente.",
      storage:
        "Urkundenwerk speichert weder die Datei noch ihren Text. Gespeichert werden nur die Werte, die Sie übernehmen, in einem neuen Entwurf.",
      accuracy:
        "Die KI kann sich irren. Jeder Wert zeigt seine Fundstelle, und unser Code prüft, dass es die Stelle gibt und sie den Wert nennt.",
    },
    sizeKb: "{size} KB",
    sizeMb: "{size} MB",
    errors: {
      notAllowed:
        "Der Import von Verträgen erfordert in dieser Kanzlei die Rolle Bearbeitung oder Administration.",
      disabled: "Die KI-Extraktion ist auf diesem Server nicht eingerichtet.",
      rateLimited:
        "Sie können {count, number} Verträge alle {minutes, number} Minuten importieren. Versuchen Sie es gleich noch einmal.",
      invalidDraft:
        "Einige übernommene Werte sind für das Musterprotokoll nicht gültig.",
      network:
        "Die Datei hat den Server nicht erreicht. Prüfen Sie Ihre Verbindung und die Datei und versuchen Sie es erneut.",
      oneFile: "Legen Sie jeweils nur eine Datei ab.",
    },
    upload: {
      missing: "Wählen Sie eine PDF- oder DOCX-Datei für den Import.",
      type: "Nur PDF- und DOCX-Dateien können importiert werden. Exportieren Sie den Vertrag als PDF oder DOCX und versuchen Sie es erneut.",
      empty: "Die Datei ist leer. Wählen Sie den Vertrag erneut aus.",
      size: "Die Datei ist größer als {size, number} MB. Laden Sie die Gründungsurkunde oder die Satzung einzeln hoch.",
    },
    ingestion: {
      FILE_TOO_LARGE:
        "Die Datei ist größer als {size, number} MB. Laden Sie die Gründungsurkunde oder die Satzung einzeln hoch.",
      UNSUPPORTED_FORMAT:
        "Nur PDF- und DOCX-Dateien können importiert werden. Exportieren Sie den Vertrag als PDF oder DOCX und versuchen Sie es erneut.",
      INVALID_LIMIT:
        "Die Größengrenze für Uploads muss eine positive ganze Zahl sein.",
      INVALID_PDF: "Das PDF konnte nicht gelesen werden.",
      PDF_ENCRYPTED:
        "Exportieren Sie eine unverschlüsselte Kopie des PDF und laden Sie sie erneut hoch.",
      PDF_PAGE_LIMIT: "Das PDF hat mehr als 30 Seiten.",
      PDF_NO_TEXT:
        "Dieses PDF hat keine Textebene, es handelt sich also meist um einen Scan. Gescannte Dokumente können noch nicht importiert werden; verwenden Sie ein aus der Textverarbeitung exportiertes PDF oder eine DOCX-Datei.",
      INVALID_DOCX: "Die DOCX-Datei konnte nicht gelesen werden.",
      DOCX_ARCHIVE_LIMIT:
        "Die DOCX-Datei enthält zu viele Einträge oder überschreitet entpackt die Größengrenze.",
      DOCX_NO_TEXT: "Die DOCX-Datei enthält keinen auslesbaren Text.",
      TEXT_LIMIT: "Das Dokument enthält zu viel Text für die Extraktion.",
    },
    extraction: {
      DOCUMENT_TOO_LONG:
        "Das Dokument ist für die KI-Extraktion zu lang. Laden Sie die Gründungsurkunde oder die Satzung einzeln hoch.",
      timeout:
        "Die KI hat zu lange für die Antwort gebraucht. Versuchen Sie es gleich noch einmal.",
      daily_budget:
        "Das tägliche KI-Kontingent der Demo ist aufgebraucht. Versuchen Sie es nach Mitternacht (UTC) erneut.",
      rate_limited:
        "Der KI-Dienst ist ausgelastet. Versuchen Sie es in einer Minute erneut.",
      unavailable:
        "Der KI-Dienst ist nicht erreichbar. Versuchen Sie es später erneut.",
      unauthorized:
        "Der KI-Dienst ist auf diesem Server nicht korrekt eingerichtet.",
      rejected: "Der KI-Dienst hat die Anfrage abgelehnt.",
      refused: "Die KI hat die Extraktion aus diesem Dokument abgelehnt.",
      truncated:
        "Die Antwort der KI wurde abgeschnitten. Versuchen Sie es mit einem kürzeren Dokument.",
      invalid_output:
        "Die Antwort der KI hatte nicht die erwartete Form. Versuchen Sie es erneut.",
      aborted: "Die Extraktion wurde abgebrochen.",
    },
  },
  review: {
    title: "Extrahierte Werte prüfen",
    from: "Aus {file}",
    progress: {
      none: "Keine Werte gefunden",
      done: "Alle {count, number} Werte entschieden",
      pending: "{pending, number} von {count, number} Werten offen",
    },
    acceptAll: "Alle verifizierten übernehmen",
    create: "Entwurf anlegen",
    creating: "Entwurf wird angelegt …",
    panes: { fields: "Werte", source: "Dokument" },
    aiNotice: {
      title: "KI-extrahiert – jeden Wert prüfen; keine Rechtsberatung",
      body: "{model} hat diese Werte mit dem Prompt {prompt} vorgeschlagen. Urkundenwerk hat jedes Zitat mit dem Dokument abgeglichen. Verifiziert heißt, dass die Fundstelle existiert und den Wert nennt, nicht dass der Wert für die Urkunde richtig ist.",
    },
    suspicious: {
      title: "Das Dokument enthält Anweisungen an eine KI",
      body: "Einige Passagen lesen sich wie Anweisungen an eine KI statt wie Vertragstext. Daraus zitierte Werte sind nicht verifiziert. Prüfen Sie die Herkunft des Dokuments.",
    },
    empty: {
      title: "Keine Werte gefunden",
      body: "Das Modell hat in diesem Dokument nichts für ein Musterprotokoll gefunden. Versuchen Sie es mit der Gründungsurkunde oder der Satzung.",
      another: "Andere Datei wählen",
    },
    sections: {
      notarisation: "Beurkundung",
      founder: "Gesellschafter",
      company: "Gesellschaft",
      capital: "Stammkapital und Einlage",
      director: "Geschäftsführer",
      notes: "Hinweise des Notars",
    },
    nothingFound: "Nichts gefunden",
    found: "{count, number} gefunden",
    absent:
      "Im Dokument nicht gefunden: {fields}. Sie können diese Angaben im Formular ergänzen.",
    importAnother: "Weitere Datei importieren",
    summary:
      "{count, plural, one {Der Entwurf erhält den # Wert, den Sie übernommen oder bearbeitet haben.} other {Der Entwurf erhält die # Werte, die Sie übernommen oder bearbeitet haben.}} Anschließend werden sie wie jeder andere Entwurf anhand des GmbHG geprüft.",
    oneUndecided: "Für {field} fehlt noch eine Entscheidung.",
    manyUndecided:
      "Für {count, number} Werte fehlt noch eine Entscheidung. Übernehmen, bearbeiten oder verwerfen Sie jeden einzelnen.",
    sourceNote:
      "Der Text, wie Urkundenwerk ihn aus {file} gelesen hat. Markierte Passagen sind die Zitate hinter den Werten; wählen Sie eine aus, um zu ihrem Wert zu gelangen.",
    sourceLabel: "Quelldokument",
    verified: "In der Quelle verifiziert",
    unverified: "Nicht verifiziert",
    decisions: {
      accepted: "Übernehmen",
      edited: "Bearbeiten",
      cleared: "Verwerfen",
    },
    decisionFor: "Entscheidung zu {field}",
    newValue: "Neuer Wert für {field}",
    choose: "Bitte wählen …",
    unreadable: "(nicht lesbar)",
    modelNote: "Anmerkung des Modells:",
    showInDocument: "Im Dokument zeigen",
    showPassage: "Fundstelle für {field} im Dokument zeigen",
    quoteMissing: "Zitat im Dokument nicht gefunden",
    edit: {
      amountMissing: "Geben Sie einen Betrag ein oder verwerfen Sie den Wert.",
      valueMissing: "Geben Sie einen Wert ein oder verwerfen Sie ihn.",
      date: "Geben Sie ein gültiges Datum ein.",
      invalid: "Dieser Wert ist für das Feld nicht gültig.",
    },
    reasons: {
      value_unreadable: {
        text: "Der Wert konnte nicht als Text gelesen werden.",
        date: "Der Wert konnte nicht als Datum gelesen werden.",
        amount: "Der Wert konnte nicht als Eurobetrag gelesen werden.",
        enum: "Der Wert konnte keiner der Optionen des Feldes zugeordnet werden.",
      },
      quote_not_found: "Die zitierte Passage wurde im Dokument nicht gefunden.",
      quote_ambiguous:
        "Die zitierte Passage kommt mehrfach vor, ihre Fundstelle ist daher unklar.",
      value_not_in_quote: "Der Wert kommt in der zitierten Passage nicht vor.",
      suspicious_passage:
        "Die Passage liest sich wie eine Anweisung an eine KI, nicht wie Vertragstext.",
      duplicate_field:
        "Das Modell hat dieses Feld mehrfach geliefert; angezeigt wird die erste Antwort.",
    },
    sheet: {
      label: "Text des Dokuments",
      page: "Seite {page, number}",
      warning: "Liest sich wie eine Anweisung an eine KI",
      passage: "Fundstelle für {fields}: {quote}",
    },
  },
};
