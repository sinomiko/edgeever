import { expect, test } from "@playwright/test";

test("toolbar colors preserve the selection, other marks, and saved colors", async ({ page }, testInfo) => {
  const title = `Toolbar colors ${Date.now()}`;
  const notebooks = await (await page.request.get("/api/v1/notebooks")).json();
  const created = await page.request.post("/api/v1/memos", {
    data: { notebookId: notebooks.notebooks[0].id, title, contentMarkdown: "alpha beta" },
  });
  expect(created.status()).toBe(201);
  const memo = (await created.json()).memo;
  const editor = page.locator(".ProseMirror[contenteditable='true']");
  const open = async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "全部笔记", exact: true }).click();
    await page.getByPlaceholder("搜索笔记").fill(title);
    await page.locator(`[data-memo-id="${memo.id}"]`).getByRole("button").first().click();
    await expect(editor).toContainText("alpha beta");
  };
  const selectAlpha = async () => {
    await editor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("ArrowLeft");
    for (let index = 0; index < 5; index++) await page.keyboard.press("Shift+ArrowRight");
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe("alpha");
  };
  const palette = (background = false) => page.getByRole("menu", { name: background ? "背景高亮" : "文字颜色", exact: true });
  const choose = async (color: string, background = false) => {
    await page.getByRole("button", { name: background ? "背景高亮" : "文字颜色", exact: true }).click();
    await palette(background).getByRole("menuitem", { name: color, exact: true }).click();
  };
  try {
    await open();
    await selectAlpha();
    await page.getByRole("button", { name: "加粗", exact: true }).click();
    await choose("#dc2626");
    const colored = editor.locator("strong span").filter({hasText: /^alpha$/});
    await expect(colored).toHaveCSS("color", "rgb(220, 38, 38)");
    await choose("#fef08a", true);
    await expect(colored).toHaveCSS("background-color", "rgb(254, 240, 138)");
    await page.getByRole("button", { name: "文字颜色", exact: true }).click();
    await palette().getByRole("menuitem", { name: "恢复默认", exact: true }).click();
    await expect(colored).toHaveCSS("background-color", "rgb(254, 240, 138)");
    await page.getByRole("button", { name: "文字颜色", exact: true }).click();
    await palette().getByRole("textbox", {name: "十六进制颜色"}).fill("#xyz");
    await expect(palette().getByRole("button", {name: "应用颜色"})).toBeDisabled();
    await palette().getByRole("textbox", {name: "十六进制颜色"}).fill("#123abc");
    await palette().getByRole("button", {name: "应用颜色"}).click();
    await expect(colored).toHaveCSS("color", "rgb(18, 58, 188)");
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await page.getByRole("button", { name: "重做", exact: true }).click();
    await expect(colored).toHaveCSS("color", "rgb(18, 58, 188)");
    await expect.poll(async () => (await (await page.request.get(`/api/v1/memos/${memo.id}`)).json()).memo.contentMarkdown, {timeout: 20000}).toContain("color:#123abc;background-color:#fef08a");
    await open();
    await expect(colored).toHaveCSS("color", "rgb(18, 58, 188)");
    await expect(colored).toHaveCSS("background-color", "rgb(254, 240, 138)");
    await expect(editor.locator("span").filter({hasText: /^ beta$/})).toHaveCount(0);
    await selectAlpha();
    const boldBox = await page.getByRole("button", {name: "加粗", exact: true}).boundingBox();
    const colorBox = await page.getByRole("button", {name: "文字颜色", exact: true}).boundingBox();
    expect(colorBox!.x).toBeGreaterThan(boldBox!.x);
    expect(colorBox!.x - boldBox!.x).toBeLessThan(45);
    await page.getByRole("button", {name: "文字颜色", exact: true}).click();
    await expect(palette()).toHaveCSS("opacity", "1");
    await page.screenshot({path: testInfo.outputPath("text-color-palette-desktop.png")});
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", {name: "文字颜色", exact: true})).toBeFocused();
    await page.setViewportSize({width: 1024, height: 768});
    await page.getByRole("button", {name: "文字颜色", exact: true}).click();
    await expect(palette()).toHaveCSS("opacity", "1");
    const menuBox = await palette().boundingBox();
    expect(menuBox!.x).toBeGreaterThanOrEqual(0);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(1024);
    await page.screenshot({path: testInfo.outputPath("text-color-palette-narrow.png")});
    await page.keyboard.press("Escape");
    await page.getByRole("button", {name: /^开启阅读保护/}).click();
    await expect(page.getByRole("button", {name: "文字颜色", exact: true})).toBeDisabled();
    await expect(page.getByRole("button", {name: "背景高亮", exact: true})).toBeDisabled();
    await page.getByRole("button", {name: /^关闭阅读保护/}).click();
    await selectAlpha();
    await page.getByRole("button", {name: "背景高亮", exact: true}).click();
    await palette(true).getByRole("menuitem", {name: "恢复默认", exact: true}).click();
    await expect(colored).toHaveCSS("color", "rgb(18, 58, 188)");
    await expect(colored).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await editor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("ArrowRight");
    await choose("#16a34a");
    await page.keyboard.insertText(" green");
    await expect(editor.locator("span").filter({hasText: /^ green$/})).toHaveCSS("color", "rgb(22, 163, 74)");
    await page.getByRole("button", {name: "显示更多编辑工具", exact: true}).click();
    await page.getByRole("button", {name: "代码块", exact: true}).click();
    await expect(page.getByRole("button", {name: "文字颜色", exact: true})).toBeDisabled();
    await expect(page.getByRole("button", {name: "背景高亮", exact: true})).toBeDisabled();
  } finally {
    await page.request.delete(`/api/v1/memos/${memo.id}`);
    await page.request.delete(`/api/v1/memos/${memo.id}?permanent=1`);
  }
});

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
