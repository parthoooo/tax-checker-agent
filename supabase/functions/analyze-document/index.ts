import { analyzeMock } from "../_shared/analyzeMock.ts";
import { analyzeWithGemini, type AnalyzeTaxDocumentInput } from "../_shared/geminiTaxAnalyze.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const input = await req.json() as AnalyzeTaxDocumentInput & { clientId?: string };

    const geminiResult = await analyzeWithGemini(input);
    const result = geminiResult ?? analyzeMock(input);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
