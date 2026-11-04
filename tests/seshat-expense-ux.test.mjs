import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const workspace = read("features/seshat/SeshatWorkspace.tsx");
const types = read("features/seshat/types.ts");
const engine = read("features/seshat/financialEngine.ts");

test("expense categories are created inline and the new category is selected", () => {
  assert.match(workspace, /New category/);
  assert.match(workspace, /rpc<ExpenseCategory>\("create_expense_category"/);
  assert.match(workspace, /setSelectedCategoryId\(category\.id\)/);
  assert.match(workspace, /placeholder="Infrastructure \/ Cloud"/);
  assert.match(workspace, /Category “\$\{category\.name\}” created and selected/);
  assert.match(types, /create_expense_category:[\s\S]*Returns: ExpenseCategory\[\]/);
  assert.match(engine, /That expense category already exists/);
});

test("opening and submitting the sibling category form preserves expense inputs", () => {
  const expenseFormStart = workspace.indexOf("function ExpenseForm(");
  const expenseFormEnd = workspace.indexOf("function Invoices(", expenseFormStart);
  const expenseForm = workspace.slice(expenseFormStart, expenseFormEnd);
  const mainFormEnd = expenseForm.indexOf("</form>");
  const categoryFormStart = expenseForm.indexOf("aria-label=\"Create expense category\"");

  assert.ok(mainFormEnd > 0 && categoryFormStart > mainFormEnd, "category form must be a sibling, not nested");
  assert.match(expenseForm, /value=\{selectedCategoryId\}/);
  assert.doesNotMatch(expenseForm, /event\.currentTarget\.reset/);
});

test("new expenses refresh, redirect to the list, and carry a named success flash", () => {
  assert.match(workspace, /await load\(\);[\s\S]*sessionStorage\.setItem\(expenseSavedFlashKey, payload\.name\);[\s\S]*router\.push\("\/seshat\/expenses"\)/);
  assert.match(workspace, /Expense “\$\{expenseName\}” saved\./);
  assert.doesNotMatch(workspace, /router\.push\(`\/seshat\/expenses\/\$\{rowId\(data\)\}`\)/);
});

test("existing expense updates stay on detail and provide a named confirmation", () => {
  assert.match(workspace, /if \(expenseId\)[\s\S]*\.update\(payload\)\.eq\("id", expenseId\)[\s\S]*Expense “\$\{payload\.name\}” updated\./);
  const updateBranch = workspace.slice(workspace.indexOf("if (expenseId)"), workspace.indexOf("} else {", workspace.indexOf("if (expenseId)")));
  assert.doesNotMatch(updateBranch, /router\.push/);
});

test("expense and category submissions are guarded while errors leave forms mounted", () => {
  assert.match(workspace, /if \(expenseSubmittingRef\.current\) return/);
  assert.match(workspace, /disabled=\{submitting\}[\s\S]*Saving\.\.\./);
  assert.match(workspace, /if \(categorySubmittingRef\.current\) return/);
  assert.match(workspace, /setError\(seshatErrorMessage\(submitError, "Could not save expense\."\)\)[\s\S]*return false/);
});

test("client service insert and update refresh in place with clear feedback", () => {
  assert.match(workspace, /await loadDetail\(\);[\s\S]*Service schedule “\$\{payload\.name\}” \$\{clientServiceId \? "updated" : "added"\}/);
  assert.match(workspace, /if \(!clientServiceId\) setCreatingService\(false\)/);
  assert.match(workspace, /if \(submittingRef\.current\) return/);
  assert.match(workspace, /disabled=\{submitting\}/);
  assert.match(workspace, /auto_invoice: form\.get\("auto_invoice"\) === "on"/);
  assert.match(workspace, /auto_invoice_start_date: clean\(form\.get\("auto_invoice_start_date"\)\)/);
  assert.match(workspace, /frequency: String\(form\.get\("frequency"\) \?\? "monthly"\)/);
});
