# Register XML and XJustiz

Urkundenwerk's XML is a structured export in
`urn:urkundenwerk:registeranmeldung:1`. The project XSD describes this
export. A production adapter would construct a separate message for the
applicable XJustiz release.

The [XJustiz 3.6.2 specification](https://xjustiz.justiz.de/system/pdf/Spezifikation_XJustiz_3_6_2.pdf)
describes the structured register filing in § 7.2.3 and the Handelsregister
message `nachricht.reg.0400003` in § 7.3.1. These are conceptual mappings.

| Urkundenwerk XML                            | XJustiz register concepts                                                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registergericht`                           | The recipient in the message header. Resolve the court name and jurisdiction to the current official court identifier.                                                                      |
| `gesellschaft`                              | The Rechtsträger being registered. Map the name, seat, purpose, capital and the business address with its address type.                                                                     |
| `gesellschafterliste`, `geschaeftsfuehrung` | Persons or organisations and their respective roles. Preserve the distinction between the general representation rule for the Rechtsträger and the appointed director's specific authority. |
| `einzahlung`, `versicherungen`              | Formation facts and statements in the signed filing and supporting documents. Confirm which, if any, have discrete fields in the target message version.                                    |
| `anlagen`                                   | Document metadata. Refer to the actual electronic documents by their prescribed names and types, including the Musterprotokoll that serves as the shareholder list.                         |
| `generator`                                 | Internal provenance. The XJustiz header needs its own message identity, sender, recipient, and schema version.                                                                              |

A production adapter would select the applicable release from the
[official XJustiz versions](https://xjustiz.justiz.de/), map its code lists
and validate the entire message against its schemas and applicable court
rules. The electronic submission also needs the publicly certified
application and electronic supporting documents under
[§ 12 HGB](https://www.gesetze-im-internet.de/hgb/__12.html), sent through the
authorized electronic legal channel, such as the notary's special
electronic mailbox (beN) on the
[EGVP infrastructure](https://egvp.justiz.de/Drittprodukte/EGVP_Infrastruktur_Anforderungen_Teilnahme_von_Drittanwendungen.pdf).

The repository vendors no XJustiz schemas. The demo needs only its own
data contract and relies on no rights to redistribute the official files.
