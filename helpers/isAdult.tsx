export const isAdult = (dob: Date | string | null | undefined): boolean => {
  if (!dob) return false;

  let birthDate: Date;

  if (typeof dob === "string") {
    const trimmed = dob.trim();
    // Check for German format DD.MM.YYYY
    const germanFormatMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (germanFormatMatch) {
      const day = parseInt(germanFormatMatch[1], 10);
      const month = parseInt(germanFormatMatch[2], 10) - 1; // 0-indexed month
      const year = parseInt(germanFormatMatch[3], 10);
      birthDate = new Date(year, month, day);
    } else {
      birthDate = new Date(trimmed);
    }
  } else {
    birthDate = dob;
  }

  // Check if date is invalid
  if (isNaN(birthDate.getTime())) {
    return false;
  }

  const today = new Date();

  // Prevent future dates entirely (someone cannot be born in the future)
  if (birthDate > today) {
    return false;
  }

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  // If the birth month hasn't occurred yet this year, or
  // it's the birth month but the day hasn't occurred yet, subtract 1 year from the age
  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age >= 18;
};