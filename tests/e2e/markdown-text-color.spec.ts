import { expect, test } from "@playwright/test";

test("retains Markdown colors through source mode, edit, save and reload", async ({ page }) => {
  const title = `Markdown color ${Date.now()}`;
  const notebooks = await (await page.request.get("/api/v1/notebooks")).json();
  const markdown = '<span style="color:#ff0000">红色</span> **<span style="color:#008000;background-color:#ffff00">绿色加粗</span>** [<span style="color:#bc0058">链接</span>](https://example.com)';
  const created = await page.request.post("/api/v1/memos", {
    data: { notebookId: notebooks.notebooks[0].id, title, contentMarkdown: markdown },
  });
  expect(created.status()).toBe(201);
  const memo = (await created.json()).memo;
  const editor = page.locator(".ProseMirror[contenteditable='true']");
  const open = async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "全部笔记", exact: true }).click();
    await page.getByPlaceholder("搜索笔记").fill(title);
    await page.locator(`[data-memo-id="${memo.id}"]`).getByRole("button").first().click();
    await expect(editor).toContainText("红色");
  };
  const checkColors = async () => {
    await expect(editor.locator("span").filter({ hasText: /^红色$/ })).toHaveCSS("color", "rgb(255, 0, 0)");
    await expect(editor.locator("strong span").filter({ hasText: /^绿色加粗$/ })).toHaveCSS("color", "rgb(0, 128, 0)");
    await expect(editor.locator("strong span").filter({ hasText: /^绿色加粗$/ })).toHaveCSS("background-color", "rgb(255, 255, 0)");
    await expect(editor.locator("a span").filter({ hasText: /^链接$/ })).toHaveCSS("color", "rgb(188, 0, 88)");
  };
  try {
    await open();
    await checkColors();
    await page.getByRole("button", { name: "切换到 Markdown 源码", exact: true }).click();
    await expect(page.locator(".cm-content[contenteditable='true']")).toContainText('color:#ff0000');
    await page.getByRole("button", { name: "切换到富文本编辑", exact: true }).click();
    await checkColors();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.insertText(" saved");
    await expect.poll(async () => {
      const saved = await (await page.request.get(`/api/v1/memos/${memo.id}`)).json();
      return saved.memo.contentMarkdown;
    }, { timeout: 20_000 }).toContain("saved");
    await open();
    await checkColors();
    await expect(editor).toContainText("saved");
  } finally {
    await page.request.delete(`/api/v1/memos/${memo.id}`);
    await page.request.delete(`/api/v1/memos/${memo.id}?permanent=1`);
  }
});
