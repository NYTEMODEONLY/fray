import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemberList } from "../MemberList";
import { User } from "../../types";

const users: User[] = [
  {
    id: "@nyte:example.com",
    name: "nytemode",
    avatar: "N",
    status: "online",
    roles: ["Admin", "nytemode"],
    roleColor: "#b94cff"
  },
  {
    id: "@ava:example.com",
    name: "ava",
    avatar: "A",
    status: "offline",
    roles: ["Member"]
  }
];

describe("Phase 9 member profile and role color", () => {
  it("opens member profile card on click with roles and colored name", async () => {
    const user = userEvent.setup();

    render(<MemberList users={users} />);

    await user.click(screen.getByRole("button", { name: /nytemode/i }));

    expect(screen.getByRole("heading", { name: "nytemode" })).toHaveStyle({ color: "#b94cff" });
    expect(screen.getByText("@nyte:example.com")).toBeInTheDocument();
    expect(screen.getAllByText("nytemode").length).toBeGreaterThan(1);
  });

  it("closes the profile card when close is clicked", async () => {
    const user = userEvent.setup();

    render(<MemberList users={users} />);

    await user.click(screen.getByRole("button", { name: /nytemode/i }));
    expect(screen.getByRole("heading", { name: "nytemode" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("heading", { name: "nytemode" })).not.toBeInTheDocument();
  });
});
