import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;
let cachedAdminClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
    if (cachedClient) {
        return cachedClient;
    }

    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        throw new Error(
            "Supabase configuration missing. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set."
        );
    }

    cachedClient = createClient(url, anonKey);
    return cachedClient;
};

export const getSupabaseAdminClient = (): SupabaseClient => {
    if (cachedAdminClient) {
        return cachedAdminClient;
    }

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        throw new Error(
            "Supabase admin configuration missing. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
        );
    }

    cachedAdminClient = createClient(url, serviceKey);
    return cachedAdminClient;
};

// Export for direct use if needed
export const supabaseAdmin = getSupabaseAdminClient();

/**
 * Request a session key (access token) from ABDM API
 * Used for authenticating ABHA API requests
 */
export async function sessionKey(
    clientId: string,
    clientSecret: string
): Promise<string> {
    try {
        const { v4: uuidv4 } = await import("uuid");

        const response = await fetch(
            "https://dev.abdm.gov.in/api/hiecm/gateway/v3/sessions",
            {
                method: "POST",
                headers: {
                    "REQUEST-ID": uuidv4(),
                    TIMESTAMP: new Date().toISOString(),
                    "X-CM-ID": "sbx",
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    clientId: String(clientId || ""),
                    clientSecret: String(clientSecret || ""),
                    grantType: "client_credentials",
                }),
            }
        );

        const contentType = response.headers.get("content-type") || "";

        if (!response.ok) {
            const text = await response.text();
            const err = new Error(
                `HTTP ${response.status} ${response.statusText}: ${text.substring(0, 500)}`
            );
            (err as any).status = response.status;
            (err as any).body = text;
            throw err;
        }

        if (!contentType.includes("application/json")) {
            const text = await response.text();
            const err = new Error(
                `Expected JSON but got ${contentType}; body: ${text.substring(0, 500)}`
            );
            (err as any).body = text;
            throw err;
        }

        const data = (await response.json()) as { accessToken: string };
        return data.accessToken;
    } catch (error) {
        console.error("sessionKey error:", error);
        throw error;
    }
}

