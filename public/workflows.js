(() => {
  const panel = document.querySelector("#workflow-view");
  const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  const button = (text, action) => { const node = el("button", text, "refresh"); node.type = "button"; node.addEventListener("click", () => perform(action, node)); return node; };
  const notice = text => el("p", text, "notice");
  async function api(path, body, method) {
    const token = state.apiKey;
    const response = await fetch(path, { method: method || (body ? "POST" : "GET"), headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (token !== state.apiKey) throw new Error("نشست تغییر کرده است");
    if (response.status === 204) return null;
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "عملیات انجام نشد");
    return data;
  }
  async function perform(action, control) {
    if (control) control.disabled = true;
    try { await action(); } catch (error) { panel.prepend(notice(error.message)); }
    finally { if (control) control.disabled = false; }
  }
  function field(form, name, label, type = "text", value = "", required = true) {
    const wrap = el("label", label); const input = el("input"); input.name = name; input.type = type; input.value = value; input.required = required;
    if (type === "number") { input.min = "0"; input.step = "any"; }
    wrap.append(input); form.append(wrap); return input;
  }
  function submitForm(label, handler) {
    const form = el("form", null, "stack"); const submit = el("button", label, "primary"); submit.type = "submit";
    form.addEventListener("submit", event => { event.preventDefault(); perform(() => handler(Object.fromEntries(new FormData(form)), form), submit); });
    form.append(submit); return form;
  }
  function table(headers, rows) {
    const wrap = el("div", null, "table-scroll"); const node = el("table", null, "data-table"); const head = el("thead"); const header = el("tr");
    headers.forEach(text => header.append(el("th", text))); head.append(header); node.append(head);
    const body = el("tbody"); rows.forEach(values => { const row = el("tr"); values.forEach(value => { const cell = el("td"); cell.append(value instanceof Node ? value : document.createTextNode(String(value ?? "—"))); row.append(cell); }); body.append(row); });
    node.append(body); wrap.append(node); return wrap;
  }
  function title(text) { panel.replaceChildren(el("h2", text)); }
  async function products() {
    title("محصولات فروشگاه");
    const items = await api("/merchant/products");
    panel.append(table(["نام", "SKU", "قیمت (ریال)", "بررسی"], items.map(p => [p.name, p.sku, formatNumber(p.currentPrice), button("جزئیات و قیمت", () => detail(p.id))])));
    if (!items.length) panel.append(notice("از «افزودن محصول» یا «ورود اکسل» شروع کنید."));
  }
  function chart(records) {
    const container = el("div"); container.append(el("h3", "تاریخچه قیمت پیشنهادی"));
    const data = [...records].reverse();
    if (data.length < 2) { container.append(notice("برای نمودار حداقل دو پیشنهاد ثبت‌شده لازم است.")); return container; }
    const ns = "http://www.w3.org/2000/svg"; const svg = document.createElementNS(ns, "svg"); svg.setAttribute("viewBox", "0 0 600 180"); svg.setAttribute("class", "history-chart"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "روند قیمت پیشنهادی؛ جدول اعداد در ادامه آمده است");
    const values = data.map(r => r.suggestedPrice); const min = Math.min(...values); const range = Math.max(...values) - min || 1;
    const line = document.createElementNS(ns, "polyline"); line.setAttribute("points", values.map((p, i) => `${15 + i * 570 / (values.length - 1)},${160 - (p - min) * 140 / range}`).join(" ")); line.setAttribute("fill", "none"); line.setAttribute("stroke", "#315bdd"); line.setAttribute("stroke-width", "3"); svg.append(line); container.append(svg);
    container.append(table(["تاریخ", "قیمت (ریال)"], data.map(r => [new Date(r.createdAt).toLocaleDateString("fa-IR"), formatNumber(r.suggestedPrice)]))); return container;
  }
  async function detail(id) {
    title("جزئیات محصول"); const p = await api(`/merchant/products/${id}/detail`);
    panel.append(el("h3", `${p.name} — ${p.sku}`), notice(`قیمت فعلی: ${formatNumber(p.currentPrice)} ریال`), chart(p.suggestions));
    panel.append(button("پیشنهاد قیمت و دلیل", async () => {
      const recommendation = await api(`/products/${id}/suggestion`);
      form.elements.price.value = recommendation.suggestedPrice;
      form.elements.reason.value = recommendation.rationale.join("؛ ");
      panel.prepend(notice(`حاشیه سود مورد انتظار: ${formatPercent(recommendation.expectedMarginPct * 100)}`));
    }));
    const form = submitForm("ثبت برای تأیید", async data => { await api(`/merchant/products/${id}/approvals`, { price: Number(data.price), reason: data.reason }); panel.prepend(notice("پیشنهاد ثبت شد؛ آن را در مرکز تأیید بررسی کنید.")); });
    field(form, "price", "قیمت پیشنهادی (ریال)", "number", p.currentPrice || ""); field(form, "reason", "دلیل تغییر قیمت"); panel.append(form);
    panel.append(button("ریسک هزینه جایگزینی", async () => { const r = await api(`/merchant/products/${id}/replacement`); panel.prepend(notice(`هزینه جایگزینی تخمینی: ${formatNumber(r.replacementCost)} ریال — ${r.atRisk ? "قیمت فعلی هزینه جایگزینی را پوشش نمی‌دهد" : "هزینه خرید کالا پوشش داده می‌شود؛ سایر هزینه‌ها را نیز بررسی کنید"}`)); }));
    panel.append(el("h3", "تاریخچه رقبا و کیفیت داده"), table(["رقیب", "کانال", "قیمت", "وضعیت", "اطمینان", "زمان"], p.competitorPrices.map(c => [c.competitorName, c.channel, formatNumber(c.price), !c.inStock ? "ناموجود" : Date.now() - new Date(c.capturedAt).getTime() > 86400000 ? "قدیمی" : "تازه", formatPercent(c.matchConfidence * 100), new Date(c.capturedAt).toLocaleString("fa-IR")])));
    const competitor = submitForm("ثبت قیمت رقیب", async data => {
      await api(`/products/${id}/competitor-prices`, { competitorName: data.competitorName, channel: data.channel, price: Number(data.price), inStock: data.inStock === "yes", matchConfidence: Number(data.confidence) / 100 });
      await detail(id);
    });
    field(competitor, "competitorName", "نام رقیب"); field(competitor, "channel", "کانال رقیب"); field(competitor, "price", "قیمت رقیب (ریال)", "number"); field(competitor, "confidence", "اطمینان از تطابق مدل و گارانتی، درصد", "number", 100);
    const stockLabel = el("label", "موجودی رقیب"); const stock = el("select"); stock.name = "inStock";
    for (const [value, text] of [["yes", "موجود"], ["no", "ناموجود"]]) { const option = el("option", text); option.value = value; stock.append(option); }
    stockLabel.append(stock); competitor.append(stockLabel);
    panel.append(notice("فقط قیمت‌های ریالیِ موجود، با تطابق حداقل ۹۰٪ و عمر کمتر از ۲۴ ساعت در پیشنهادها لحاظ می‌شوند."), competitor);
    const sale = submitForm("ثبت فروش و هزینه واقعی", async data => { const body = { channel: data.channel, soldAt: new Date().toISOString() }; for (const key of ["price", "quantity", "unitCostSnapshot", "commissionAmount", "shippingSubsidy", "discountAmount", "returnCost", "settlementDeduction"]) body[key] = Number(data[key]); await api(`/products/${id}/sales`, body); panel.prepend(notice("فروش ثبت شد و در گزارش سود لحاظ می‌شود.")); });
    field(sale, "channel", "کانال", "text", "direct");
    for (const [name, label, value] of [["price", "قیمت واحد (ریال)", p.currentPrice || ""], ["quantity", "تعداد", 1], ["unitCostSnapshot", "بهای تمام‌شده هر واحد در زمان فروش (ریال)", ""], ["commissionAmount", "کل کمیسیون", 0], ["shippingSubsidy", "کل یارانه ارسال", 0], ["discountAmount", "کل تخفیف", 0], ["returnCost", "کل هزینه مرجوعی", 0], ["settlementDeduction", "کسری تسویه", 0]]) field(sale, name, label, "number", value);
    panel.append(el("h3", "ثبت فروش"), notice("بهای تمام‌شده واحد باید شامل بسته‌بندی و سایر هزینه‌های ثابت باشد؛ کسورات دیگر برای کل این رکورد فروش هستند."), sale);
  }
  async function approvals() {
    title("مرکز تأیید قیمت"); panel.append(notice("اعمال و بازگشت در کاتالوگ سودبان انجام می‌شود؛ تغییر قیمت در مارکت‌پلیس خارجی نیست. هر اقدام دوباره کف سود را بررسی می‌کند."));
    const items = await api("/merchant/approvals");
    const labels = { RECOMMENDED: "پیشنهادشده", APPROVED: "تأییدشده", APPLIED: "اعمال محلی", REJECTED: "ردشده", ROLLED_BACK: "بازگشت‌داده‌شده" };
    for (const a of items) {
      const card = el("article", null, "product-card glass"); card.append(el("h3", a.product.name), el("p", `${formatNumber(a.previousPrice)} ← ${formatNumber(a.proposedPrice)} ریال`), el("p", a.reason), notice(labels[a.status] || a.status));
      const actions = a.status === "RECOMMENDED" ? [["approve", "تأیید"], ["reject", "رد"]] : a.status === "APPROVED" ? [["apply", "اعمال در سودبان"]] : a.status === "APPLIED" ? [["rollback", "بازگشت قیمت"]] : [];
      for (const [action, label] of actions) card.append(button(label, async () => { await api(`/merchant/approvals/${a.id}/${action}`, {}); await approvals(); await loadDashboard(); }));
      panel.append(card);
    }
    if (!items.length) panel.append(notice("ابتدا از جزئیات محصول، پیشنهاد ثبت کنید."));
  }
  async function reports() {
    title("سود خالص به تفکیک SKU و کانال");
    const report = await api("/merchant/profit");
    panel.append(notice("مبالغ ریالی‌اند. سود ردیف‌های بدون بهای تاریخی در جمع لحاظ نمی‌شود؛ گزارش حداکثر ۱۰٬۰۰۰ فروش اخیر را پوشش می‌دهد."), table(["SKU", "کانال", "درآمد", "سود رکوردهای کامل", "رکورد ناقص"], report.groups.map(r => [r.sku, r.channel, formatNumber(r.revenue), formatNumber(r.netProfit), r.incompleteRecords])));
    const channels = await api("/merchant/channel-performance");
    panel.append(el("h3", "عملکرد کانال"), table(["کانال", "سفارش", "واحد", "درآمد", "سود", "حاشیه"], channels.channels.map(r => [r.channel, r.orders, r.units, formatNumber(r.revenue), formatNumber(r.netProfit), r.marginPct == null ? "نامعلوم" : formatPercent(r.marginPct * 100)])));
    panel.append(button("برآورد مالیات این ماه", async () => { const tax = await api("/merchant/tax-report"); panel.prepend(notice(`مالیات ارزش‌افزوده برآوردی: ${formatNumber(tax.estimatedVat)} ریال — ${tax.disclaimer}`)); }));
  }
  function onboarding() {
    title("اولین محصول و تحلیل سود");
    const form = submitForm("ثبت و مشاهده تحلیل", async data => {
      const multiplier = data.unit === "IRT" ? 10 : 1;
      const product = await api("/merchant/onboarding", { product: { sku: data.sku, name: data.name, currentPrice: Number(data.price) * multiplier },
        costs: { unitCost: Number(data.cost) * multiplier, commissionRate: Number(data.commission) / 100 }, rule: { minMarginPct: Number(data.margin) / 100 } });
      await detail(product.id); await loadDashboard();
    });
    field(form, "sku", "SKU یکتا"); field(form, "name", "نام محصول");
    const label = el("label", "واحد مبالغ"); const select = el("select"); select.name = "unit"; for (const [value, text] of [["IRR", "ریال"], ["IRT", "تومان"]]) { const option = el("option", text); option.value = value; select.append(option); } label.append(select); form.append(label);
    field(form, "price", "قیمت فعلی", "number"); field(form, "cost", "بهای خرید هر واحد", "number"); field(form, "commission", "کمیسیون درصد", "number", 0); field(form, "margin", "حداقل حاشیه سود درصد", "number", 15); panel.append(form);
  }
  function imports() {
    title("ورود Excel / CSV با پیش‌نمایش");
    panel.append(notice("حداکثر ۵۰۰ ردیف و ۱ مگابایت. ستون‌های SKU، نام، قیمت و هزینه را تطبیق دهید؛ واحد مبالغ صریحاً انتخاب می‌شود. ثبت همه ردیف‌ها اتمیک است."));
    const input = el("input"); input.type = "file"; input.accept = ".csv,.xlsx"; input.setAttribute("aria-label", "فایل CSV یا اکسل");
    panel.append(input, button("خواندن فایل", async () => {
      const file = input.files[0]; if (!file) throw new Error("فایل انتخاب کنید");
      if (file.size > 1048576) throw new Error("فایل بزرگ‌تر از ۱ مگابایت است");
      const response = await fetch("/imports/file", { method: "POST", headers: { Authorization: `Bearer ${state.apiKey}`, "Content-Type": file.name.toLowerCase().endsWith(".csv") ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, body: file });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
      const form = submitForm("اعتبارسنجی پیش‌نمایش", async data => {
        const mapping = Object.fromEntries(["sku", "name", "currentPrice", "unitCost"].map(k => [k, data[k]]));
        const body = { rows: payload.rows, mapping, unit: data.unit };
        const preview = await api("/imports/catalog", body);
        results.replaceChildren(table(["ردیف", "SKU", "قیمت ریالی", "خطا"], preview.results.map(r => [r.row, r.data?.sku, r.data?.currentPrice, r.error || "معتبر"])));
        if (preview.valid) results.append(button("تأیید و ورود همه ردیف‌ها", async () => { const result = await api("/imports/catalog", { ...body, commit: true }); title("ورود موفق"); panel.append(notice(`${result.imported} محصول ثبت شد.`)); await loadDashboard(); }));
      });
      for (const [key, text] of [["sku", "ستون SKU"], ["name", "ستون نام"], ["currentPrice", "ستون قیمت"], ["unitCost", "ستون هزینه"]]) {
        const label = el("label", text); const select = el("select"); select.name = key;
        payload.headers.forEach(header => { const option = el("option", header); option.value = header; if (header === key) option.selected = true; select.append(option); }); label.append(select); form.append(label);
      }
      const label = el("label", "واحد مبالغ فایل"); const unit = el("select"); unit.name = "unit";
      for (const [value, text] of [["IRR", "ریال"], ["IRT", "تومان × ۱۰"]]) { const option = el("option", text); option.value = value; unit.append(option); } label.append(unit); form.append(label);
      const results = el("div"); panel.append(form, results);
    }));
  }
  async function inventory() {
    title("موجودی و نقطه سفارش"); const report = await api("/merchant/inventory");
    panel.append(notice(`${report.lowStock} محصول در نقطه سفارش یا پایین‌تر است.`), table(["محصول", "SKU", "موجودی", "نقطه سفارش", "زمان آماده‌سازی"], report.products.map(p => [p.name, p.sku, p.stockQuantity, p.reorderPoint, `${p.handlingTimeDays} روز`])));
  }
  async function marketplace() {
    title("خروجی کانال‌های فروش"); panel.append(notice("فید ریالی/تومانی برای ترب، ایمالز، باسلام و فروشگاه آماده می‌شود؛ این خروجی فقط کاتالوگ است و قیمت خارجی را تغییر نمی‌دهد."));
    const form = submitForm("دریافت فید", async data => {
      const response = await fetch(`/merchant/feeds/${data.channel}?unit=${data.unit}`, { headers: { Authorization: `Bearer ${state.apiKey}` } });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = el("a", "دانلود فید XML", "primary"); link.href = url; link.download = `${data.channel}-products.xml`; panel.append(link);
    });
    const channel = el("select"); channel.name = "channel"; for (const [value, text] of [["torob", "ترب"], ["emalls", "ایمالز"], ["basalam", "باسلام"], ["store", "فروشگاه"]]) { const option = el("option", text); option.value = value; channel.append(option); }
    const channelLabel = el("label", "کانال مقصد"); channelLabel.append(channel); form.append(channelLabel);
    const unit = el("select"); unit.name = "unit"; for (const [value, text] of [["IRR", "ریال"], ["IRT", "تومان"]]) { const option = el("option", text); option.value = value; unit.append(option); }
    const unitLabel = el("label", "واحد قیمت"); unitLabel.append(unit); form.append(unitLabel); panel.append(form);
  }
  async function settings() {
    title("تیم، اعلان و اشتراک");
    panel.append(notice("عضو تیم با کلید اختصاصی و نقش مشخص وارد می‌شود. کلید در پایگاه داده به‌صورت هش نگهداری می‌شود و فقط هنگام صدور نمایش داده می‌شود."));
    const form = submitForm("افزودن عضو", async data => { const member = await api("/sellers/me/team", data); const output = el("input"); output.readOnly = true; output.value = member.apiKey; output.setAttribute("aria-label", "کلید یک‌بار نمایش عضو"); panel.prepend(output, notice("کلید عضو را امن تحویل دهید؛ دوباره نمایش داده نمی‌شود.")); });
    field(form, "email", "ایمیل عضو", "email"); field(form, "name", "نام عضو");
    const roleLabel = el("label", "نقش"); const role = el("select"); role.name = "role"; ["VIEWER", "ANALYST", "MANAGER"].forEach(r => { const o = el("option", r); o.value = r; role.append(o); }); roleLabel.append(role); form.append(roleLabel); panel.append(form);
    if (["OWNER", "MANAGER"].includes(state.profile?.role)) {
      const members = await api("/sellers/me/team");
      panel.append(table(["ایمیل", "نقش", "دسترسی"], members.map(m => [m.email, m.role, button(m.isActive ? "غیرفعال کردن" : "فعال کردن", async () => { await api(`/sellers/me/team/${m.id}`, { isActive: !m.isActive }, "PATCH"); await settings(); })])));
      const estimate = await api("/billing/estimate"); panel.append(notice(`برآورد ماهانه: ${formatNumber(estimate.total)} ریال؛ پرداخت واقعی هنوز متصل نیست.`));
    }
    const notifications = submitForm("ذخیره کانال اعلان", async data => { await api("/sellers/me/notifications", Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v || null])), "PATCH"); panel.prepend(notice("تنظیمات ذخیره شد. ارسال خودکار نیازمند اجرای job روزانه روی سرور و کانال پیکربندی‌شده است.")); });
    field(notifications, "notifyEmail", "ایمیل اعلان", "email", "", false); field(notifications, "telegramChatId", "شناسه چت تلگرام", "text", "", false); field(notifications, "notifyPhone", "شماره پیامک", "text", "", false); panel.append(notifications);
    const signal = submitForm("ثبت سیگنال اقتصادی", async data => {
      await api("/economic/economic-signals", { source: data.source, currency: data.currency, rate: Number(data.rate), capturedAt: new Date(data.capturedAt).toISOString() });
      panel.prepend(notice("نرخ ثبت شد. برای برآورد جایگزینی، یک نرخ هم‌منبع در تاریخ بهای خرید و نرخ جدید لازم است."));
    });
    field(signal, "source", "نام منبع نرخ"); field(signal, "currency", "ارز مبنا (مثلاً USD)", "text", "USD"); field(signal, "rate", "هر واحد ارز چند ریال است؟", "number"); field(signal, "capturedAt", "تاریخ نرخ", "datetime-local"); panel.append(el("h3", "هزینه جایگزینی"), signal);
  }
  const views = { products, approvals, reports, onboarding, imports, inventory, marketplace, settings };
  document.querySelectorAll("[data-view]").forEach(control => control.addEventListener("click", () => {
    const view = control.dataset.view;
    document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("active", b === control));
    document.querySelector("#overview-view").classList.toggle("hidden", view !== "overview"); panel.classList.toggle("hidden", view === "overview");
    if (view !== "overview") { panel.focus(); perform(views[view]); }
  }));
  document.querySelector("#today").textContent = new Intl.DateTimeFormat("fa-IR", { dateStyle: "full" }).format(new Date());
  document.querySelector("#account-form").addEventListener("submit", async event => {
    event.preventDefault(); const form = event.currentTarget; const control = event.submitter; control.disabled = true;
    const data = Object.fromEntries(new FormData(form)); const register = control.name === "register";
    try {
      const response = await fetch(`/accounts/${register ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(register ? data : { email: data.email, password: data.password }) });
      const account = await response.json(); if (!response.ok) throw new Error(account.error || "ورود ناموفق بود");
      form.reset(); await enterDashboard(account.token);
    } catch (error) { document.querySelector("#auth-error").textContent = error.message; }
    finally { control.disabled = false; }
  });
})();
