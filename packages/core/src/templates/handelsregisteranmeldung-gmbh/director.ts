import type { MusterprotokollCandidate } from "../musterprotokoll-einpersonen/draft";
import type { MusterprotokollData } from "../musterprotokoll-einpersonen/schema";

type Director = {
  salutation?: "Herr" | "Frau" | null;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  residence?: string;
  source: "founder" | "managingDirector";
};

/** The filing always uses the person appointed in clause 4 of the deed. */
export function appointedDirector({
  founder,
  managingDirector,
}: MusterprotokollCandidate): Director | undefined {
  if (managingDirector?.kind === "other") {
    return { ...managingDirector, source: "managingDirector" };
  }
  if (
    managingDirector?.kind === "founder" &&
    founder?.kind === "natural_person"
  ) {
    return {
      salutation: founder.salutation,
      firstName: founder.firstName,
      lastName: founder.lastName,
      birthDate: founder.birthDate,
      residence: founder.address?.city,
      source: "founder",
    };
  }
}

export function isIdentifiedDirector(
  director: Director | undefined,
): director is Required<Omit<Director, "salutation">> &
  Pick<Director, "salutation"> {
  return Boolean(
    director?.firstName &&
    director.lastName &&
    director.birthDate &&
    director.residence,
  );
}

export function requireAppointedDirector(data: MusterprotokollData) {
  const director = appointedDirector(data);
  if (!isIdentifiedDirector(director)) {
    throw new Error("The director appointed in the deed must be identified.");
  }
  return director;
}
