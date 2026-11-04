"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { fetchApi } from "@/lib/api";
import { useAuth } from "@/store/useAuth";

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  currentQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
};

type RecipeLine = {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  quantity: number;
};

type Recipe = {
  id: string;
  productId: string | null;
  toppingId: string | null;
  name: string;
  size: string | null;
  isProvisional: boolean;
  items: RecipeLine[];
};

type InventoryData = {
  ingredients: Ingredient[];
  products: { id: string; name: string; category: string; sizes: string[] }[];
  toppings: { id: string; name: string }[];
  recipes: Recipe[];
  estimates: {
    targetId: string;
    targetName: string;
    size: string | null;
    isTopping: boolean;
    isProvisional: boolean | null;
    estimatedServings: number | null;
    limitingIngredient: string | null;
  }[];
  receipts: {
    id: string;
    receiptNumber: string;
    supplierName: string | null;
    invoiceNumber: string | null;
    createdAt: string;
    items: { quantity: number; ingredient: { name: string; unit: string } }[];
  }[];
  movements: {
    id: string;
    type: string;
    quantityDelta: number;
    note: string | null;
    createdAt: string;
    ingredient: { name: string; unit: string };
    actor: { fullName: string | null; email: string } | null;
  }[];
};

type RecipeDraftLine = { ingredientId: string; quantity: string };
type ReceiptDraftLine = {
  ingredientId: string;
  quantity: string;
  unitCost: string;
};

type Tab = "stock" | "recipes" | "receipts" | "estimates";

const emptyReceiptLine = (): ReceiptDraftLine => ({
  ingredientId: "",
  quantity: "",
  unitCost: "",
});

export default function InventoryAdminPage() {
  const { user, isAuthenticated, hydrate } = useAuth();
  const [data, setData] = useState<InventoryData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("stock");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [ingredientName, setIngredientName] = useState("");
  const [ingredientUnit, setIngredientUnit] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("0");
  const [editingIngredientId, setEditingIngredientId] = useState("");
  const [editIngredientName, setEditIngredientName] = useState("");
  const [editIngredientUnit, setEditIngredientUnit] = useState("");
  const [editLowStockThreshold, setEditLowStockThreshold] = useState("0");
  const [editIngredientActive, setEditIngredientActive] = useState(true);
  const [adjustIngredientId, setAdjustIngredientId] = useState("");
  const [adjustment, setAdjustment] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [recipeTarget, setRecipeTarget] = useState("");
  const [recipeLines, setRecipeLines] = useState<RecipeDraftLine[]>([
    { ingredientId: "", quantity: "" },
  ]);
  const [recipeIsProvisional, setRecipeIsProvisional] = useState(true);
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [receiptNote, setReceiptNote] = useState("");
  const [receiptLines, setReceiptLines] = useState<ReceiptDraftLine[]>([
    emptyReceiptLine(),
  ]);

  const activeIngredients = useMemo(
    () => data?.ingredients.filter((ingredient) => ingredient.isActive) ?? [],
    [data],
  );

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchApi<InventoryData>("/inventory");
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được dữ liệu kho.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isAuthenticated && user?.role === "ADMIN") {
      void loadData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    if (!data || !recipeTarget) return;
    const [kind, id, size] = recipeTarget.split("|");
    const recipe = data.recipes.find((item) =>
      kind === "product"
        ? item.productId === id && item.size === size
        : item.toppingId === id,
    );
    setRecipeLines(
      recipe?.items.length
        ? recipe.items.map((item) => ({
            ingredientId: item.ingredientId,
            quantity: String(item.quantity),
          }))
        : [{ ingredientId: "", quantity: "" }],
    );
    setRecipeIsProvisional(recipe?.isProvisional ?? true);
  }, [data, recipeTarget]);

  const save = async (
    event: FormEvent<HTMLFormElement>,
    endpoint: string,
    body: unknown,
    successText: string,
  ): Promise<boolean> => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await fetchApi(endpoint, { method: "POST", body: JSON.stringify(body) });
      setMessage(successText);
      await loadData();
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không lưu được dữ liệu.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveIngredient = async (event: FormEvent<HTMLFormElement>) => {
    const saved = await save(
      event,
      "/inventory/ingredients",
      {
        name: ingredientName,
        unit: ingredientUnit,
        lowStockThreshold: Number(lowStockThreshold),
      },
      "Đã thêm nguyên liệu.",
    );
    if (saved) {
      setIngredientName("");
      setIngredientUnit("");
      setLowStockThreshold("0");
    }
  };

  const saveAdjustment = async (event: FormEvent<HTMLFormElement>) => {
    const saved = await save(
      event,
      "/inventory/adjustments",
      {
        ingredientId: adjustIngredientId,
        quantityDelta: Number(adjustment),
        note: adjustmentNote,
      },
      "Đã ghi nhận điều chỉnh tồn kho.",
    );
    if (saved) {
      setAdjustment("");
      setAdjustmentNote("");
    }
  };

  const beginEditIngredient = (ingredient: Ingredient) => {
    setEditingIngredientId(ingredient.id);
    setEditIngredientName(ingredient.name);
    setEditIngredientUnit(ingredient.unit);
    setEditLowStockThreshold(String(ingredient.lowStockThreshold));
    setEditIngredientActive(ingredient.isActive);
  };

  const saveIngredientChanges = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await fetchApi(`/inventory/ingredients/${editingIngredientId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editIngredientName,
          unit: editIngredientUnit,
          lowStockThreshold: Number(editLowStockThreshold),
          isActive: editIngredientActive,
        }),
      });
      setMessage("Đã cập nhật nguyên liệu.");
      setEditingIngredientId("");
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không cập nhật được nguyên liệu.");
    } finally {
      setSaving(false);
    }
  };

  const saveRecipe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const [kind, id, size] = recipeTarget.split("|");
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await fetchApi("/inventory/recipes", {
        method: "PUT",
        body: JSON.stringify({
          ...(kind === "product" ? { productId: id, size } : { toppingId: id }),
          isProvisional: recipeIsProvisional,
          items: recipeLines.map((line) => ({
            ingredientId: line.ingredientId,
            quantity: Number(line.quantity),
          })),
        }),
      });
      setMessage("Đã lưu công thức.");
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không lưu được công thức.");
    } finally {
      setSaving(false);
    }
  };

  const saveReceipt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const items = receiptLines.map((line) => ({
      ingredientId: line.ingredientId,
      quantity: Number(line.quantity),
      ...(line.unitCost ? { unitCost: Number(line.unitCost) } : {}),
    }));
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const receipt = await fetchApi<{ receiptNumber: string }>("/inventory/receipts", {
        method: "POST",
        body: JSON.stringify({
          supplierName,
          invoiceNumber,
          note: receiptNote,
          items,
        }),
      });
      setMessage(`Đã lưu phiếu ${receipt.receiptNumber}; tồn kho đã được cộng.`);
      setSupplierName("");
      setInvoiceNumber("");
      setReceiptNote("");
      setReceiptLines([emptyReceiptLine()]);
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không lưu được phiếu nhập.");
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated || user?.role !== "ADMIN") {
    return (
      <section className="p-6 text-center">
        <h1 className="text-xl font-black">Khu vực quản trị</h1>
        <p className="mt-2 text-sm text-brew-600">
          Vui lòng đăng nhập bằng tài khoản ADMIN để quản lý kho.
        </p>
      </section>
    );
  }

  if (loading) {
    return <p className="p-6 text-sm text-brew-600">Đang tải dữ liệu kho...</p>;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "stock", label: "Nguyên liệu" },
    { id: "recipes", label: "Công thức" },
    { id: "receipts", label: "Phiếu nhập" },
    { id: "estimates", label: "Ước tính ly" },
  ];

  return (
    <div className="space-y-5 p-4 pb-10">
      <header>
        <h1 className="text-2xl font-black text-brew-950">Quản lý nguyên liệu</h1>
        <p className="mt-1 text-sm text-brew-600">
          Tồn kho chỉ thay đổi khi lưu phiếu nhập, điều chỉnh hoặc thanh toán đơn.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
          {message}
        </p>
      )}

      <nav className="grid grid-cols-2 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-3 py-2 text-sm font-bold ${
              activeTab === tab.id
                ? "bg-brew-800 text-white"
                : "bg-brew-100 text-brew-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "stock" && (
        <section className="space-y-4">
          <form onSubmit={saveIngredient} className="space-y-3 rounded-2xl border p-4">
            <h2 className="font-bold">Thêm nguyên liệu</h2>
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                value={ingredientName}
                onChange={(event) => setIngredientName(event.target.value)}
                placeholder="Tên nguyên liệu"
                className="min-w-0 rounded-lg border p-2 text-sm"
              />
              <input
                required
                value={ingredientUnit}
                onChange={(event) => setIngredientUnit(event.target.value)}
                placeholder="Đơn vị: g, ml, cái"
                className="min-w-0 rounded-lg border p-2 text-sm"
              />
            </div>
            <input
              type="number"
              min="0"
              step="0.001"
              value={lowStockThreshold}
              onChange={(event) => setLowStockThreshold(event.target.value)}
              placeholder="Ngưỡng cảnh báo tồn thấp"
              className="w-full rounded-lg border p-2 text-sm"
            />
            <button disabled={saving} className="rounded-lg bg-brew-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              Thêm nguyên liệu
            </button>
          </form>

          <form onSubmit={saveAdjustment} className="space-y-3 rounded-2xl border p-4">
            <h2 className="font-bold">Điều chỉnh tồn kho</h2>
            <select
              required
              value={adjustIngredientId}
              onChange={(event) => setAdjustIngredientId(event.target.value)}
              className="w-full rounded-lg border p-2 text-sm"
            >
              <option value="">Chọn nguyên liệu</option>
              {activeIngredients.map((item) => (
                <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
              ))}
            </select>
            <input
              required
              type="number"
              step="0.001"
              value={adjustment}
              onChange={(event) => setAdjustment(event.target.value)}
              placeholder="Số lượng (+ nhập thêm, - hao hụt)"
              className="w-full rounded-lg border p-2 text-sm"
            />
            <input
              required
              value={adjustmentNote}
              onChange={(event) => setAdjustmentNote(event.target.value)}
              placeholder="Lý do điều chỉnh"
              className="w-full rounded-lg border p-2 text-sm"
            />
            <button disabled={saving} className="rounded-lg border border-brew-700 px-4 py-2 text-sm font-bold text-brew-800 disabled:opacity-50">
              Lưu điều chỉnh
            </button>
          </form>

          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead className="bg-brew-100 text-brew-900">
                <tr><th className="p-3">Nguyên liệu</th><th className="p-3">Tồn</th><th className="p-3">Cảnh báo</th><th className="p-3">Thao tác</th></tr>
              </thead>
              <tbody>
                {data?.ingredients.map((item) => (
                  <tr key={item.id} className="border-t">
                    {editingIngredientId === item.id ? (
                      <td colSpan={4} className="p-3">
                        <form onSubmit={saveIngredientChanges} className="grid gap-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input required value={editIngredientName} onChange={(event) => setEditIngredientName(event.target.value)} className="min-w-0 rounded-lg border p-2 text-sm" aria-label="Tên nguyên liệu" />
                            <input required value={editIngredientUnit} onChange={(event) => setEditIngredientUnit(event.target.value)} className="min-w-0 rounded-lg border p-2 text-sm" aria-label="Đơn vị" />
                            <input type="number" min="0" step="0.001" value={editLowStockThreshold} onChange={(event) => setEditLowStockThreshold(event.target.value)} className="rounded-lg border p-2 text-sm" aria-label="Ngưỡng cảnh báo" />
                            <label className="flex items-center gap-2 text-xs">
                              <input type="checkbox" checked={editIngredientActive} onChange={(event) => setEditIngredientActive(event.target.checked)} />
                              Đang sử dụng
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button disabled={saving} className="rounded-lg bg-brew-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Lưu</button>
                            <button type="button" onClick={() => setEditingIngredientId("")} className="rounded-lg border px-3 py-1.5 text-xs">Hủy</button>
                          </div>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td className="p-3">{item.name}{!item.isActive && " (ngừng dùng)"}</td>
                        <td className={`p-3 font-bold ${item.currentQuantity <= item.lowStockThreshold ? "text-red-700" : ""}`}>{item.currentQuantity} {item.unit}</td>
                        <td className="p-3">{item.lowStockThreshold} {item.unit}</td>
                        <td className="p-3">
                          <button type="button" onClick={() => beginEditIngredient(item)} className="font-bold text-brew-800">Sửa</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "recipes" && (
        <section className="space-y-4">
          <form onSubmit={saveRecipe} className="space-y-3 rounded-2xl border p-4">
            <h2 className="font-bold">Công thức món và topping</h2>
            <select
              required
              value={recipeTarget}
              onChange={(event) => setRecipeTarget(event.target.value)}
              className="w-full rounded-lg border p-2 text-sm"
            >
              <option value="">Chọn món-size hoặc topping</option>
              {data?.products.flatMap((product) =>
                product.sizes.map((size) => (
                  <option key={`${product.id}-${size}`} value={`product|${product.id}|${size}`}>
                    {product.name} - {size}
                  </option>
                )),
              )}
              {data?.toppings.map((topping) => (
                <option key={topping.id} value={`topping|${topping.id}|`}>
                  Topping - {topping.name}
                </option>
              ))}
            </select>
            {recipeLines.map((line, index) => (
              <div key={index} className="grid grid-cols-[1fr_90px_auto] gap-2">
                <select
                  required
                  value={line.ingredientId}
                  onChange={(event) =>
                    setRecipeLines((current) =>
                      current.map((item, row) =>
                        row === index ? { ...item, ingredientId: event.target.value } : item,
                      ),
                    )
                  }
                  className="min-w-0 rounded-lg border p-2 text-sm"
                >
                  <option value="">Nguyên liệu</option>
                  {activeIngredients.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                  ))}
                </select>
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={line.quantity}
                  onChange={(event) =>
                    setRecipeLines((current) =>
                      current.map((item, row) =>
                        row === index ? { ...item, quantity: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="Định lượng"
                  className="min-w-0 rounded-lg border p-2 text-sm"
                />
                <button
                  type="button"
                  aria-label="Xóa nguyên liệu khỏi công thức"
                  onClick={() =>
                    setRecipeLines((current) =>
                      current.length > 1 ? current.filter((_, row) => row !== index) : current,
                    )
                  }
                  className="rounded-lg border px-3 text-red-700"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRecipeLines((current) => [...current, { ingredientId: "", quantity: "" }])}
              className="text-sm font-bold text-brew-800"
            >
              + Thêm dòng nguyên liệu
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={recipeIsProvisional}
                onChange={(event) => setRecipeIsProvisional(event.target.checked)}
              />
              Công thức tạm thời (ước tính)
            </label>
            <button disabled={saving || !recipeTarget} className="rounded-lg bg-brew-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              Lưu công thức
            </button>
          </form>

          <div className="space-y-2">
            {data?.recipes.map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                onClick={() =>
                  setRecipeTarget(
                    recipe.productId
                      ? `product|${recipe.productId}|${recipe.size}`
                      : `topping|${recipe.toppingId}|`,
                  )
                }
                className="w-full rounded-xl border p-3 text-left"
              >
                <span className="font-bold">{recipe.name}{recipe.size ? ` - ${recipe.size}` : ""}</span>
                {recipe.isProvisional && <span className="ml-2 text-xs font-bold text-amber-700">TẠM</span>}
                <span className="mt-1 block text-xs text-brew-600">
                  {recipe.items.map((item) => `${item.ingredientName}: ${item.quantity} ${item.unit}`).join(" · ")}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {activeTab === "receipts" && (
        <section className="space-y-4">
          <form onSubmit={saveReceipt} className="space-y-3 rounded-2xl border p-4">
            <h2 className="font-bold">Phiếu nhập hàng</h2>
            <input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Nhà cung cấp (không bắt buộc)" className="w-full rounded-lg border p-2 text-sm" />
            <input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Số hóa đơn (không bắt buộc)" className="w-full rounded-lg border p-2 text-sm" />
            {receiptLines.map((line, index) => (
              <div key={index} className="grid grid-cols-[1fr_80px_80px_auto] gap-1">
                <select
                  required
                  value={line.ingredientId}
                  onChange={(event) =>
                    setReceiptLines((current) =>
                      current.map((item, row) =>
                        row === index ? { ...item, ingredientId: event.target.value } : item,
                      ),
                    )
                  }
                  className="min-w-0 rounded-lg border p-2 text-xs"
                >
                  <option value="">Nguyên liệu</option>
                  {activeIngredients.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={line.quantity}
                  onChange={(event) =>
                    setReceiptLines((current) =>
                      current.map((item, row) =>
                        row === index ? { ...item, quantity: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="SL"
                  className="min-w-0 rounded-lg border p-2 text-xs"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitCost}
                  onChange={(event) =>
                    setReceiptLines((current) =>
                      current.map((item, row) =>
                        row === index ? { ...item, unitCost: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="Giá/đv"
                  className="min-w-0 rounded-lg border p-2 text-xs"
                />
                <button
                  type="button"
                  aria-label="Xóa dòng phiếu nhập"
                  onClick={() =>
                    setReceiptLines((current) =>
                      current.length > 1 ? current.filter((_, row) => row !== index) : current,
                    )
                  }
                  className="rounded-lg border px-2 text-red-700"
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setReceiptLines((current) => [...current, emptyReceiptLine()])} className="text-sm font-bold text-brew-800">
              + Thêm nguyên liệu vào phiếu
            </button>
            <textarea value={receiptNote} onChange={(event) => setReceiptNote(event.target.value)} placeholder="Ghi chú" className="w-full rounded-lg border p-2 text-sm" />
            <p className="text-xs text-amber-800">Khi lưu, phiếu được ghi nhận ngay và số lượng tồn được cộng. Phiếu đã lưu không thể sửa/xóa.</p>
            <button disabled={saving} className="rounded-lg bg-brew-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              Lưu phiếu và nhập kho
            </button>
          </form>

          <div className="space-y-2">
            <h2 className="font-bold">Phiếu đã lưu gần đây</h2>
            {data?.receipts.map((receipt) => (
              <article key={receipt.id} className="rounded-xl border p-3 text-sm">
                <p className="font-bold">{receipt.receiptNumber}</p>
                <p className="text-xs text-brew-600">
                  {receipt.supplierName || "Không ghi nhà cung cấp"}
                  {receipt.invoiceNumber ? ` · HĐ ${receipt.invoiceNumber}` : ""}
                  {" · "}{new Date(receipt.createdAt).toLocaleString("vi-VN")}
                </p>
                <p className="mt-1 text-xs">
                  {receipt.items.map((item) => `${item.ingredient.name}: +${item.quantity} ${item.ingredient.unit}`).join(" · ")}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "estimates" && (
        <section className="space-y-3">
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            Công thức có nhãn TẠM là ước tính để bắt đầu; hãy chỉnh lại theo công thức thực tế trước khi dùng tồn kho để ra quyết định nhập hàng.
          </p>
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[470px] text-left text-sm">
              <thead className="bg-brew-100">
                <tr><th className="p-3">Món / topping</th><th className="p-3">Số phần ước tính</th><th className="p-3">Nguyên liệu giới hạn</th></tr>
              </thead>
              <tbody>
                {data?.estimates.map((estimate, index) => (
                  <tr key={`${estimate.targetId}-${estimate.size ?? "topping"}-${index}`} className="border-t">
                    <td className="p-3">
                      {estimate.targetName}{estimate.size ? ` - ${estimate.size}` : " (topping)"}
                      {estimate.isProvisional && <span className="ml-1 text-xs font-bold text-amber-700">TẠM</span>}
                    </td>
                    <td className="p-3 font-bold">{estimate.estimatedServings ?? "Chưa có công thức"}</td>
                    <td className="p-3">{estimate.limitingIngredient ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-bold">Lịch sử biến động gần đây</h2>
        {data?.movements.slice(0, 10).map((movement) => (
          <article key={movement.id} className="flex justify-between gap-3 rounded-xl border p-3 text-xs">
            <div>
              <p className="font-bold">{movement.ingredient.name} · {movement.type}</p>
              <p className="text-brew-600">{movement.note || "—"} · {new Date(movement.createdAt).toLocaleString("vi-VN")}</p>
            </div>
            <span className={`shrink-0 font-bold ${movement.quantityDelta < 0 ? "text-red-700" : "text-green-700"}`}>
              {movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta} {movement.ingredient.unit}
            </span>
          </article>
        ))}
      </section>
    </div>
  );
}
