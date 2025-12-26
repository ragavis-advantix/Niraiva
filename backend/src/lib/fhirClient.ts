import fetch from "node-fetch";

export const FHIR_BASE_URL = process.env.HAPI_FHIR_URL ?? "http://localhost:8080/fhir";

export interface FhirResource {
    resourceType: string;
    id?: string;
    [key: string]: unknown;
}

export interface FhirBundle {
    resourceType: "Bundle";
    type: string;
    total?: number;
    entry?: Array<{
        resource?: FhirResource;
        [key: string]: unknown;
    }>;
}

export interface FhirResponse<T> {
    status: number;
    ok: boolean;
    data?: T;
    error?: string;
}

const getFhirBaseUrl = (): string => {
    const baseUrl = FHIR_BASE_URL;
    return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

const buildFhirHeaders = (contentType: string = "application/fhir+json") => {
    return {
        "Content-Type": contentType,
        Accept: "application/fhir+json",
    };
};

export async function fhirGet<T = unknown>(
    resourcePath: string,
    queryParams?: Record<string, string | string[]>
): Promise<FhirResponse<T>> {
    try {
        const url = new URL(resourcePath, `${getFhirBaseUrl()}/`);

        if (queryParams) {
            Object.entries(queryParams).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    value.forEach((v) => url.searchParams.append(key, v));
                } else {
                    url.searchParams.append(key, value);
                }
            });
        }

        const response = await fetch(url.toString(), {
            method: "GET",
            headers: buildFhirHeaders(),
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : null;

        return {
            status: response.status,
            ok: response.ok,
            data: data as T,
        };
    } catch (error) {
        return {
            status: 500,
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function fhirPost<T = unknown>(
    resourcePath: string,
    body: FhirResource,
    contentType: string = "application/fhir+json"
): Promise<FhirResponse<T>> {
    try {
        const url = new URL(resourcePath, `${getFhirBaseUrl()}/`);

        const response = await fetch(url.toString(), {
            method: "POST",
            headers: buildFhirHeaders(contentType),
            body: JSON.stringify(body),
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : null;

        return {
            status: response.status,
            ok: response.ok,
            data: data as T,
        };
    } catch (error) {
        return {
            status: 500,
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function fhirPut<T = unknown>(
    resourcePath: string,
    body: FhirResource,
    contentType: string = "application/fhir+json"
): Promise<FhirResponse<T>> {
    try {
        const url = new URL(resourcePath, `${getFhirBaseUrl()}/`);

        const response = await fetch(url.toString(), {
            method: "PUT",
            headers: buildFhirHeaders(contentType),
            body: JSON.stringify(body),
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : null;

        return {
            status: response.status,
            ok: response.ok,
            data: data as T,
        };
    } catch (error) {
        return {
            status: 500,
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function fhirDelete(resourcePath: string): Promise<FhirResponse<void>> {
    try {
        const url = new URL(resourcePath, `${getFhirBaseUrl()}/`);

        const response = await fetch(url.toString(), {
            method: "DELETE",
            headers: buildFhirHeaders(),
        });

        return {
            status: response.status,
            ok: response.ok,
        };
    } catch (error) {
        return {
            status: 500,
            ok: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
