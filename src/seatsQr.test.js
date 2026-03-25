import { extractSeatsCode } from "./seatsQr";

describe("extractSeatsCode", () => {
  test("extracts a six-digit code from a SEAtS QR URL", () => {
    expect(extractSeatsCode("https://seatssoftware.com/qr/151445")).toBe(
      "151445"
    );
  });

  test("extracts a direct six-digit code", () => {
    expect(extractSeatsCode(" 004321 ")).toBe("004321");
  });

  test("returns null for a non-SEAtS QR URL", () => {
    expect(extractSeatsCode("https://example.com/qr/151445")).toBeNull();
  });

  test("returns null for invalid input", () => {
    expect(extractSeatsCode("hello world")).toBeNull();
    expect(extractSeatsCode(null)).toBeNull();
  });
});
