// Shared profile completeness check, used by the wallet top-up flow (frontend + backend).
export type ProfileCompletenessField =
  | "postcode"
  | "city"
  | "streetAddress"
  | "mobileNumber"
  | "dateOfBirth";

export const profileCompleteness = (
  profile:
    | {
        postcode?: string | null;
        city?: string | null;
        streetAddress?: string | null;
        mobileNumber?: string | null;
        dateOfBirth?: Date | string | null;
      }
    | null
    | undefined
): { isComplete: boolean; missingFields: ProfileCompletenessField[] } => {
  if (!profile) {
    return {
      isComplete: false,
      missingFields: [
        "postcode",
        "city",
        "streetAddress",
        "mobileNumber",
        "dateOfBirth",
      ],
    };
  }

  const missingFields: ProfileCompletenessField[] = [];

  const isMissingString = (val?: string | null) => {
    return !val || val.trim().length === 0;
  };

  const isMissingDate = (val?: Date | string | null) => {
    if (!val) return true;
    if (typeof val === "string" && val.trim().length === 0) return true;
    return false;
  };

  if (isMissingString(profile.postcode)) {
    missingFields.push("postcode");
  }
  if (isMissingString(profile.city)) {
    missingFields.push("city");
  }
  if (isMissingString(profile.streetAddress)) {
    missingFields.push("streetAddress");
  }
  if (isMissingString(profile.mobileNumber)) {
    missingFields.push("mobileNumber");
  }
  if (isMissingDate(profile.dateOfBirth)) {
    missingFields.push("dateOfBirth");
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
};