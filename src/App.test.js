import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

beforeAll(() => {
  HTMLMediaElement.prototype.pause = jest.fn();
  HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
});

test("renders the search UI and opens the scanner modal", async () => {
  render(<App />);

  expect(
    screen.getByPlaceholderText(/search seats codes/i)
  ).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /open qr scanner/i }));

  expect(
    screen.getByRole("heading", { name: /scan a seats qr code/i })
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /upload photo/i })
  ).toBeInTheDocument();
});
