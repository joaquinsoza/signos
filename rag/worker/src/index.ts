export interface Env {
  VECTORIZE: Vectorize; // binding del índice
  AI: Ai;               // binding de Workers AI
}

type ImageRef = { url: string; sequence?: number };
type IngestDoc = {
  id: string;
  text: string; // contenido a embebar (glosa o glosa+definición)
  metadata: {
    glosa: string;
    language_code?: string;
    region?: string;
    definition?: string;
    images?: ImageRef[];
    synonyms?: string[];
    antonyms?: string[];
    [k: string]: unknown;
  };
};

function buildRagPrompt(question: string, chunks: { text: string; meta?: any }[]) {
  const context = chunks.map((c, i) => {
    const glosa = c.meta?.glosa ?? c.text ?? "—";
    const def = c.meta?.definition ? `\nDefinición: ${c.meta.definition}` : "";
    const imgs = (c.meta?.images ?? [])
      .slice()
      .sort((a: ImageRef, b: ImageRef) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .map((x: ImageRef) => `${x.url}${typeof x.sequence === "number" ? ` (#${x.sequence})` : ""}`)
      .join(", ");
    const pics = imgs ? `\nImágenes: ${imgs}` : "";
    return `[${i + 1}] ${glosa}${def}${pics}`;
  }).join("\n\n");

  return [
    { role: "system", content: "Eres un asistente que SOLO usa el contexto. Si falta info, responde 'no sé'." },
    { role: "user", content: `Contexto:\n${context}\n\nPregunta: ${question}` }
  ];
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Health
    if (url.pathname === "/" && req.method === "GET") {
      return new Response("Signos + Vectorize + Workers AI ✅");
    }

    // ---------- /ingest ----------
    // body: { docs: IngestDoc[] }
    if (url.pathname === "/ingest" && req.method === "POST") {
      try {
        const { docs } = await req.json() as { docs: IngestDoc[] };
        if (!Array.isArray(docs) || docs.length === 0) {
          return Response.json({ error: "docs[] requerido" }, { status: 400 });
        }

        const texts = docs.map(d => d.text);
        const emb = await env.AI.run("@cf/google/embeddinggemma-300m", { text: texts });
        const shape = (emb as any).shape;
        const data = (emb as any).data as number[][];
        console.log("ingest.embed.shape", shape, "vecLen0", data?.[0]?.length);

        const payload = docs.map((d, i) => ({
          id: d.id,
          values: data[i],
          metadata: d.metadata
        }));

        const result = await env.VECTORIZE.upsert(payload);
        console.log("ingest.upsert.result", result);

        return Response.json({ ok: true, count: payload.length, result });
      } catch (err: any) {
        console.error("ingest.error", err);
        return Response.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
      }
    }

    // ---------- /get ----------
    // body: { glosa: string, language_code?: string, region?: string }
    if (url.pathname === "/get" && req.method === "POST") {
      try {
        const { glosa, language_code, region } = await req.json() as any;
        if (!glosa) return Response.json({ error: "glosa requerida" }, { status: 400 });

        // embedding de la glosa (sirve igualmente para query por filtro)
        const emb = await env.AI.run("@cf/google/embeddinggemma-300m", { text: [glosa] });
        const vec = (emb as any).data?.[0] as number[];
        console.log("get.vecLen", vec?.length);

        const filter: Record<string, any> = { glosa };
        if (language_code) filter.language_code = language_code;
        if (region) filter.region = region;

        const out = await env.VECTORIZE.query(vec, {
          topK: 5,
          returnMetadata: true,
          filter
        } as any);

        console.log("get.matches.count", out?.count);
        return Response.json(out);
      } catch (err: any) {
        console.error("get.error", err);
        return Response.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
      }
    }

    // ---------- /search ----------
    // body: { query: string, topK?: number, filter?: any }
    if (url.pathname === "/search" && req.method === "POST") {
      try {
        const { query, topK = 5, filter } = await req.json() as any;
        if (!query) return Response.json({ error: "query requerida" }, { status: 400 });

        const emb = await env.AI.run("@cf/google/embeddinggemma-300m", { text: [query] });
        const vec = (emb as any).data?.[0] as number[];
        console.log("search.vecLen", vec?.length);

        const out = await env.VECTORIZE.query(vec, {
          topK,
          returnMetadata: true,
          filter
        } as any);

        console.log("search.matches.count", out?.count);
        return Response.json(out);
      } catch (err: any) {
        console.error("search.error", err);
        return Response.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
      }
    }

    // ---------- /answer ----------
    // body: { question: string, topK?: number, filter?: any, model?: string }
    if (url.pathname === "/answer" && req.method === "POST") {
      try {
        const { question, topK = 5, filter, model = "@cf/meta/llama-3.1-8b-instruct" } = await req.json() as any;
        if (!question) return Response.json({ error: "question requerida" }, { status: 400 });

        const emb = await env.AI.run("@cf/google/embeddinggemma-300m", { text: [question] });
        const vec = (emb as any).data?.[0] as number[];
        console.log("answer.vecLen", vec?.length);

        const matches = await env.VECTORIZE.query(vec, { topK, returnMetadata: true, filter } as any);
        console.log("answer.matches.count", matches?.count);

        const chunks = (matches.matches ?? []).map((m: any) => ({
          text: m?.metadata?.definition || m?.metadata?.glosa || "—",
          meta: m?.metadata
        }));

        const messages = buildRagPrompt(question, chunks);
        const completion = await env.AI.run(model, { messages });

        return Response.json({ completion, matches });
      } catch (err: any) {
        console.error("answer.error", err);
        return Response.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
