import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  workshopData: {
    workshopName?: string;
    customers?: unknown[];
    orders?: unknown[];
    expenses?: unknown[];
    payments?: unknown[];
    dailyCapacity?: number;
    garmentTypes?: unknown[];
  };
  apiKey?: string;
}

const SYSTEM_PROMPT = `أنت مساعد ذكي متخصص في إدارة ورشة تفصيل الجلابيب. بتفهم بيانات الورشة اللي بتبعتها لك، وبتجاوب على أسئلة صاحب الورشة بأسلوب واضح ومباشر بالعربي المصري.

إرشادات:
- جاوب بالعربي المصري بأسلوب صديقي ومباشر.
- لما تسأل عن أرقام، استخدم البيانات المقدمة بالظبط (مش بتعملها من دماغك).
- لو السؤال محتاج تحليل (زي "مين أعلى عميل مديونية")، حلّل البيانات وادّي إجابة دقيقة.
- لو السؤال مش واضح أو مش موجود فيه بيانات كافية، اسأل للتوضيح.
- ركّز على موضوعات: العملاء، الطلبات، المديونيات، المواعيد، الإيرادات، المصروفات، الطاقة الإنتاجية.
- خلي الرد مختصر ومفيد، استخدم نقاط لو محتاج تفاصيل.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { messages, workshopData, apiKey } = body;

    if (!apiKey || !apiKey.trim()) {
      return new Response(
        JSON.stringify({
          error:
            "مفتاح OpenAI مش متظبط. ضعه من صفحة الإعدادات → المساعد الذكي.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "لازم تبعت رسالة على الأقل" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build a compact data summary for the system prompt
    const dataSummary = buildDataSummary(workshopData);

    const fullMessages: ChatMessage[] = [
      {
        role: "system",
        content: SYSTEM_PROMPT + (dataSummary ? "\n\nبيانات الورشة الحالية:\n" + dataSummary : ""),
      },
      ...messages,
    ];

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: fullMessages,
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI API error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({
          error: "الاتصال بالمساعد الذكي فشل. تأكد من صحة مفتاح OpenAI.",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const aiData = await aiResponse.json();
    const reply =
      aiData.choices?.[0]?.message?.content ||
      "آسف، مقدرتش أحلّل الطلب ده.";

    return new Response(
      JSON.stringify({ reply }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("AI assistant edge function error:", err);
    return new Response(
      JSON.stringify({
        error: "حصل خطأ غير متوقع. حاول تاني.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

function buildDataSummary(data: RequestBody["workshopData"]): string {
  if (!data) return "";
  const parts: string[] = [];

  parts.push(`اسم الورشة: ${data.workshopName || "ورشة تفصيل الجلابيب"}`);

  const customers = Array.isArray(data.customers) ? data.customers : [];
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const expenses = Array.isArray(data.expenses) ? data.expenses : [];
  const payments = Array.isArray(data.payments) ? data.payments : [];

  parts.push(`عدد العملاء: ${customers.length}`);
  parts.push(`عدد الطلبات: ${orders.length}`);

  // Orders summary
  const inProgress = orders.filter((o: any) => o.status === "قيد العمل");
  const ready = orders.filter((o: any) => o.status === "جاهز للتسليم");
  const delivered = orders.filter((o: any) => o.status === "تم التسليم");
  parts.push(`طلبات قيد العمل: ${inProgress.length}`);
  parts.push(`طلبات جاهزة للتسليم: ${ready.length}`);
  parts.push(`طلبات تم تسليمها: ${delivered.length}`);

  // Financial summary
  const totalRevenue = payments.reduce(
    (s: number, p: any) => s + (Number(p.amount) || 0),
    0,
  );
  const totalExpenses = expenses.reduce(
    (s: number, e: any) => s + (Number(e.amount) || 0),
    0,
  );
  parts.push(`إجمالي المحصّل: ${Math.round(totalRevenue)} ج.م`);
  parts.push(`إجمالي المصروفات: ${Math.round(totalExpenses)} ج.م`);

  // Overdue orders
  const today = new Date().toISOString().slice(0, 10);
  const overdue = orders.filter(
    (o: any) => o.status !== "تم التسليم" && o.dateDelivery && o.dateDelivery < today,
  );
  parts.push(`طلبات متأخرة: ${overdue.length}`);

  // Debts
  const debtMap: Record<string, number> = {};
  orders.forEach((o: any) => {
    const total = orderTotalCalc(o);
    const remaining = total - (Number(o.paid) || 0);
    if (remaining > 0) {
      debtMap[o.customerId] = (debtMap[o.customerId] || 0) + remaining;
    }
  });
  const totalDebt = Object.values(debtMap).reduce((s, v) => s + v, 0);
  parts.push(`إجمالي المديونيات المتبقية: ${Math.round(totalDebt)} ج.م`);

  // Top debtors
  const topDebtors = Object.entries(debtMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cid, amount]) => {
      const c = customers.find((cu: any) => cu.id === cid);
      return `- ${c ? c.name : "عميل"}: ${Math.round(amount)} ج.م`;
    });
  if (topDebtors.length) {
    parts.push(`أعلى المديونيات:\n${topDebtors.join("\n")}`);
  }

  // Daily capacity
  if (data.dailyCapacity) {
    parts.push(`الطاقة اليومية: ${data.dailyCapacity} ج.م`);
  }

  // Garment types
  const garmentTypes = Array.isArray(data.garmentTypes) ? data.garmentTypes : [];
  if (garmentTypes.length) {
    const typesList = garmentTypes
      .map((g: any) => `- ${g.name}: ${g.price} ج.م`)
      .join("\n");
    parts.push(`أنواع التفصيل:\n${typesList}`);
  }

  // Recent orders (last 10)
  const recentOrders = orders.slice(-10).map((o: any) => {
    const c = customers.find((cu: any) => cu.id === o.customerId);
    return `- ${c ? c.name : "عميل"} | ${orderTypeLabelCalc(o)} | حالة: ${o.status} | استلام: ${o.dateReceived || "-"} | تسليم: ${o.dateDelivery || "-"} | مدفوع: ${o.paid || 0} | متبقي: ${Math.round(orderTotalCalc(o) - (Number(o.paid) || 0))}`;
  });
  if (recentOrders.length) {
    parts.push(`آخر الطلبات:\n${recentOrders.join("\n")}`);
  }

  return parts.join("\n");
}

function orderTotalCalc(o: any): number {
  let subtotal: number;
  if (Array.isArray(o.items) && o.items.length) {
    const itemsSum = o.items.reduce(
      (s: number, it: any) =>
        s + (Number(it.unitPrice) || 0) * (Number(it.qty) || 1),
      0,
    );
    subtotal = itemsSum + (Number(o.extra) || 0);
  } else {
    subtotal = (Number(o.fee) || 0) + (Number(o.extra) || 0);
  }
  let discount = 0;
  if (o.discountType === "percent") {
    discount = Math.min(subtotal, subtotal * (Number(o.discountValue) || 0) / 100);
  } else if (o.discountType === "amount") {
    discount = Math.min(subtotal, Math.max(0, Number(o.discountValue) || 0));
  }
  const afterDiscount = subtotal - discount;
  const tax = afterDiscount * (Number(o.taxPercent) || 0) / 100;
  return Math.max(0, afterDiscount + tax);
}

function orderTypeLabelCalc(o: any): string {
  if (Array.isArray(o.items) && o.items.length) {
    return o.items
      .map((it: any) =>
        (it.qty || 1) > 1 ? it.qty + " × " + it.type : it.type,
      )
      .join("، ");
  }
  return (o.qty && o.qty > 1) ? o.qty + " × " + o.type : o.type;
}
