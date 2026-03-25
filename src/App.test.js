import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

beforeAll(() => {
  HTMLMediaElement.prototype.pause = jest.fn();
  HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
  window.scrollTo = jest.fn();
  Object.assign(navigator, {
    clipboard: {
      writeText: jest.fn().mockResolvedValue(undefined),
    },
  });
});

beforeEach(() => {
  jest.useFakeTimers();
  navigator.clipboard.writeText.mockClear();
  navigator.clipboard.writeText.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
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

test("shows an exact six-digit search as a featured qr card", async () => {
  render(<App />);

  await userEvent.type(
    screen.getByPlaceholderText(/search seats codes/i),
    "151445"
  );

  const featuredCode = screen.getAllByText("151445")[0].closest(".qr-code-item");

  expect(featuredCode).toHaveClass("qr-code-item-featured");
});

test("clicking the title clears the search bar", async () => {
  render(<App />);

  await userEvent.type(
    screen.getByPlaceholderText(/search seats codes/i),
    "151445"
  );
  await userEvent.click(screen.getByText(/every single seats code/i));

  await waitFor(() => {
    expect(screen.getByPlaceholderText(/search seats codes/i)).toHaveValue("");
  });
});

test("clicking a qr code item features it and copies the code", async () => {
  render(<App />);

  await userEvent.click(screen.getAllByText("000000")[0]);

  await waitFor(() => {
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("000000");
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
    expect(screen.getByPlaceholderText(/search seats codes/i)).toHaveValue(
      "000000"
    );
    expect(screen.getByText("Copied code to clipboard")).toBeInTheDocument();
    expect(
      screen.getAllByText("000000")[0].closest(".qr-code-item")
    ).toHaveClass("qr-code-item-featured");
  });
});

test("an exact search overrides a previously clicked featured code", async () => {
  render(<App />);

  await userEvent.click(screen.getAllByText("000000")[0]);
  await userEvent.clear(screen.getByPlaceholderText(/search seats codes/i));
  await userEvent.type(
    screen.getByPlaceholderText(/search seats codes/i),
    "151445"
  );

  await waitFor(() => {
    expect(
      screen.getAllByText("151445")[0].closest(".qr-code-item")
    ).toHaveClass("qr-code-item-featured");
  });
});

test("nothing is featured when the search bar is not an exact six-digit code", async () => {
  render(<App />);

  await userEvent.type(
    screen.getByPlaceholderText(/search seats codes/i),
    "151"
  );

  expect(document.querySelector(".qr-code-item-featured")).toBeNull();
});

test("an exact six-digit search still renders the continuing list underneath", async () => {
  render(<App />);

  await userEvent.type(
    screen.getByPlaceholderText(/search seats codes/i),
    "151445"
  );

  expect(screen.getAllByText("151445")[0].closest(".qr-code-item")).toHaveClass(
    "qr-code-item-featured"
  );
  expect(screen.getByText("151446")).toBeInTheDocument();
});

test("successful clipboard feedback clears after a short delay", async () => {
  render(<App />);

  await userEvent.click(screen.getAllByText("000000")[0]);

  await waitFor(() => {
    expect(screen.getByText("Copied code to clipboard")).toBeInTheDocument();
  });

  act(() => {
    jest.advanceTimersByTime(1000);
  });

  await waitFor(() => {
    expect(
      screen.queryByText("Copied code to clipboard")
    ).not.toBeInTheDocument();
  });
});

test("clipboard failure clears after a short delay", async () => {
  navigator.clipboard.writeText.mockRejectedValueOnce(new Error("denied"));
  render(<App />);

  await userEvent.click(screen.getAllByText("000000")[0]);

  await waitFor(() => {
    expect(screen.getByText("Could not copy code to clipboard")).toBeInTheDocument();
  });

  act(() => {
    jest.advanceTimersByTime(1000);
  });

  await waitFor(() => {
    expect(
      screen.queryByText("Could not copy code to clipboard")
    ).not.toBeInTheDocument();
  });
});

test("typing clears clipboard feedback", async () => {
  render(<App />);

  await userEvent.click(screen.getAllByText("000000")[0]);

  await waitFor(() => {
    expect(screen.getByText("Copied code to clipboard")).toBeInTheDocument();
  });

  await userEvent.type(screen.getByPlaceholderText(/search seats codes/i), "1");

  expect(
    screen.queryByText("Copied code to clipboard")
  ).not.toBeInTheDocument();
});
