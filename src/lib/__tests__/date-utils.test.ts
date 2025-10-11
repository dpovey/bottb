import { formatEventDate } from "../date-utils";

describe("formatEventDate", () => {
  it("formats a date correctly with ordinal suffix", () => {
    const dateString = "2024-12-25T18:30:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("25th December 2024 @ 6:30PM");
  });

  it("handles 1st correctly", () => {
    const dateString = "2024-01-01T12:00:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("1st January 2024 @ 12:00PM");
  });

  it("handles 2nd correctly", () => {
    const dateString = "2024-02-02T12:00:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("2nd February 2024 @ 12:00PM");
  });

  it("handles 3rd correctly", () => {
    const dateString = "2024-03-03T12:00:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("3rd March 2024 @ 12:00PM");
  });

  it("handles 4th correctly", () => {
    const dateString = "2024-04-04T12:00:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("4th April 2024 @ 12:00PM");
  });

  it("handles 11th correctly (special case)", () => {
    const dateString = "2024-11-11T12:00:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("11th November 2024 @ 12:00PM");
  });

  it("handles 12th correctly (special case)", () => {
    const dateString = "2024-12-12T12:00:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("12th December 2024 @ 12:00PM");
  });

  it("handles 13th correctly (special case)", () => {
    const dateString = "2024-12-13T12:00:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("13th December 2024 @ 12:00PM");
  });

  it("handles 21st correctly", () => {
    const dateString = "2024-12-21T12:00:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("21st December 2024 @ 12:00PM");
  });

  it("handles 22nd correctly", () => {
    const dateString = "2024-12-22T12:00:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("22nd December 2024 @ 12:00PM");
  });

  it("handles 23rd correctly", () => {
    const dateString = "2024-12-23T12:00:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("23rd December 2024 @ 12:00PM");
  });

  it("handles 24th correctly", () => {
    const dateString = "2024-12-24T12:00:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("24th December 2024 @ 12:00PM");
  });

  it("handles AM time correctly", () => {
    const dateString = "2024-12-25T09:15:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("25th December 2024 @ 9:15AM");
  });

  it("handles midnight correctly", () => {
    const dateString = "2024-12-25T00:00:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("25th December 2024 @ 12:00AM");
  });

  it("handles noon correctly", () => {
    const dateString = "2024-12-25T12:00:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("25th December 2024 @ 12:00PM");
  });

  it("handles single digit minutes correctly", () => {
    const dateString = "2024-12-25T18:05:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("25th December 2024 @ 6:05PM");
  });

  it("handles all months correctly", () => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    months.forEach((month, index) => {
      const dateString = `2024-${String(index + 1).padStart(
        2,
        "0"
      )}-15T12:00:00Z`;
      const result = formatEventDate(dateString);
      expect(result).toContain(month);
    });
  });

  it("handles different years correctly", () => {
    const dateString = "2025-12-25T18:30:00Z";
    const result = formatEventDate(dateString);
    expect(result).toBe("25th December 2025 @ 6:30PM");
  });

  it("handles invalid date gracefully", () => {
    const dateString = "invalid-date";
    const result = formatEventDate(dateString);
    expect(result).toBe("Invalid Date December NaN @ NaN:NaNaM");
  });

  it("handles empty string gracefully", () => {
    const dateString = "";
    const result = formatEventDate(dateString);
    expect(result).toBe("Invalid Date December NaN @ NaN:NaNaM");
  });
});
