import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LoginPage } from "./login-page";

afterEach(() => cleanup());

describe("LoginPage", () => {
  it("shows the default email login form", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "登录影栈 Studio" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "邮箱" })).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "记住我" })).toBeChecked();
  });

  it("keeps the email visible when password login fails", async () => {
    render(<LoginPage />);

    fireEvent.change(screen.getByRole("textbox", { name: "邮箱" }), {
      target: { value: "creator@example.com" }
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "bad-password" }
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    expect(screen.getByRole("button", { name: "登录中..." })).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent("登录失败，请检查邮箱和密码。请重新输入密码。");
    await waitFor(() => expect(screen.getByRole<HTMLInputElement>("textbox", { name: "邮箱" }).value).toBe("creator@example.com"));
  });

  it("shows the API Key login form and failure state", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("tab", { name: "使用 API Key 登录" }));

    expect(screen.getByRole("textbox", { name: "API Key" })).toBeInTheDocument();
    expect(screen.getByLabelText("Secret Key")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "服务区域" })).toHaveValue("cn-north-1");
    expect(screen.getByRole("textbox", { name: "默认模型" })).toHaveValue("jimeng-video-v3");

    fireEvent.change(screen.getByRole("textbox", { name: "API Key" }), {
      target: { value: "ak_demo" }
    });
    fireEvent.change(screen.getByLabelText("Secret Key"), {
      target: { value: "sk_secret" }
    });
    fireEvent.click(screen.getByRole("button", { name: "验证并登录" }));

    expect(screen.getByRole("button", { name: "登录中..." })).toBeDisabled();
    expect(await screen.findByRole("alert")).toHaveTextContent("API Key 登录失败，请检查 Key 和服务区域。请重新输入 Secret Key。");
    await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>("Secret Key").value).toBe(""));
  });
});
