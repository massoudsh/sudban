
      const state = { apiKey: "", cards: [], loading: false };
      const $ = (selector) => document.querySelector(selector);
      const formatNumber = (value) => typeof value === "number" ? new Intl.NumberFormat("fa-IR").format(Math.round(value)) : "—";
      const formatPercent = (value) => typeof value === "number" ? `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(value)}٪` : "—";
      const priorityLabel = { HIGH: "فوری", MEDIUM: "قابل توجه", LOW: "پایدار" };
      const trendLabel = { UP: "رو به رشد", DOWN: "رو به کاهش", STABLE: "پایدار", UNKNOWN: "داده کافی نیست" };

      function setStatus(message, error = false) {
        const status = $("#status");
        status.textContent = message;
        status.className = error ? "status error" : "status";
      }

      function renderSkeletons() {
        $("#product-grid").replaceChildren(...Array.from({ length: 6 }, () => { const node = document.createElement("div"); node.className = "skeleton glass"; return node; }));
      }

      function createCard(card) {
        const product = card.product || {};
        const insight = card.wisdom?.insights?.[0];
        const article = document.createElement("article");
        article.className = "product-card glass";
        article.dataset.search = `${product.name || ""} ${product.sku || ""}`.toLocaleLowerCase("fa");

        const top = document.createElement("div"); top.className = "product-top";
        const title = document.createElement("div"); title.className = "product-title";
        const heading = document.createElement("h4"); heading.textContent = product.name || "محصول بدون نام";
        const sku = document.createElement("small"); sku.textContent = `SKU: ${product.sku || "—"}`;
        title.append(heading, sku);
        const badge = document.createElement("span"); badge.className = `priority ${(insight?.priority || "LOW").toLowerCase()}`; badge.textContent = priorityLabel[insight?.priority] || "پایدار";
        top.append(title, badge);

        const priceRow = document.createElement("div"); priceRow.className = "price-row";
        const current = document.createElement("div"); const currentLabel = document.createElement("span"); currentLabel.textContent = "قیمت فعلی"; const currentPrice = document.createElement("strong"); currentPrice.textContent = formatNumber(product.currentPrice); current.append(currentLabel, currentPrice);
        const arrow = document.createElement("div"); arrow.className = "price-arrow"; arrow.textContent = "←";
        const suggested = document.createElement("div"); const suggestedLabel = document.createElement("span"); suggestedLabel.textContent = "پیشنهاد سودبان"; const suggestedPrice = document.createElement("strong"); suggestedPrice.textContent = formatNumber(card.suggestion?.suggestedPrice); suggested.append(suggestedLabel, suggestedPrice);
        priceRow.append(current, arrow, suggested);

        const insightBox = document.createElement("div"); insightBox.className = "insight"; insightBox.textContent = card.setupRequired ? "برای تحلیل این محصول، هزینه و قاعده قیمت‌گذاری را تکمیل کنید." : (insight?.message || card.wisdom?.topRecommendation || "وضعیت محصول پایدار است.");
        const footer = document.createElement("div"); footer.className = "card-footer";
        const margin = document.createElement("span"); margin.textContent = card.suggestion ? `حاشیه سود: ${formatPercent(card.suggestion.expectedMarginPct * 100)}` : "نیازمند تنظیمات";
        const trend = document.createElement("span"); const direction = card.salesTrend?.direction || "UNKNOWN"; trend.className = `trend ${direction === "UP" ? "up" : direction === "DOWN" ? "down" : ""}`; trend.textContent = trendLabel[direction];
        footer.append(margin, trend);
        article.append(top, priceRow, insightBox, footer);
        return article;
      }

      function renderCards() {
        const query = $("#search").value.trim().toLocaleLowerCase("fa");
        const filtered = state.cards.filter((card) => `${card.product?.name || ""} ${card.product?.sku || ""}`.toLocaleLowerCase("fa").includes(query));
        filtered.sort((a, b) => ({ HIGH: 0, MEDIUM: 1, LOW: 2 }[a.wisdom?.insights?.[0]?.priority] ?? 3) - ({ HIGH: 0, MEDIUM: 1, LOW: 2 }[b.wisdom?.insights?.[0]?.priority] ?? 3));
        const grid = $("#product-grid");
        if (!filtered.length) {
          const empty = document.createElement("div"); empty.className = "empty glass";
          const title = document.createElement("strong"); title.textContent = query ? "محصولی با این جست‌وجو پیدا نشد" : "هنوز محصولی برای نمایش وجود ندارد";
          const copy = document.createElement("span"); copy.textContent = query ? "عبارت دیگری را امتحان کنید." : "پس از ثبت محصول، تحلیل Wisdom در اینجا نمایش داده می‌شود.";
          empty.append(title, copy); grid.replaceChildren(empty); return;
        }
        grid.replaceChildren(...filtered.map(createCard));
      }

      function updateMetrics(data) {
        const cards = data.cards || [];
        const actionable = cards.filter((card) => card.wisdom?.insights?.some((insight) => insight.priority === "HIGH")).length;
        const suggestions = cards.filter((card) => card.suggestion).length;
        const directions = cards.map((card) => card.salesTrend?.direction).filter(Boolean);
        const rising = directions.filter((direction) => direction === "UP").length;
        const falling = directions.filter((direction) => direction === "DOWN").length;
        $("#metric-products").textContent = formatNumber(data.count ?? cards.length);
        $("#metric-alerts").textContent = formatNumber(actionable);
        $("#metric-suggestions").textContent = formatNumber(suggestions);
        $("#metric-trend").textContent = !directions.some(d => d !== "UNKNOWN") ? "نامشخص" : rising > falling ? "رشد" : falling > rising ? "کاهش" : "پایدار";
        $("#metric-trend-label").textContent = `${formatNumber(rising)} محصول رو به رشد`;
      }

      async function loadDashboard() {
        if (!state.apiKey || state.loading) return;
        const token = state.apiKey;
        state.loading = true; renderSkeletons(); setStatus("در حال همگام‌سازی تحلیل‌ها...");
        try {
          const response = await fetch("/dashboard/wisdom", { headers: { Authorization: `Bearer ${state.apiKey}` } });
          const data = await response.json();
          if (state.apiKey !== token) return;
          if (!response.ok) throw new Error(data.error || "دریافت داشبورد ناموفق بود");
          state.cards = data.cards || []; updateMetrics(data); renderCards(); setStatus(`آخرین همگام‌سازی: ${new Intl.DateTimeFormat("fa-IR", { timeStyle: "short" }).format(new Date())}`);
        } catch (error) { $("#product-grid").replaceChildren(); setStatus(error.message || "خطا در دریافت اطلاعات", true); }
        finally { state.loading = false; }
      }

      async function signOut() {
        const token = state.apiKey; state.apiKey = ""; state.cards = [];
        $("#api-key").value = ""; $("#account-form").reset();
        $("#product-grid").replaceChildren(); $("#workflow-view").replaceChildren();
        $("#app").classList.add("hidden"); $("#auth-overlay").classList.remove("hidden");
        try { await fetch("/accounts/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }); } catch {}
      }
      async function enterDashboard(token) {
        state.apiKey = token;
        try {
          const response = await fetch("/sellers/me", { headers: { Authorization: `Bearer ${token}` } });
          if (!response.ok) throw new Error("دسترسی معتبر نیست؛ دوباره وارد شوید");
          state.profile = await response.json();
          $("#api-key").value = ""; $("#auth-error").textContent = "";
          $("#auth-overlay").classList.add("hidden"); $("#app").classList.remove("hidden");
          await loadDashboard();
        } catch (error) { state.apiKey = ""; $("#auth-error").textContent = error.message; }
      }
      $("#auth-form").addEventListener("submit", event => { event.preventDefault(); enterDashboard($("#api-key").value.trim()); });
      $("#logout").addEventListener("click", signOut);
      $("#logout-mobile").addEventListener("click", signOut);
      $("#refresh").addEventListener("click", loadDashboard); $("#refresh-top").addEventListener("click", loadDashboard); $("#search").addEventListener("input", renderCards);
